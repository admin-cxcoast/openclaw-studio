README.md is empty and USER.md contains only a preference, while critical operational details live in code, including config search paths in src/lib/clawdbot/config.ts, gateway defaults in src/lib/clawdbot/gateway.ts, env variables in src/lib/env.ts, and local state in src/app/api/projects/store.ts. This makes onboarding and troubleshooting slow and error-prone.

Write a concise README with setup steps, dev and test commands from package.json, required env/config, gateway expectations, and where workspace state is stored. Add a short troubleshooting section for missing config and gateway errors; optionally consolidate USER.md into README if it is not used elsewhere to reduce scattered docs.

Acceptance criteria: README explains how to run the UI with a local gateway, lists required env/config paths, and documents common failure modes with fixes. Open question: should docs standardize on .moltbot vs .clawdbot naming and which path is preferred for new installs.
