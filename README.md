# clawdbot-agent-ui

Agent Canvas UI for Clawdbot.

## Thinking traces

When a model sends `message.content[]` entries with `type: "thinking"` (or embeds
`<thinking>...</thinking>` tags), the UI renders those traces before the assistant
response. After the response completes, traces collapse into a single toggleable
"Thinking" block so they can be reopened on demand. The Thinking selector on each
tile controls whether the model emits these traces.
