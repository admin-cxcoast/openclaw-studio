# Consolidate Message Helpers Into `src/lib/text/message-extract.ts`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan requirements live at `.agent/PLANS.md` and this document must be maintained in accordance with it.

## Purpose / Big Picture

Right now the code that turns gateway chat payloads into displayable text is split across two modules: `src/lib/text/message-extract.ts` (extracting visible text, thinking blocks, tool lines) and `src/lib/text/message-metadata.ts` (stripping Studio-injected “Project path:” prefixes, detecting heartbeat prompts, normalizing user instructions).

This split increases cognitive load in the two hottest call sites (`src/app/page.tsx` and `src/features/agents/state/runtimeEventBridge.ts`) because message handling is never “just one import”; it is always “extract + metadata”. After this change, all message parsing and message normalization helpers live in one place (`src/lib/text/message-extract.ts`) and the standalone module `src/lib/text/message-metadata.ts` is deleted.

You can see this working by running unit tests (they should still pass), and by starting the dev server and verifying the focused agent view still:

- Strips the Studio UI metadata prefix from messages.
- Does not treat normal messages as metadata prefixes.
- Continues to suppress heartbeat prompt noise in history lines.

## Progress

- [x] (2026-02-06 04:12Z) Wrote ExecPlan with evidence-backed recommendation. 
- [x] (2026-02-06 04:20Z) Milestone 1: moved metadata helpers into `src/lib/text/message-extract.ts`, updated `src/` imports, deleted `src/lib/text/message-metadata.ts`. 
- [x] (2026-02-06 04:21Z) Milestone 2: updated unit tests to import from `@/lib/text/message-extract`, moved metadata assertions into `tests/unit/messageExtract.test.ts`, deleted `tests/unit/messageMetadata.test.ts`. 
- [x] (2026-02-06 04:22Z) Installed dependencies (`npm install`) so validation commands are available.
- [x] (2026-02-06 04:23Z) Verified `npm run typecheck`, `npm run lint`, and `npm test` pass; `rg -n "message-metadata" src tests` has no hits.

## Surprises & Discoveries

- `npm test` failed because `vitest` was not installed in this environment (`sh: vitest: command not found`). We need to run `npm install` (or `npm ci`) before running validation steps.
- `npm install` reported 1 high severity vulnerability; not addressed as part of this refactor-only plan.

## Decision Log

- Decision: Consolidate `src/lib/text/message-metadata.ts` into `src/lib/text/message-extract.ts` and delete the metadata module.
  Rationale: The helpers are always used alongside extract helpers (same call sites), and the split adds a second concept and extra imports without a clear boundary. Deleting the file removes a concept and reduces surface area with a small blast radius.
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- Consolidated the message parsing helpers into a single module (`src/lib/text/message-extract.ts`) and removed the extra concept (`src/lib/text/message-metadata.ts`), with updated unit coverage and passing checks.

## Context and Orientation

Key files involved:

- `src/lib/text/message-extract.ts`: Extracts displayable text from gateway message payloads. Used by the focused agent UI and runtime event bridge for transcript/history rendering.
- `src/lib/text/message-metadata.ts`: Contains helpers that strip Studio-injected metadata (for example “Project path:” blocks), plus `buildAgentInstruction` used when sending user prompts.
- `src/app/page.tsx`: Main client page. Imports both extract and metadata helpers today.
- `src/features/agents/state/runtimeEventBridge.ts`: Normalizes gateway frames into agent store patches. Imports both extract and metadata helpers today.

Evidence of the split:

- `src/app/page.tsx` imports `extractText` from `src/lib/text/message-extract.ts` and also imports `buildAgentInstruction`, `stripUiMetadata`, `isUiMetadataPrefix`, `isHeartbeatPrompt` from `src/lib/text/message-metadata.ts`.
- `src/features/agents/state/runtimeEventBridge.ts` imports from both modules as well.
- Unit coverage exists in `tests/unit/messageExtract.test.ts`, `tests/unit/messageHelpers.test.ts`, and `tests/unit/messageMetadata.test.ts`.

Non-obvious term definitions used below:

- “UI metadata” in this repo means the Studio-injected prefixes such as “Project path:” or “Workspace path:” and “A new session was started via /new or /reset …” which are not meant to be shown to the user as chat content. These are stripped by `stripUiMetadata`.

## Plan of Work

### Milestone 1: Consolidate exports and delete `message-metadata`

Goal: remove the separate “message metadata” concept by moving its exports into `src/lib/text/message-extract.ts`, then updating call sites to import from `message-extract` only.

Work:

1. In `src/lib/text/message-extract.ts`, add the following exports, copying their implementations from `src/lib/text/message-metadata.ts`:
   - `buildAgentInstruction`
   - `stripUiMetadata`
   - `isHeartbeatPrompt`
   - `isUiMetadataPrefix`

   Keep the semantics identical (same regexes, same trimming rules). Do not add new behavior.

2. Update imports:
   - In `src/app/page.tsx`, replace the import from `@/lib/text/message-metadata` with imports from `@/lib/text/message-extract`.
   - In `src/features/agents/state/runtimeEventBridge.ts`, replace the import from `@/lib/text/message-metadata` with imports from `@/lib/text/message-extract`.

3. Delete `src/lib/text/message-metadata.ts`.

Verification:

- Run `rg -n "message-metadata" src tests` and expect no results.
- Run `npm run typecheck` and expect success.

Commit:

- Commit with message: `Milestone 1: Consolidate message metadata helpers`

### Milestone 2: Consolidate/update unit tests

Goal: keep unit coverage intact while removing the deleted module from tests.

Work:

1. Update unit tests to import the moved functions from `@/lib/text/message-extract`:
   - `tests/unit/messageHelpers.test.ts`: update the `buildAgentInstruction` import.

2. Remove the now-redundant `tests/unit/messageMetadata.test.ts` by moving its single assertion into an existing test file:
   - Prefer `tests/unit/messageExtract.test.ts` (since these helpers now live in `message-extract`), adding a small test case that asserts:
     - `buildAgentInstruction({ message: "hello" })` is not a UI metadata prefix.
     - `stripUiMetadata(...)` returns the original string for non-metadata messages.

Verification:

- Run `npm test` and expect all unit tests to pass.

Commit:

- Commit with message: `Milestone 2: Update message helper tests after consolidation`

## Concrete Steps

All commands below are run from the repository root.

1. Confirm current imports and tests:

   - `rg -n "message-metadata" src tests`
   - `npm install` (only if `vitest`/dependencies are missing)
   - `npm test`

2. Implement Milestone 1 changes (code moves + import updates), then verify:

   - `npm run typecheck`
   - `npm run lint`
   - `npm test`

3. Implement Milestone 2 changes (test updates + test file removal), then verify:

   - `npm test`
   - `rg -n "message-metadata" src tests` (expect no hits)

4. Optional smoke test:

   - `npm run dev`
   - Navigate to `http://localhost:3000`
   - Confirm focused agent chat/history still renders without “Project path:” prefixes and still suppresses heartbeat prompt noise in history.

## Validation and Acceptance

Acceptance criteria:

1. There is no `src/lib/text/message-metadata.ts` file and no remaining references to `@/lib/text/message-metadata` anywhere in `src/` or `tests/`.
2. Unit tests pass with `npm test`.
3. Type checking passes with `npm run typecheck`.
4. The focused agent UI behavior is unchanged with respect to:
   - `stripUiMetadata` removing Studio metadata prefixes.
   - `isUiMetadataPrefix` correctly identifying metadata prefixes.
   - `isHeartbeatPrompt` suppressing heartbeat prompt strings in history rendering.

## Idempotence and Recovery

This refactor is safe to retry.

If Milestone 1 breaks compilation, revert to the previous state by:

- Restoring `src/lib/text/message-metadata.ts` from git history.
- Reverting the import changes in `src/app/page.tsx` and `src/features/agents/state/runtimeEventBridge.ts`.

Then re-apply the consolidation more mechanically (copy/paste the exact code, do not “rewrite” regexes).

## Interfaces and Dependencies

At the end of this plan, `src/lib/text/message-extract.ts` must export (at minimum):

- `extractText`, `extractTextCached`
- `extractThinking`, `extractThinkingCached`
- `extractToolLines`
- `formatThinkingMarkdown`, `isTraceMarkdown`, `stripTraceMarkdown`
- `isToolMarkdown`, `parseToolMarkdown`
- `buildAgentInstruction`
- `stripUiMetadata`
- `isHeartbeatPrompt`
- `isUiMetadataPrefix`

## Plan Revisions

(2026-02-06 04:17Z) Updated Progress and Concrete Steps after discovering `vitest` was missing in this environment; added an explicit `npm install` prerequisite to make validation steps runnable.
