# Consolidate SSH JSON Process Execution (Single `ssh` runner)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository has an ExecPlan format and requirements documented at `.agent/PLANS.md` (from the repository root). This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

OpenClaw Studio executes commands on a gateway host via SSH in more than one place:

1. `src/lib/task-control-plane/br-runner.ts` runs `br ... --json` remotely over SSH when `OPENCLAW_TASK_CONTROL_PLANE_GATEWAY_BEADS_DIR` is configured.
2. `src/app/api/gateway/agent-state/route.ts` runs a bash script over SSH to trash/restore agent workspace/state and expects JSON output.

Both places currently invoke `ssh` via `child_process.spawnSync`, then apply the same logic:

- Use `-o BatchMode=yes`.
- Prefer `{ error }` messages from JSON-ish stdout/stderr when status is non-zero.
- Parse JSON output on success and fail fast on empty/invalid JSON.

After this change, there will be exactly one shared implementation for “run ssh, expect JSON output” in `src/lib/ssh/gateway-host.ts`. This reduces drift risk and makes future gateway-host operations reuse the same hardening.

## Progress

- [x] (2026-02-08) Add a shared `runSshJson(...)` helper to `src/lib/ssh/gateway-host.ts`.
- [x] (2026-02-08) Migrate `src/lib/task-control-plane/br-runner.ts` to use `runSshJson(...)` and delete the local SSH runner.
- [x] (2026-02-08) Migrate `src/app/api/gateway/agent-state/route.ts` to use `runSshJson(...)` and delete the local SSH runner.
- [x] (2026-02-08) Run targeted tests and full gates (`npm run test`, `npm run typecheck`, `npm run lint`).
- [ ] (2026-02-08) Move this ExecPlan to `.agent/done/` with a descriptive filename.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Put `runSshJson(...)` in `src/lib/ssh/gateway-host.ts`.
  Rationale: That file already centralizes gateway-host SSH target resolution and JSON error/output parsing. Keeping the “ssh process invocation” in the same module avoids introducing a new server-only concept/file.
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

- Consolidated all `ssh` process execution (expecting JSON output) into `runSshJson(...)` in `src/lib/ssh/gateway-host.ts`.
- Removed direct `spawnSync("ssh", ...)` usage from `src/lib/task-control-plane/br-runner.ts` and `src/app/api/gateway/agent-state/route.ts`.
- Validation: `npm run test`, `npm run typecheck`, and `npm run lint` all passed; grep for `spawnSync("ssh"` now matches only `src/lib/ssh/gateway-host.ts`.

## Context and Orientation

Relevant files:

- `src/lib/ssh/gateway-host.ts` currently exports:
  - `resolveGatewaySshTarget(...)`
  - `extractJsonErrorMessage(...)`
  - `parseJsonOutput(...)`
- `src/lib/task-control-plane/br-runner.ts` currently has a `runBrJsonViaSsh(...)` that calls `ssh` and then parses JSON output.
- `src/app/api/gateway/agent-state/route.ts` currently has a `runSshBashJson(...)` that calls `ssh bash -s` with script input and parses JSON output.

Tests that protect behavior:

- `tests/unit/taskControlPlaneRoute.test.ts` asserts remote mode calls `ssh` and the remote command string includes `br where --json`.
- `tests/unit/agentStateRoute.test.ts` asserts route calls `ssh bash -s -- ...` with script input.

## Plan of Work

### Milestone 1: Add `runSshJson(...)` To `src/lib/ssh/gateway-host.ts`

At the end of this milestone, there is one shared helper responsible for invoking `ssh` and returning parsed JSON output.

1. In `src/lib/ssh/gateway-host.ts`, add:

   - `runSshJson(params: { sshTarget: string; argv: string[]; label: string; input?: string; fallbackMessage?: string }): unknown`

   Required behavior:
   - Invoke `child_process.spawnSync("ssh", ["-o", "BatchMode=yes", sshTarget, ...argv], { encoding: "utf8", input })`.
   - If `result.error` exists, throw `Failed to execute ssh: <message>` (same as current agent-state route behavior).
   - If `result.status !== 0`, compute the error message as:
     - `extractJsonErrorMessage(stdout)` if available, else `extractJsonErrorMessage(stderr)` if available, else `stderr.trim()` if non-empty, else `stdout.trim()` if non-empty, else `fallbackMessage` if provided, else a default that includes `label`.
   - On success, return `parseJsonOutput(stdout, label)`.

2. Keep existing exports untouched.

Verification:

- Run:
  - `npm run test -- tests/unit/agentStateRoute.test.ts`
  - `npm run test -- tests/unit/taskControlPlaneRoute.test.ts`

Commit after verification with message: `Milestone 1: Add shared ssh json runner`.

### Milestone 2: Migrate `br-runner.ts` Remote Execution To Use `runSshJson(...)`

At the end of this milestone, `src/lib/task-control-plane/br-runner.ts` no longer contains a direct `spawnSync("ssh", ...)` call and no longer defines `runBrJsonViaSsh(...)`.

1. In `src/lib/task-control-plane/br-runner.ts`:
   - Import `runSshJson` from `src/lib/ssh/gateway-host.ts`.
   - Replace the body of remote execution to call:
     - `runSshJson({ sshTarget, argv: [remoteCommandString], label: \`br ${command.join(" ")} --json\`, fallbackMessage: \`Command failed: ssh ${sshTarget} <br>\` })`
   - Delete `runBrJsonViaSsh(...)`.

Verification:

- Run:
  - `npm run test -- tests/unit/taskControlPlaneRoute.test.ts`
  - `npm run test -- tests/unit/taskControlPlaneShowRoute.test.ts`
  - `npm run test -- tests/unit/taskControlPlanePriorityRoute.test.ts`

Commit after verification with message: `Milestone 2: Reuse shared ssh runner in br runner`.

### Milestone 3: Migrate Agent State Route To Use `runSshJson(...)`

At the end of this milestone, `src/app/api/gateway/agent-state/route.ts` no longer calls `child_process.spawnSync("ssh", ...)` directly and no longer defines `runSshBashJson(...)`.

1. In `src/app/api/gateway/agent-state/route.ts`:
   - Import `runSshJson` from `src/lib/ssh/gateway-host.ts`.
   - Replace `runSshBashJson(...)` usage with:
     - `runSshJson({ sshTarget, argv: ["bash", "-s", "--", ...args], input: script, label, fallbackMessage: \`Command failed (${label}).\` })`
   - Delete `runSshBashJson(...)`.

Verification:

- Run:
  - `npm run test -- tests/unit/agentStateRoute.test.ts`

Commit after verification with message: `Milestone 3: Reuse shared ssh runner in agent state route`.

### Milestone 4: Full Validation + Drift Check

1. Run:
   - `npm run test`
   - `npm run typecheck`
   - `npm run lint`

2. Drift checks:
   - `rg -n "spawnSync\\(\\s*\\\"ssh\\\"|spawnSync\\(\\s*'ssh'" src` should match only `src/lib/ssh/gateway-host.ts`.

If Milestone 4 does not introduce code changes beyond verification, do not create an extra commit just to satisfy the milestone; instead, record the validation outcome in `Outcomes & Retrospective`.

### Milestone 5: Archive The ExecPlan

Move `.agent/execplan-pending.md` to `.agent/done/execplan-consolidate-ssh-json-process-execution.md` (or similarly descriptive name).

Commit the done ExecPlan file if the repository convention is to track `.agent/done/*`.

## Concrete Steps

All commands should be run from the repository root:

  cd /Users/georgepickett/openclaw-studio

Suggested order:

1. Edit `src/lib/ssh/gateway-host.ts` to add `runSshJson(...)`.
2. Run:
   - `npm run test -- tests/unit/agentStateRoute.test.ts`
   - `npm run test -- tests/unit/taskControlPlaneRoute.test.ts`
3. Update `src/lib/task-control-plane/br-runner.ts` to use `runSshJson(...)`.
4. Run:
   - `npm run test -- tests/unit/taskControlPlaneRoute.test.ts`
   - `npm run test -- tests/unit/taskControlPlaneShowRoute.test.ts`
   - `npm run test -- tests/unit/taskControlPlanePriorityRoute.test.ts`
5. Update `src/app/api/gateway/agent-state/route.ts` to use `runSshJson(...)`.
6. Run:
   - `npm run test -- tests/unit/agentStateRoute.test.ts`
7. Run full gates:
   - `npm run test`
   - `npm run typecheck`
   - `npm run lint`
8. Run drift check:
   - `rg -n \"spawnSync\\(\\s*\\\"ssh\\\"|spawnSync\\(\\s*'ssh'\" src`

## Validation and Acceptance

Acceptance is satisfied when:

1. `npm run test` passes.
2. `npm run typecheck` passes.
3. `npm run lint` passes.
4. Only `src/lib/ssh/gateway-host.ts` contains `spawnSync("ssh", ...)` (no other server code directly spawns ssh).
5. Existing task control plane and agent state route tests continue to assert the same `ssh` argv shape.

## Idempotence and Recovery

This is a refactor-only change. If unit tests fail due to small differences in `ssh` argv ordering or fallback error message text, prioritize matching the current behavior exactly over introducing new fallback paths.

## Artifacts and Notes

Files expected to change:

- `src/lib/ssh/gateway-host.ts`
- `src/lib/task-control-plane/br-runner.ts`
- `src/app/api/gateway/agent-state/route.ts`
