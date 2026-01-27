type GatewayConfig = {
  gatewayUrl: string;
  token: string;
};

export const resolveGatewayConfig = (config: Record<string, unknown>): GatewayConfig => {
  const gateway = (config.gateway ?? {}) as Record<string, unknown>;
  const port = typeof gateway.port === "number" ? gateway.port : 18789;
  const host =
    typeof gateway.host === "string" && gateway.host.trim()
      ? gateway.host.trim()
      : "127.0.0.1";
  const auth = (gateway.auth ?? {}) as Record<string, unknown>;
  const token = typeof auth.token === "string" ? auth.token : "";
  return { gatewayUrl: `ws://${host}:${port}`, token };
};
