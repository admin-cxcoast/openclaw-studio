export const resolveStudioProxyGatewayUrl = (
  target?: string,
  ssh?: { host: string; user?: string; port?: number },
): string => {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  const base = `${protocol}://${host}/api/gateway/ws`;
  if (target) {
    const params = new URLSearchParams({ target });
    if (ssh?.host) {
      params.set("sshHost", ssh.host);
      if (ssh.user) params.set("sshUser", ssh.user);
      if (ssh.port && ssh.port !== 22) params.set("sshPort", String(ssh.port));
    }
    return `${base}?${params.toString()}`;
  }
  return base;
};
