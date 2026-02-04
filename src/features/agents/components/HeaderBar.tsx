import { ThemeToggle } from "@/components/theme-toggle";
import { Ellipsis } from "lucide-react";

type HeaderBarProps = {
  agentCount: number;
  onConnectionSettings: () => void;
};

export const HeaderBar = ({
  agentCount,
  onConnectionSettings,
}: HeaderBarProps) => {
  return (
    <div className="glass-panel fade-up relative overflow-hidden px-4 py-4 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,color-mix(in_oklch,var(--primary)_7%,transparent)_48%,transparent_100%)] opacity-55" />
      <div className="relative grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="console-title text-2xl leading-none text-foreground sm:text-3xl">
            OpenClaw Studio
          </p>
          <p className="mt-1 truncate text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {agentCount} agents
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          <details className="group relative">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-input/80 bg-background/70 text-muted-foreground transition hover:border-ring hover:bg-card hover:text-foreground [&::-webkit-details-marker]:hidden">
              <Ellipsis className="h-4 w-4" />
              <span className="sr-only">Open studio menu</span>
            </summary>
            <div className="absolute right-0 top-11 z-20 min-w-44 rounded-md border border-border/80 bg-popover/95 p-1 shadow-lg backdrop-blur">
              <button
                className="w-full rounded-sm px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-foreground transition hover:bg-muted"
                type="button"
                onClick={(event) => {
                  onConnectionSettings();
                  (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute(
                    "open"
                  );
                }}
                data-testid="gateway-settings-toggle"
              >
                Gateway Connection
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
