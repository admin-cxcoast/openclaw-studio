# Consolidate cron gateway helpers into cron types module

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository uses `.agent/PLANS.md` to define ExecPlan requirements. Maintain this plan in accordance with `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio/.agent/PLANS.md`.

## Purpose / Big Picture

Cron support is split across two modules:

- `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio/src/lib/cron/types.ts` contains the cron type shapes plus selector helpers used by the UI.
- `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio/src/lib/cron/gateway.ts` contains a small set of `GatewayClient.call(...)` wrappers for `cron.list`, `cron.run`, and `cron.remove`.

The split adds an extra concept and import surface area for little benefit. After this change, all cron-related types, selectors, and gateway-call helpers live in one module (`src/lib/cron/types.ts`), and `src/lib/cron/gateway.ts` is removed.

You can see it working by running the existing unit tests that exercise the cron gateway wrappers and selectors; they should continue to pass, but import from the consolidated module.

## Progress

- [x] (2026-02-06 18:03Z) Add failing coverage (if needed) around cron gateway helper exports from `src/lib/cron/types.ts` (not needed; existing unit tests cover behavior).
- [x] (2026-02-06 18:03Z) Move cron gateway wrapper exports from `src/lib/cron/gateway.ts` into `src/lib/cron/types.ts`.
- [x] (2026-02-06 18:03Z) Update cron gateway call sites to import from `@/lib/cron/types`.
- [x] (2026-02-06 18:03Z) Delete `src/lib/cron/gateway.ts` and ensure no remaining imports.
- [x] (2026-02-06 18:04Z) Run gates: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- [x] (2026-02-06 18:04Z) Update `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio/ARCHITECTURE.md` to reflect the consolidated cron module.
- [x] (2026-02-06 18:04Z) Commit with a focused message for the refactor.
- [x] (2026-02-06 18:05Z) Move this ExecPlan to `.agent/done/` with a descriptive name and commit that doc move.

## Surprises & Discoveries

- (none yet)

## Decision Log

- Decision: Consolidate by moving gateway helpers into `src/lib/cron/types.ts` rather than renaming the module path.
  Rationale: This keeps the blast radius minimal (no path changes for existing type-only imports) while still deleting a whole module.
  Date/Author: 2026-02-06 / codex

## Outcomes & Retrospective

- Consolidated cron types, selectors, and gateway-call helpers into one module (`src/lib/cron/types.ts`) and deleted `src/lib/cron/gateway.ts`.
- Updated the only call sites (`src/app/page.tsx`, `tests/unit/cronGatewayClient.test.ts`) to import from the consolidated module.
- Verified behavior via `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.

## Context and Orientation

Relevant files:

- `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio/src/lib/cron/types.ts`: cron type shapes (`CronJobSummary`, schedules, payload types) and selector helpers (`filterCronJobsForAgent`, `resolveLatestCronJobForAgent`).
- `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio/src/lib/cron/gateway.ts`: gateway-call helper functions (`listCronJobs`, `runCronJobNow`, `removeCronJob`, `removeCronJobsForAgent`) plus a couple of small `trim()` validation helpers.
- `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio/src/app/page.tsx`: imports both cron selectors and gateway helpers.
- `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio/tests/unit/cronGatewayClient.test.ts`: exercises the cron gateway helper functions by spying on `GatewayClient.call`.

The `GatewayClient` in this repo is a typed wrapper around a WebSocket RPC call API, and the cron helpers are simply thin wrappers around `client.call("cron.*", payload)`.

## Plan of Work

1. Update `src/lib/cron/types.ts` to export the cron gateway helper types and functions currently living in `src/lib/cron/gateway.ts`.
2. Update all call sites to import cron gateway helpers from `@/lib/cron/types`.
3. Delete `src/lib/cron/gateway.ts`.
4. Run the full test/lint/typecheck/build gates to ensure this is behavior-preserving.
5. Update `ARCHITECTURE.md` to reflect that cron helpers live in `src/lib/cron/types.ts`.
6. Commit the refactor, then archive this ExecPlan by moving it into `.agent/done/`.

## Concrete Steps

From `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio`:

1. Confirm import sites:

   - `rg -n "lib/cron/gateway" -S src tests`

2. Move exports into `src/lib/cron/types.ts` and update imports in:

   - `src/app/page.tsx`
   - `tests/unit/cronGatewayClient.test.ts`

3. Delete `src/lib/cron/gateway.ts`.

4. Run:

   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`

5. Update `ARCHITECTURE.md` to reflect the cron module consolidation.

6. Commit the refactor.

7. Move `.agent/execplan-pending.md` to `.agent/done/execplan-consolidate-cron-gateway-into-types.md` and commit that move.

## Validation and Acceptance

Acceptance means:

1. There is no `src/lib/cron/gateway.ts` module, and no imports reference it.
2. Cron gateway helper functions (`listCronJobs`, `runCronJobNow`, `removeCronJob`, `removeCronJobsForAgent`) are exported from `src/lib/cron/types.ts`.
3. Existing unit tests still pass, including `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio/tests/unit/cronGatewayClient.test.ts`.
4. `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` all succeed.

## Idempotence and Recovery

- The refactor is intended to be behavior-preserving. If anything goes wrong, revert the commit(s) for this change.
- Re-running the gates is safe and should be used to validate the repo is healthy after edits.

## Artifacts and Notes

- (add short gate output snippets if something surprising happens)

## Interfaces and Dependencies

At the end, `src/lib/cron/types.ts` must export (signatures as currently used by callers/tests):

- `listCronJobs(client: GatewayClient, params?: { includeDisabled?: boolean }): Promise<{ jobs: CronJobSummary[] }>`
- `runCronJobNow(client: GatewayClient, jobId: string): Promise<{ ok: true; ran: true } | { ok: true; ran: false; reason: "not-due" } | { ok: false }>`
- `removeCronJob(client: GatewayClient, jobId: string): Promise<{ ok: true; removed: boolean } | { ok: false; removed: false }>`
- `removeCronJobsForAgent(client: GatewayClient, agentId: string): Promise<number>`
