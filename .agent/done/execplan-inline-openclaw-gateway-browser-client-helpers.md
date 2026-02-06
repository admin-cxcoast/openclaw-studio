# Inline OpenClaw GatewayBrowserClient Helpers

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` in this repository.

## Purpose / Big Picture

OpenClaw Studio vendors a browser WebSocket client for the OpenClaw gateway at `src/lib/gateway/openclaw/GatewayBrowserClient.ts`. Today that one class is split across multiple tiny helper modules in the same folder (`uuid.ts`, `client-info.ts`, `device-auth*.ts`, `device-identity.ts`), but those helpers are not reused anywhere else in the repository.

This refactor consolidates the OpenClaw gateway browser client into a single file by inlining those helpers into `GatewayBrowserClient.ts` and deleting the unused helper modules. The payoff is fewer concepts and fewer files to navigate without changing any runtime behavior.

You can see it working by running unit tests and builds (they should all pass), and by verifying the `src/lib/gateway/openclaw` folder no longer contains the helper modules.

## Progress

- [x] (2026-02-06 17:45Z) Characterize the current `GatewayBrowserClient` dependency graph and strengthen the existing unit test to assert stable connect-frame fields.
- [x] (2026-02-06 17:48Z) Inline `uuid.ts`, `client-info.ts`, `device-auth.ts`, `device-auth-payload.ts`, and `device-identity.ts` into `GatewayBrowserClient.ts`, then delete the helper files.
- [x] (2026-02-06 17:49Z) Run `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build`.
- [x] (2026-02-06 17:50Z) Commit, then move this ExecPlan to `.agent/done/` with a descriptive filename.

## Surprises & Discoveries

- (none yet)

## Decision Log

- Decision: Inline the OpenClaw gateway browser client helpers into `GatewayBrowserClient.ts` and delete the helper modules.
  Rationale: The helpers are only imported by `GatewayBrowserClient.ts`, so keeping them as separate modules increases surface area (more files and exports) without providing reuse or boundary clarity.
  Date/Author: 2026-02-06 / Codex
- Decision: Widen `GatewayBrowserClientOptions.clientName` and `.mode` types to `string`.
  Rationale: After deleting `client-info.ts`, keeping those option fields as narrow string unions would either require re-exporting new helper types/constants from `GatewayBrowserClient.ts` (expanding its exports) or duplicating a large union inline. The options are not used in this repo beyond defaults, so widening preserves runtime behavior while keeping the module’s exported surface area stable.
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- Consolidated `src/lib/gateway/openclaw` down to a single `GatewayBrowserClient.ts` file by inlining UUID generation, client constants, device auth payload/signing, and localStorage token helpers.
- Deleted the now-dead helper modules (`uuid.ts`, `client-info.ts`, `device-auth*.ts`, `device-identity.ts`).
- Strengthened `tests/unit/gatewayBrowserClient.test.ts` to assert stable connect-frame fields.

Result: fewer files and concepts for the vendored OpenClaw gateway client, with no intended runtime behavior changes; lint/test/typecheck/build gates passed.

## Context and Orientation

The OpenClaw gateway transport stack in this repo looks like:

1. `src/lib/gateway/openclaw/GatewayBrowserClient.ts`: low-level browser WebSocket client that sends/receives gateway frames.
2. `src/lib/gateway/GatewayClient.ts`: higher-level wrapper used by Studio.
3. Client UI (`src/app/page.tsx`, `src/features/...`) uses `GatewayClient`.

Within `src/lib/gateway/openclaw`, `GatewayBrowserClient.ts` currently imports a handful of helpers:

- `src/lib/gateway/openclaw/uuid.ts`: `generateUUID` (request ids)
- `src/lib/gateway/openclaw/client-info.ts`: `GATEWAY_CLIENT_*` constants and normalization helpers
- `src/lib/gateway/openclaw/device-auth-payload.ts`: builds the signed device auth payload string
- `src/lib/gateway/openclaw/device-identity.ts`: device identity generation + signing helpers
- `src/lib/gateway/openclaw/device-auth.ts`: localStorage persistence for per-device auth tokens

Evidence that these helpers are not reused elsewhere (expected before starting work):

  - `tests/unit/gatewayBrowserClient.test.ts` imports only `GatewayBrowserClient`.
  - `rg -n "from \\\"@/lib/gateway/openclaw/\\\"" -S src tests` should only match the `GatewayBrowserClient` import.

## Plan of Work

First, tighten the existing `GatewayBrowserClient` unit test so it asserts a few more fields on the connect request frame. The point is to make it harder to accidentally change the connect-frame defaults while inlining helpers.

Then, move the helper code into `GatewayBrowserClient.ts`:

- Replace imports from `./uuid`, `./client-info`, `./device-auth*`, and `./device-identity` with local function/type/const declarations in the same file.
- Keep the exported surface area stable. The only public exports should remain the `GatewayBrowserClient` class and the types already exported from `GatewayBrowserClient.ts`.
- After inlining, delete the now-dead helper files listed above.

Finally, run the full gates and commit.

## Concrete Steps

All commands assume the working directory is the repo root:

  /Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio

1. Characterize the dependency graph (capture output snippets in this ExecPlan):

    rg -n \"from \\\"\\./(uuid|client-info|device-auth|device-auth-payload|device-identity)\\\"\" src/lib/gateway/openclaw/GatewayBrowserClient.ts
    rg -n \"from \\\"@/lib/gateway/openclaw/\" -S src tests

2. Strengthen the unit test at `tests/unit/gatewayBrowserClient.test.ts`:

   After parsing the sent frame, add assertions that should remain true after inlining:

   - `frame.id` is a string and matches a UUID v4 shape (a simple regex is fine).
   - `frame.params.client.id` is a string (do not hardcode every param; keep it focused).

   Run:

    npm run test -- tests/unit/gatewayBrowserClient.test.ts

3. Inline helpers:

   Edit `src/lib/gateway/openclaw/GatewayBrowserClient.ts` to include the helper code currently in:

   - `src/lib/gateway/openclaw/uuid.ts`
   - `src/lib/gateway/openclaw/client-info.ts`
   - `src/lib/gateway/openclaw/device-auth.ts`
   - `src/lib/gateway/openclaw/device-auth-payload.ts`
   - `src/lib/gateway/openclaw/device-identity.ts`

   Then delete those files.

4. Verify the folder and imports:

    ls -la src/lib/gateway/openclaw
    rg -n \"from \\\"\\./(uuid|client-info|device-auth|device-auth-payload|device-identity)\\\"\" src/lib/gateway/openclaw/GatewayBrowserClient.ts || true
    rg -n \"src/lib/gateway/openclaw/(uuid|client-info|device-auth|device-auth-payload|device-identity)\" -S src tests || true

5. Run gates:

    npm run lint
    npm run test
    npm run typecheck
    npm run build

## Validation and Acceptance

Acceptance criteria:

- Unit tests pass, including `tests/unit/gatewayBrowserClient.test.ts`.
- `npm run lint`, `npm run typecheck`, and `npm run build` succeed.
- The helper modules listed in this plan no longer exist on disk.
- No files in `src` or `tests` import the deleted helper modules.

## Idempotence and Recovery

This refactor is safe to retry:

- If TypeScript errors occur, they should be localized to `src/lib/gateway/openclaw/GatewayBrowserClient.ts`. Re-run `npm run typecheck` after each correction.
- If you accidentally changed behavior, the test strengthened in Milestone 1 should catch it. Re-run `npm run test -- tests/unit/gatewayBrowserClient.test.ts` while iterating.
- Rollback is a normal git revert of the commit for this ExecPlan.

## Artifacts and Notes

- Dependency characterization output (2026-02-06 17:44Z):

    rg -n "from \"\\./(uuid|client-info|device-auth|device-auth-payload|device-identity)\"" src/lib/gateway/openclaw/GatewayBrowserClient.ts

      1:import { generateUUID } from "./uuid";
      7:} from "./client-info";
      8:import { buildDeviceAuthPayload } from "./device-auth-payload";
      9:import { loadOrCreateDeviceIdentity, signDevicePayload } from "./device-identity";
      10:import { clearDeviceAuthToken, loadDeviceAuthToken, storeDeviceAuthToken } from "./device-auth";

    rg -n "from \"@/lib/gateway/openclaw/\"" -S src tests

      tests/unit/gatewayBrowserClient.test.ts:3:import { GatewayBrowserClient } from "@/lib/gateway/openclaw/GatewayBrowserClient";

## Interfaces and Dependencies

No new external dependencies.

The stable public API after completion:

- `src/lib/gateway/openclaw/GatewayBrowserClient.ts` continues to export `GatewayBrowserClient` and its existing exported types.
