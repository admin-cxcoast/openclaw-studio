# Consolidate Cron Selectors Into `src/lib/cron/types.ts`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan requirements live at `.agent/PLANS.md` and this document must be maintained in accordance with it.

## Purpose / Big Picture

The cron domain currently spans three small modules under `src/lib/cron/`: `types.ts`, `gateway.ts`, and `selectors.ts`. `src/lib/cron/selectors.ts` is a tiny pure helper module (two functions) and is only imported by `src/app/page.tsx` and one unit test file.

After this change, those pure selector helpers live alongside the cron types in `src/lib/cron/types.ts`, and `src/lib/cron/selectors.ts` is deleted. This removes an unnecessary file-level concept from a small domain, reducing surface area and making it easier to understand “where cron stuff lives”.

You can see this working by running `npm test` and by confirming there are no remaining imports of `@/lib/cron/selectors`.

## Mental Model (Repo Slice)

Core cron concept locations:

- Cron type shapes: `src/lib/cron/types.ts` (for example `CronJobSummary`)
- Cron gateway calls: `src/lib/cron/gateway.ts` (for example `cron.list`, `cron.run`)
- Cron selectors (to remove): `src/lib/cron/selectors.ts` (pure filtering/sorting helpers)

Dependency highlights:

- `src/app/page.tsx` consumes cron types + gateway calls + selectors.
- Unit tests cover cron gateway client and selectors separately.

Smell:

- Thin wrapper module: `src/lib/cron/selectors.ts` is two pure functions, used in only one production file. The extra module boundary adds a concept without proportional benefit.

## Candidate Refactors Ranked

Scores: 1 (low) to 5 (high). For Blast radius, higher means smaller/safer.

| Candidate | Payoff (30%) | Blast Radius (25%) | Cognitive Load (20%) | Velocity Unlock (15%) | Validation / Rollback (10%) | Weighted |
|---|---:|---:|---:|---:|---:|---:|
| Delete `src/lib/cron/selectors.ts` by moving helpers into `src/lib/cron/types.ts` | 3 | 5 | 3 | 2 | 5 | 3.55 |
| Delete `src/features/agents/state/agentSessionActions.ts` by moving its function into `store.tsx` | 3 | 4 | 3 | 2 | 5 | 3.25 |
| Delete redundant unit test file that only repeats `buildAgentInstruction` assertions | 1 | 5 | 2 | 1 | 5 | 2.25 |

## Proposed Change (The Call)

Consolidate cron selectors into `src/lib/cron/types.ts` and delete `src/lib/cron/selectors.ts`.

### Current State

- `src/lib/cron/selectors.ts` exports:
  - `filterCronJobsForAgent(jobs, agentId)`
  - `resolveLatestCronJobForAgent(jobs, agentId)`
- Callers:
  - `src/app/page.tsx`
  - `tests/unit/cronSelectors.test.ts`

### Proposed State

- `src/lib/cron/types.ts` exports those two functions in addition to the existing types.
- `src/lib/cron/selectors.ts` is removed.
- All imports update to `@/lib/cron/types`.

### Files Impacted

- `src/lib/cron/types.ts`
- `src/lib/cron/selectors.ts` (delete)
- `src/app/page.tsx`
- `tests/unit/cronSelectors.test.ts`

### Expected Outcome

The cron domain has one fewer file, and “how to filter/select cron jobs” is colocated with the type shapes it operates on.

### Acceptance Criteria

1. `src/lib/cron/selectors.ts` does not exist.
2. `rg -n "@/lib/cron/selectors" src tests` returns no results.
3. `npm run typecheck`, `npm run lint`, and `npm test` all pass.

### Risks and Mitigations

- Risk: accidental behavior change in the selector helpers.
  Mitigation: copy the function bodies exactly and rely on existing unit tests in `tests/unit/cronSelectors.test.ts`.

## Progress

- [x] (2026-02-06 04:21Z) Milestone 1: Moved selector helpers into `src/lib/cron/types.ts`, updated `src/app/page.tsx` import, and verified `npm run typecheck` passes.
- [x] (2026-02-06 04:21Z) Milestone 2: Updated `tests/unit/cronSelectors.test.ts`, deleted `src/lib/cron/selectors.ts`, and verified `rg -n "@/lib/cron/selectors" src tests` has no hits; `npm run lint` and `npm test` pass.

## Surprises & Discoveries

- No surprises.

## Decision Log

- Decision: Consolidate cron selectors into `src/lib/cron/types.ts` and delete `src/lib/cron/selectors.ts`.
  Rationale: The selectors module is tiny and has only one production caller; deleting it removes a file-level concept with minimal blast radius and clear test coverage.
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- Cron domain now has one fewer module. The selector helpers are colocated with the types they operate on, and the repo no longer imports `@/lib/cron/selectors`.

## Plan of Work

### Milestone 1: Move Functions + Update Prod Import

1. In `src/lib/cron/types.ts`, add the two exported functions from `src/lib/cron/selectors.ts`:

   - `filterCronJobsForAgent`
   - `resolveLatestCronJobForAgent`

   Keep the logic identical (including trimming behavior and sorting by `updatedAtMs`).

2. In `src/app/page.tsx`, replace:

   - `import { filterCronJobsForAgent, resolveLatestCronJobForAgent } from "@/lib/cron/selectors";`

   with an import from `@/lib/cron/types`.

3. Run:

   - `npm run typecheck`

### Milestone 2: Update Tests + Delete File

1. In `tests/unit/cronSelectors.test.ts`, update imports:

   - Import the selector helpers from `@/lib/cron/types` instead of `@/lib/cron/selectors`.
   - Keep `CronJobSummary` type import as-is (it already comes from `@/lib/cron/types`).

2. Delete `src/lib/cron/selectors.ts`.

3. Validate:

   - `rg -n "@/lib/cron/selectors" src tests` (expect no hits)
   - `npm run lint`
   - `npm test`

## Concrete Steps

From repo root:

1. `rg -n "@/lib/cron/selectors" src tests`
2. Implement Milestone 1 edits.
3. `npm run typecheck`
4. Implement Milestone 2 edits.
5. `rg -n "@/lib/cron/selectors" src tests`
6. `npm run lint`
7. `npm test`

## Validation and Acceptance

This work is accepted when:

- The selector file is gone and no code imports it.
- Typecheck, lint, and tests pass.

## Idempotence and Recovery

This change is safe to retry.

If anything breaks unexpectedly:

- Restore `src/lib/cron/selectors.ts` and revert imports to it.
- Re-run `npm test` to confirm the rollback.
