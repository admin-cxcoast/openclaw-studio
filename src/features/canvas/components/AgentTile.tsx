import type React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentTile as AgentTileType } from "@/features/canvas/state/store";
import { isTraceMarkdown, stripTraceMarkdown } from "@/lib/text/extractThinking";

export const MIN_TILE_SIZE = { width: 560, height: 440 };

type AgentTileProps = {
  tile: AgentTileType;
  isSelected: boolean;
  canSend: boolean;
  onDelete: () => void;
  onNameChange: (name: string) => Promise<boolean>;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
};

export const AgentTile = ({
  tile,
  isSelected,
  canSend,
  onDelete,
  onNameChange,
  onDraftChange,
  onSend,
  onModelChange,
  onThinkingChange,
}: AgentTileProps) => {
  const [nameDraft, setNameDraft] = useState(tile.name);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const scrollOutputToBottom = useCallback(() => {
    const el = outputRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleOutputWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!isSelected) return;
      const el = outputRef.current;
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      const nextTop = Math.max(0, Math.min(maxTop, el.scrollTop + event.deltaY));
      const nextLeft = Math.max(0, Math.min(maxLeft, el.scrollLeft + event.deltaX));
      el.scrollTop = nextTop;
      el.scrollLeft = nextLeft;
    },
    [isSelected]
  );

  useEffect(() => {
    const raf = requestAnimationFrame(scrollOutputToBottom);
    return () => cancelAnimationFrame(raf);
  }, [scrollOutputToBottom, tile.outputLines, tile.streamText]);

  const commitName = async () => {
    const next = nameDraft.trim();
    if (!next) {
      setNameDraft(tile.name);
      return;
    }
    if (next === tile.name) {
      return;
    }
    const ok = await onNameChange(next);
    if (!ok) {
      setNameDraft(tile.name);
    }
  };

  const statusColor =
    tile.status === "running"
      ? "bg-amber-200 text-amber-900"
      : tile.status === "error"
        ? "bg-rose-200 text-rose-900"
        : "bg-emerald-200 text-emerald-900";
  const showThinking = tile.status === "running" && Boolean(tile.thinkingTrace);

  return (
    <div
      data-tile
      className={`flex h-full w-full flex-col overflow-hidden rounded-3xl border bg-white/80 shadow-xl backdrop-blur transition ${
        isSelected ? "border-slate-500" : "border-slate-200"
      }`}
    >
      <div
        className="flex cursor-grab items-center justify-between gap-2 border-b border-slate-200 px-4 py-2"
        data-drag-handle
      >
        <input
          className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={() => {
            void commitName();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setNameDraft(tile.name);
              event.currentTarget.blur();
            }
          }}
        />
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusColor}`}
        >
          {tile.status}
        </span>
        <button
          className="rounded-full border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-600"
          type="button"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-3">
        <div
          ref={outputRef}
          className="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white/60 p-3 text-xs text-slate-700"
          onWheel={handleOutputWheel}
        >
          {tile.outputLines.length === 0 && !tile.streamText && !showThinking ? (
            <p className="text-slate-500">No output yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {showThinking ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                  <div className="agent-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {tile.thinkingTrace}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : null}
              {(() => {
                const nodes: React.ReactNode[] = [];
                for (let index = 0; index < tile.outputLines.length; index += 1) {
                  const line = tile.outputLines[index];
                  if (isTraceMarkdown(line)) {
                    const traces = [stripTraceMarkdown(line)];
                    let cursor = index + 1;
                    while (
                      cursor < tile.outputLines.length &&
                      isTraceMarkdown(tile.outputLines[cursor])
                    ) {
                      traces.push(stripTraceMarkdown(tile.outputLines[cursor]));
                      cursor += 1;
                    }
                    nodes.push(
                      <details
                        key={`${tile.id}-trace-${index}`}
                        className="rounded-xl border border-slate-200 bg-white/80 px-2 py-1 text-[11px] text-slate-600"
                      >
                        <summary className="cursor-pointer select-none font-semibold">
                          Thinking
                        </summary>
                        <div className="agent-markdown mt-1 text-slate-700">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {traces.join("\n")}
                          </ReactMarkdown>
                        </div>
                      </details>
                    );
                    index = cursor - 1;
                    continue;
                  }
                  nodes.push(
                    <div key={`${tile.id}-line-${index}`} className="agent-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{line}</ReactMarkdown>
                    </div>
                  );
                }
                return nodes;
              })()}
              {tile.streamText ? (
                <div className="agent-markdown text-slate-500">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {tile.streamText}
                  </ReactMarkdown>
                </div>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
          <label className="flex items-center gap-2">
            Model
            <select
              className="h-7 rounded-full border border-slate-200 bg-white/80 px-2 text-[11px] font-semibold text-slate-700"
              value={tile.model ?? ""}
              onChange={(event) => {
                const value = event.target.value.trim();
                onModelChange(value ? value : null);
              }}
            >
              <option value="openai-codex/gpt-5.2-codex">GPT-5.2 Codex</option>
              <option value="xai/grok-4-1-fast-reasoning">grok-4-1-fast-reasoning</option>
              <option value="xai/grok-4-1-fast-non-reasoning">
                grok-4-1-fast-non-reasoning
              </option>
              <option value="zai/glm-4.7">glm-4.7</option>
            </select>
          </label>
          {tile.model === "xai/grok-4-1-fast-non-reasoning" ? null : (
            <label className="flex items-center gap-2">
              Thinking
              <select
                className="h-7 rounded-full border border-slate-200 bg-white/80 px-2 text-[11px] font-semibold text-slate-700"
                value={tile.thinkingLevel ?? ""}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  onThinkingChange(value ? value : null);
                }}
              >
                <option value="">Default</option>
                <option value="off">Off</option>
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="xhigh">XHigh</option>
              </select>
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="h-9 flex-1 rounded-full border border-slate-200 bg-white/80 px-3 text-xs text-slate-900 outline-none"
            value={tile.draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              if (!isSelected) return;
              if (!canSend || tile.status === "running") return;
              const message = tile.draft.trim();
              if (!message) return;
              event.preventDefault();
              onSend(message);
            }}
            placeholder="Send a command"
          />
          <button
            className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            type="button"
            onClick={() => onSend(tile.draft)}
            disabled={!canSend || tile.status === "running" || !tile.draft.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
