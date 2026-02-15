![Home screen](home-screen.png)

# OpenClaw Studio

[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/VEpdKJ9e)

OpenClaw Studio is a multi-tenant Next.js platform for managing OpenClaw agents, AI providers, skills, infrastructure, and knowledge — powered by Convex for real-time persistence and the OpenClaw Gateway for agent runtime.

## Features

- **Agent management**: fleet sidebar, chat interface, brain file editing, cron jobs, model/thinking controls.
- **Admin panel**: manage users, organizations, AI providers, model catalog, skills, VPS instances, and system settings.
- **Skill catalog**: import skills from GitHub repos, manage env keys, dependencies, and runtime detection. Plan-based availability.
- **AI provider management**: configure providers (Anthropic, OpenAI, Google, ElevenLabs, etc.), test API keys, sync model catalogs.
- **VPS & gateway management**: track VPS instances, discover gateways via SSH scanning, deploy new instances, manage org quotas.
- **Knowledge base**: org-scoped entries with full-text search. Agent-proposed knowledge with approval workflow.
- **Document management**: org-scoped documents with file attachments and full-text search.
- **Multi-tenant**: organizations with plans (free/starter/pro/enterprise), roles, and resource quotas.
- **Real-time**: Convex reactive database pushes live updates to all connected clients.

## How Studio Connects (Read This If You Use A Phone / Remote Host)

There are **two separate connections** involved:

1. **Your browser -> Studio** (HTTP) at `http://<studio-host>:3000`
2. **Your browser -> OpenClaw Gateway** (WebSocket) at the configured **Gateway URL**

Important consequences:
- The Gateway connection is made **from the browser**, not from the machine running `next dev`.
- `ws://localhost:18789` (or `ws://127.0.0.1:18789`) means "connect to a gateway on the same device as the browser".
  - If you open Studio on your phone, `localhost` and `127.0.0.1` are your phone, not your laptop/server.
- Studio **persists** the Gateway URL/token under `~/.openclaw/openclaw-studio/settings.json`. Once set in the UI, this will be used on future runs and will override the default `NEXT_PUBLIC_GATEWAY_URL`.
- If Studio is served over `https://`, the Gateway URL must be `wss://...` (browsers block `ws://` from `https://` pages).

## Requirements

- Node.js 18+ (LTS recommended)
- OpenClaw Gateway running (local or remote)
- Convex account (free tier) for database
- Tailscale (optional, recommended for tailnet access)

## Quick start

### Start the gateway (required)

If you don't already have OpenClaw installed:
```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

Start a gateway (foreground):
```bash
openclaw gateway run --bind loopback --port 18789 --verbose
```

Helpful checks:
```bash
openclaw gateway probe
openclaw config get gateway.auth.token
```

### Tailnet access via Tailscale Serve (recommended)

Most people keep the gateway bound to loopback and use Tailscale Serve on the gateway host.

On the gateway host:
```bash
openclaw config set gateway.tailscale.mode serve
openclaw config set gateway.auth.mode token
```

Restart your gateway. Then:
```bash
tailscale serve status
```

Take the HTTPS URL from `tailscale serve status` and convert it to a WebSocket URL for Studio:
- `https://gateway-host.your-tailnet.ts.net` -> `wss://gateway-host.your-tailnet.ts.net`

### Install + run Studio (recommended)
```bash
npx -y openclaw-studio@latest
cd openclaw-studio
npm run dev
```

Open http://localhost:3000 and set:
- Token: `openclaw config get gateway.auth.token`
- Gateway URL: `wss://gateway-host.your-tailnet.ts.net` (tailnet via `tailscale serve`)
- Gateway URL: `ws://localhost:18789` (local gateway)
- Gateway URL: `ws://your-host:18789` (direct remote port, no `tailscale serve`)

Notes:
- If Studio is served over `https://`, the gateway URL must be `wss://...` (browsers block `ws://` from `https://` pages).
- If you browse Studio from another device (phone/tablet), do not use `ws://localhost:18789` unless the gateway is running on that device. Use a reachable host (LAN IP/DNS), `wss://...` via Tailscale Serve, or an SSH tunnel.

### SSH tunneling (alternative)

If you prefer SSH tunneling to a remote host:
```bash
ssh -L 18789:127.0.0.1:18789 user@your-host
```
Then connect Studio to `ws://localhost:18789`.

### Install (manual)
```bash
git clone https://github.com/grp06/openclaw-studio.git
cd openclaw-studio
npm install
npm run dev
```

### Convex setup

Studio uses Convex as its primary database. To set up:

```bash
npx convex dev
```

This will prompt you to create a Convex project and generate `.env.local` with `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`.

Run Convex dev server alongside Next.js:
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:convex
```

## Configuration

Paths and key settings:
- OpenClaw config: `~/.openclaw/openclaw.json` (or `OPENCLAW_CONFIG_PATH` / `OPENCLAW_STATE_DIR`)
- Studio settings: `~/.openclaw/openclaw-studio/settings.json`
- Convex config: `.env.local` (`CONVEX_DEPLOYMENT` + `NEXT_PUBLIC_CONVEX_URL`)
- Default gateway URL: `ws://localhost:18789` (override via Studio Settings or `NEXT_PUBLIC_GATEWAY_URL`)

### Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL |
| `NEXT_PUBLIC_GATEWAY_URL` | Default gateway WebSocket URL |
| `STUDIO_UPSTREAM_GATEWAY_URL` | Server-side gateway URL override |
| `STUDIO_UPSTREAM_GATEWAY_TOKEN` | Server-side gateway token override |
| `STUDIO_ACCESS_TOKEN` | Optional access gate token |

## Admin panel

The admin panel at `/admin` provides platform management for super admins:

- **Users**: create users, assign roles, manage org memberships.
- **Organizations**: create orgs with plans, manage settings and quotas.
- **Providers**: add AI providers (Anthropic, OpenAI, Google, ElevenLabs, etc.), configure API keys, test connectivity.
- **Models**: browse and sync model catalog from provider APIs, manage capabilities metadata.
- **Skills**: import from GitHub repos, manage env keys and dependencies, enable/disable per plan.
- **VPS**: track servers, sync from Hostinger, configure SSH access, discover gateway instances.
- **Settings**: manage system-wide configuration by category.

## Skills

Skills are imported from GitHub repositories containing `SKILL.md` files:

```bash
# In the admin panel, use "Import from GitHub" with a repo URL like:
https://github.com/openclaw/skills
https://github.com/anthropics/skills
```

Skills support:
- **Categories**: `mcp` (tool servers), `prompt` (instruction guides), `workflow` (multi-step chains).
- **Runtime detection**: automatically infers `node`/`python`/`none` from metadata and content patterns.
- **Environment keys**: declared in metadata or discovered from content `export` patterns.
- **Dependencies**: extracted from metadata `install` entries and body `npm install`/`pip install` patterns.
- **Plan gating**: skills can be restricted to specific org plans.

## Cron jobs in Agent Settings

- Open an agent and go to **Settings -> Cron jobs**.
- If no jobs exist, use the empty-state **Create** button.
- If jobs already exist, use the header **Create** button.
- The modal is agent-scoped and walks through template selection, task text, schedule, and review.
- Submitting creates the job via gateway `cron.add` and refreshes that same agent's cron list.

## Troubleshooting

- **Missing config**: Run `openclaw onboard` or set `OPENCLAW_CONFIG_PATH`
- **Gateway unreachable**: Confirm the gateway is running and `NEXT_PUBLIC_GATEWAY_URL` matches
- **Auth errors**: Studio currently prompts for a token. Check `gateway.auth.mode` is `token` and `gateway.auth.token` is set in `openclaw.json` (or run `openclaw config get gateway.auth.token`).
- **Secure-context connect errors** (for example `INVALID_REQUEST ... control ui requires HTTPS or localhost (secure context)`): use `ws://localhost:18789` for local gateways instead of `ws://127.0.0.1:18789`, or use `wss://...` when connecting over HTTPS.
- **UI loads but no agents show up** (common when browsing from a phone):
  - Check the Gateway URL shown in Studio. If it is `ws://localhost:18789`, that will only work when browsing Studio on the same machine running the gateway (or via an SSH tunnel).
  - If you set a Gateway URL once, it is persisted in `~/.openclaw/openclaw-studio/settings.json`. Update it in the UI (or delete/reset the file) if you moved hosts.
- **Convex errors**: Ensure `npx convex dev` is running and `.env.local` contains valid `NEXT_PUBLIC_CONVEX_URL`.
- **Still stuck**: Run `npx -y openclaw-studio@latest doctor --check` (and `--fix --force-settings` to safely rewrite Studio settings).

## Architecture

See `ARCHITECTURE.md` for details on modules, data flow, Convex schema, and design decisions.

## Tech stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, Lucide icons
- **Backend**: Convex (reactive database, auth, server functions)
- **Agent runtime**: OpenClaw Gateway (WebSocket)
- **Auth**: @convex-dev/auth with password provider
- **Infrastructure**: Custom Node server with WebSocket proxy, SSH-based VPS management
- **Testing**: Vitest (unit), Playwright (e2e)
