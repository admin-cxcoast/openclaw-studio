const { WebSocket, WebSocketServer } = require("ws");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const SSH_KEY_PATH = path.join(os.homedir(), ".ssh", "openclaw_studio_ed25519");

const buildErrorResponse = (id, code, message) => {
  return {
    type: "res",
    id,
    ok: false,
    error: { code, message },
  };
};

const isObject = (value) => Boolean(value && typeof value === "object");

const safeJsonParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const resolvePathname = (url) => {
  const raw = typeof url === "string" ? url : "";
  const idx = raw.indexOf("?");
  return (idx === -1 ? raw : raw.slice(0, idx)) || "/";
};

const injectAuthToken = (params, token) => {
  const next = isObject(params) ? { ...params } : {};
  const auth = isObject(next.auth) ? { ...next.auth } : {};
  auth.token = token;
  next.auth = auth;
  return next;
};

const resolveOriginForUpstream = (upstreamUrl) => {
  const url = new URL(upstreamUrl);
  const proto = url.protocol === "wss:" ? "https:" : "http:";
  const hostname =
    url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "0.0.0.0"
      ? "localhost"
      : url.hostname;
  const host = url.port ? `${hostname}:${url.port}` : hostname;
  return `${proto}//${host}`;
};

const hasNonEmptyToken = (params) => {
  const raw = params && isObject(params) && isObject(params.auth) ? params.auth.token : "";
  return typeof raw === "string" && raw.trim().length > 0;
};

const hasDeviceSignature = (params) => {
  const raw =
    params && isObject(params) && isObject(params.device) ? params.device.signature : null;
  return typeof raw === "string" && raw.trim().length > 0;
};

const extractQueryParam = (url, name) => {
  const raw = typeof url === "string" ? url : "";
  const idx = raw.indexOf("?");
  if (idx === -1) return "";
  try {
    const params = new URLSearchParams(raw.slice(idx));
    return params.get(name) || "";
  } catch {
    return "";
  }
};

/**
 * Find a free port on localhost for SSH tunnel.
 */
const findFreePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });

/**
 * Establish an SSH tunnel: local port → remote host:port.
 * Returns { localPort, close() } on success or throws on failure.
 */
const createSshTunnel = async ({ sshHost, sshUser, sshPort, remotePort, log, logError }) => {
  const localPort = await findFreePort();
  const user = sshUser || "root";
  const portFlag = sshPort && sshPort !== 22 ? ["-p", String(sshPort)] : [];

  const sshArgs = [
    "-N", // No remote command
    "-L", `${localPort}:127.0.0.1:${remotePort}`,
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=10",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=3",
    "-o", "ExitOnForwardFailure=yes",
    ...(fs.existsSync(SSH_KEY_PATH) ? ["-i", SSH_KEY_PATH] : []),
    ...portFlag,
    `${user}@${sshHost}`,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn("ssh", sshArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let settled = false;
    let stderrBuf = "";

    proc.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
    });

    proc.on("error", (err) => {
      if (!settled) {
        settled = true;
        reject(new Error(`SSH tunnel spawn failed: ${err.message}`));
      }
    });

    proc.on("exit", (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(`SSH tunnel exited (code ${code}): ${stderrBuf.slice(-500)}`));
      }
    });

    // Wait for the tunnel to be ready by probing the local port
    const checkReady = (attempts) => {
      if (settled) return;
      const sock = net.createConnection({ host: "127.0.0.1", port: localPort }, () => {
        sock.destroy();
        if (!settled) {
          settled = true;
          log(`SSH tunnel established: localhost:${localPort} → ${sshHost}:${remotePort}`);
          resolve({
            localPort,
            close: () => {
              try { proc.kill(); } catch {}
            },
          });
        }
      });
      sock.on("error", () => {
        sock.destroy();
        if (settled) return;
        if (attempts <= 0) {
          settled = true;
          try { proc.kill(); } catch {}
          reject(new Error(`SSH tunnel port not ready after retries: ${stderrBuf.slice(-500)}`));
          return;
        }
        setTimeout(() => checkReady(attempts - 1), 200);
      });
    };

    // Start probing after a brief delay for SSH to establish
    setTimeout(() => checkReady(25), 300); // up to ~5.3s total
  });
};

function createGatewayProxy(options) {
  const {
    loadUpstreamSettings,
    allowWs = (req) => resolvePathname(req.url) === "/api/gateway/ws",
    log = () => {},
    logError = (msg, err) => console.error(msg, err),
  } = options || {};

  if (typeof loadUpstreamSettings !== "function") {
    throw new Error("createGatewayProxy requires loadUpstreamSettings().");
  }

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (browserWs, req) => {
    let upstreamWs = null;
    let upstreamReady = false;
    let connectRequestId = null;
    let connectResponseSent = false;
    let closed = false;
    let sshTunnel = null;

    // Per-connection upstream target from query param (multi-tenant support)
    const perConnectionTarget = extractQueryParam(req.url, "target");
    const sshHost = extractQueryParam(req.url, "sshHost");
    const sshUser = extractQueryParam(req.url, "sshUser") || "root";
    const sshPort = parseInt(extractQueryParam(req.url, "sshPort") || "22", 10) || 22;

    const closeBoth = (code, reason) => {
      if (closed) return;
      closed = true;
      try {
        browserWs.close(code, reason);
      } catch {}
      try {
        upstreamWs?.close(code, reason);
      } catch {}
      if (sshTunnel) {
        sshTunnel.close();
        sshTunnel = null;
      }
    };

    const sendToBrowser = (frame) => {
      if (browserWs.readyState !== WebSocket.OPEN) return;
      browserWs.send(JSON.stringify(frame));
    };

    const sendConnectError = (code, message) => {
      if (connectRequestId && !connectResponseSent) {
        connectResponseSent = true;
        sendToBrowser(buildErrorResponse(connectRequestId, code, message));
      }
      closeBoth(1011, "connect failed");
    };

    browserWs.on("message", async (raw) => {
      const parsed = safeJsonParse(String(raw ?? ""));
      if (!parsed || !isObject(parsed)) {
        closeBoth(1003, "invalid json");
        return;
      }

      if (!upstreamWs) {
        if (parsed.type !== "req" || parsed.method !== "connect") {
          closeBoth(1008, "connect required");
          return;
        }
        const id = typeof parsed.id === "string" ? parsed.id : "";
        if (!id) {
          closeBoth(1008, "connect id required");
          return;
        }
        connectRequestId = id;

        let upstreamUrl = "";
        let upstreamToken = "";

        if (perConnectionTarget) {
          // Multi-tenant: browser specifies upstream URL, token comes in connect frame
          upstreamUrl = perConnectionTarget;
          upstreamToken = ""; // Token provided by browser in connect params
        } else {
          // Legacy: load from server filesystem
          try {
            const settings = await loadUpstreamSettings();
            upstreamUrl = typeof settings?.url === "string" ? settings.url.trim() : "";
            upstreamToken = typeof settings?.token === "string" ? settings.token.trim() : "";
          } catch (err) {
            logError("Failed to load upstream gateway settings.", err);
            sendConnectError("studio.settings_load_failed", "Failed to load Studio gateway settings.");
            return;
          }
        }

        if (!upstreamUrl) {
          sendConnectError(
            "studio.gateway_url_missing",
            "Upstream gateway URL is not configured on the Studio host."
          );
          return;
        }
        // Only require server-side token when not using per-connection target
        if (!perConnectionTarget && !upstreamToken) {
          sendConnectError(
            "studio.gateway_token_missing",
            "Upstream gateway token is not configured on the Studio host."
          );
          return;
        }

        // If SSH host is provided, tunnel the WebSocket through SSH
        let effectiveUrl = upstreamUrl;
        if (sshHost && perConnectionTarget) {
          try {
            const targetUrl = new URL(upstreamUrl);
            const remotePort = parseInt(targetUrl.port, 10);
            if (!remotePort) {
              sendConnectError("studio.gateway_url_invalid", "Cannot determine remote port from upstream URL.");
              return;
            }
            sshTunnel = await createSshTunnel({
              sshHost,
              sshUser,
              sshPort,
              remotePort,
              log,
              logError,
            });
            // Rewrite URL to point at local tunnel
            effectiveUrl = `ws://127.0.0.1:${sshTunnel.localPort}`;
          } catch (err) {
            logError("SSH tunnel failed.", err);
            sendConnectError(
              "studio.upstream_error",
              `SSH tunnel to ${sshHost} failed: ${err.message}`
            );
            return;
          }
        }

        let upstreamOrigin = "";
        try {
          upstreamOrigin = resolveOriginForUpstream(effectiveUrl);
        } catch {
          sendConnectError(
            "studio.gateway_url_invalid",
            "Upstream gateway URL is invalid on the Studio host."
          );
          return;
        }

        upstreamWs = new WebSocket(effectiveUrl, { origin: upstreamOrigin });

        upstreamWs.on("open", () => {
          upstreamReady = true;
          if (hasNonEmptyToken(parsed.params) || hasDeviceSignature(parsed.params)) {
            upstreamWs.send(JSON.stringify(parsed));
            return;
          }

          const connectFrame = {
            ...parsed,
            params: injectAuthToken(parsed.params, upstreamToken),
          };
          upstreamWs.send(JSON.stringify(connectFrame));
        });

        upstreamWs.on("message", (upRaw) => {
          const upParsed = safeJsonParse(String(upRaw ?? ""));
          if (upParsed && isObject(upParsed) && upParsed.type === "res") {
            const resId = typeof upParsed.id === "string" ? upParsed.id : "";
            if (resId && connectRequestId && resId === connectRequestId) {
              connectResponseSent = true;
            }
          }
          if (browserWs.readyState === WebSocket.OPEN) {
            browserWs.send(String(upRaw ?? ""));
          }
        });

        upstreamWs.on("close", (ev) => {
          const reason = typeof ev?.reason === "string" ? ev.reason : "";
          if (!connectResponseSent) {
            sendToBrowser(
              buildErrorResponse(
                connectRequestId,
                "studio.upstream_closed",
                `Upstream gateway closed (${ev.code}): ${reason}`
              )
            );
          }
          closeBoth(1012, "upstream closed");
        });

        upstreamWs.on("error", (err) => {
          logError("Upstream gateway WebSocket error.", err);
          sendConnectError(
            "studio.upstream_error",
            "Failed to connect to upstream gateway WebSocket."
          );
        });

        log("proxy connected");
        return;
      }

      if (!upstreamReady || upstreamWs.readyState !== WebSocket.OPEN) {
        closeBoth(1013, "upstream not ready");
        return;
      }

      upstreamWs.send(JSON.stringify(parsed));
    });

    browserWs.on("close", () => {
      closeBoth(1000, "client closed");
    });

    browserWs.on("error", (err) => {
      logError("Browser WebSocket error.", err);
      closeBoth(1011, "client error");
    });
  });

  const handleUpgrade = (req, socket, head) => {
    if (!allowWs(req)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  };

  return { wss, handleUpgrade };
}

module.exports = { createGatewayProxy };
