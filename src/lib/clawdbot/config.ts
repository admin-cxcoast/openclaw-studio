import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { env } from "@/lib/env";

type ClawdbotConfig = Record<string, unknown>;

type AgentEntry = {
  id: string;
  name?: string;
  workspace?: string;
};

const LEGACY_STATE_DIRNAME = ".clawdbot";
const NEW_STATE_DIRNAME = ".moltbot";
const CONFIG_FILENAME = "moltbot.json";

const resolveUserPath = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
};

const resolveStateDir = () => {
  const raw = env.MOLTBOT_STATE_DIR ?? env.CLAWDBOT_STATE_DIR;
  if (raw?.trim()) {
    return resolveUserPath(raw);
  }
  return path.join(os.homedir(), LEGACY_STATE_DIRNAME);
};

const resolveConfigPathCandidates = () => {
  const explicit = env.MOLTBOT_CONFIG_PATH ?? env.CLAWDBOT_CONFIG_PATH;
  if (explicit?.trim()) {
    return [resolveUserPath(explicit)];
  }
  const candidates: string[] = [];
  if (env.MOLTBOT_STATE_DIR?.trim()) {
    candidates.push(path.join(resolveUserPath(env.MOLTBOT_STATE_DIR), CONFIG_FILENAME));
  }
  if (env.CLAWDBOT_STATE_DIR?.trim()) {
    candidates.push(path.join(resolveUserPath(env.CLAWDBOT_STATE_DIR), CONFIG_FILENAME));
  }
  candidates.push(path.join(os.homedir(), NEW_STATE_DIRNAME, CONFIG_FILENAME));
  candidates.push(path.join(os.homedir(), LEGACY_STATE_DIRNAME, CONFIG_FILENAME));
  return candidates;
};

const parseJsonLoose = (raw: string) => {
  try {
    return JSON.parse(raw) as ClawdbotConfig;
  } catch {
    const cleaned = raw.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(cleaned) as ClawdbotConfig;
  }
};

export const loadClawdbotConfig = (): { config: ClawdbotConfig; configPath: string } => {
  const candidates = resolveConfigPathCandidates();
  const fallbackPath = path.join(resolveStateDir(), CONFIG_FILENAME);
  const configPath = candidates.find((candidate) => fs.existsSync(candidate)) ?? fallbackPath;
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing config at ${configPath}.`);
  }
  const raw = fs.readFileSync(configPath, "utf8");
  return { config: parseJsonLoose(raw), configPath };
};

export const saveClawdbotConfig = (configPath: string, config: ClawdbotConfig) => {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
};

const readAgentList = (config: ClawdbotConfig): AgentEntry[] => {
  const agents = (config.agents ?? {}) as Record<string, unknown>;
  const list = Array.isArray(agents.list) ? agents.list : [];
  return list.filter((entry): entry is AgentEntry => Boolean(entry && typeof entry === "object"));
};

const writeAgentList = (config: ClawdbotConfig, list: AgentEntry[]) => {
  const agents = (config.agents ?? {}) as Record<string, unknown>;
  agents.list = list;
  config.agents = agents;
};

export const upsertAgentEntry = (
  config: ClawdbotConfig,
  entry: { agentId: string; agentName: string; workspaceDir: string }
): boolean => {
  const list = readAgentList(config);
  let changed = false;
  let found = false;
  const next = list.map((item) => {
    if (item.id !== entry.agentId) return item;
    found = true;
    const nextItem: AgentEntry = { ...item };
    if (entry.agentName && entry.agentName !== item.name) {
      nextItem.name = entry.agentName;
      changed = true;
    }
    if (entry.workspaceDir !== item.workspace) {
      nextItem.workspace = entry.workspaceDir;
      changed = true;
    }
    return nextItem;
  });
  if (!found) {
    next.push({ id: entry.agentId, name: entry.agentName, workspace: entry.workspaceDir });
    changed = true;
  }
  if (changed) {
    writeAgentList(config, next);
  }
  return changed;
};

export const renameAgentEntry = (
  config: ClawdbotConfig,
  entry: { fromAgentId: string; toAgentId: string; agentName: string; workspaceDir: string }
): boolean => {
  const list = readAgentList(config);
  let changed = false;
  let found = false;
  const next = list.map((item) => {
    if (item.id !== entry.fromAgentId) return item;
    found = true;
    const nextItem: AgentEntry = { ...item, id: entry.toAgentId };
    if (entry.agentName && entry.agentName !== item.name) {
      nextItem.name = entry.agentName;
    }
    if (entry.workspaceDir !== item.workspace) {
      nextItem.workspace = entry.workspaceDir;
    }
    changed = true;
    return nextItem;
  });
  if (!found) {
    next.push({ id: entry.toAgentId, name: entry.agentName, workspace: entry.workspaceDir });
    changed = true;
  }
  if (changed) {
    writeAgentList(config, next);
  }
  return changed;
};

export const removeAgentEntry = (config: ClawdbotConfig, agentId: string): boolean => {
  const list = readAgentList(config);
  const next = list.filter((item) => item.id !== agentId);
  if (next.length === list.length) return false;
  writeAgentList(config, next);
  return true;
};
