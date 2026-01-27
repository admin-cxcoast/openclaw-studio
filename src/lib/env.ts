import { z } from "zod";

const envSchema = z.object({
  MOLTBOT_STATE_DIR: z.string().optional(),
  CLAWDBOT_STATE_DIR: z.string().optional(),
  MOLTBOT_CONFIG_PATH: z.string().optional(),
  CLAWDBOT_CONFIG_PATH: z.string().optional(),
  NEXT_PUBLIC_GATEWAY_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
