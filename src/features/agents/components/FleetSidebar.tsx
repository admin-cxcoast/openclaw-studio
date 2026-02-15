import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentState, FocusFilter } from "@/features/agents/state/store";
import { AgentAvatar } from "./AgentAvatar";
import { EmptyStatePanel } from "./EmptyStatePanel";

type SidebarTab = "chat" | "knowledge" | "documents";
type DropdownView = "menu" | "naming";

type FleetSidebarProps = {
  agents: AgentState[];
  selectedAgentId: string | null;
  filter: FocusFilter;
  onFilterChange: (next: FocusFilter) => void;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: (name: string) => void;
  createDisabled?: boolean;
  createBusy?: boolean;
  sidebarTab?: SidebarTab;
  onSidebarTabChange?: (tab: SidebarTab) => void;
  onDeployInstance?: () => void;
  deployDisabled?: boolean;
  isAdmin?: boolean;
};

const FILTER_OPTIONS: Array<{ value: FocusFilter; label: string; testId: string }> = [
  { value: "all", label: "All", testId: "fleet-filter-all" },
  { value: "running", label: "Running", testId: "fleet-filter-running" },
  { value: "idle", label: "Idle", testId: "fleet-filter-idle" },
];

const statusLabel: Record<AgentState["status"], string> = {
  idle: "Idle",
  running: "Running",
  error: "Error",
};

const statusClassName: Record<AgentState["status"], string> = {
  idle: "border border-border/70 bg-muted text-muted-foreground",
  running: "border border-primary/30 bg-primary/15 text-foreground",
  error: "border border-destructive/35 bg-destructive/12 text-destructive",
};

export const FleetSidebar = ({
  agents,
  selectedAgentId,
  filter,
  onFilterChange,
  onSelectAgent,
  onCreateAgent,
  createDisabled = false,
  createBusy = false,
  sidebarTab = "chat",
  onSidebarTabChange,
  onDeployInstance,
  deployDisabled = false,
  isAdmin = false,
}: FleetSidebarProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownView, setDropdownView] = useState<DropdownView>("menu");
  const [agentName, setAgentName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const hasDeployOption = !!onDeployInstance;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setDropdownView("menu");
        setAgentName("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Focus name input when switching to naming view
  useEffect(() => {
    if (dropdownView === "naming" && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [dropdownView]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setDropdownView("menu");
    setAgentName("");
  }, []);

  const handleNewButtonClick = useCallback(() => {
    if (hasDeployOption) {
      setMenuOpen((prev) => !prev);
      if (menuOpen) {
        setDropdownView("menu");
        setAgentName("");
      }
    } else {
      // No deploy option — go directly to naming view in dropdown
      setMenuOpen(true);
      setDropdownView("naming");
    }
  }, [hasDeployOption, menuOpen]);

  const handleConfirmCreate = useCallback(() => {
    const trimmed = agentName.trim();
    if (!trimmed) return;
    onCreateAgent(trimmed);
    closeMenu();
  }, [agentName, onCreateAgent, closeMenu]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirmCreate();
      } else if (e.key === "Escape") {
        if (hasDeployOption) {
          setDropdownView("menu");
          setAgentName("");
        } else {
          closeMenu();
        }
      }
    },
    [handleConfirmCreate, hasDeployOption, closeMenu],
  );

  return (
    <aside
      className="glass-panel fade-up-delay relative flex h-full w-full min-w-72 flex-col gap-3 bg-sidebar p-3 xl:max-w-[320px] xl:border-r xl:border-sidebar-border"
      data-testid="fleet-sidebar"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="console-title text-2xl leading-none text-foreground">Agents ({agents.length})</p>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            data-testid="fleet-new-agent-button"
            className="rounded-md border border-transparent bg-primary px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
            onClick={handleNewButtonClick}
            disabled={createBusy}
          >
            {createBusy ? "Creating..." : "New \u25BE"}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-card shadow-lg">
              {dropdownView === "menu" ? (
                <>
                  <button
                    type="button"
                    data-testid="menu-new-sub-agent"
                    className="flex w-full flex-col items-start gap-0.5 rounded-t-lg px-3 py-2.5 text-left transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={createDisabled}
                    onClick={() => {
                      setDropdownView("naming");
                      setAgentName("");
                    }}
                  >
                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      New Agent
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      Add a sub-agent to the connected gateway
                    </span>
                  </button>
                  {hasDeployOption && (
                    <>
                      <div className="mx-2 border-t border-border" />
                      <button
                        type="button"
                        data-testid="menu-deploy-instance"
                        className="flex w-full flex-col items-start gap-0.5 rounded-b-lg px-3 py-2.5 text-left transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={deployDisabled || !isAdmin}
                        onClick={() => {
                          closeMenu();
                          onDeployInstance?.();
                        }}
                      >
                        <span className="font-mono text-[11px] font-semibold text-foreground">
                          Deploy Instance
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {!isAdmin
                            ? "Admin access required"
                            : "Provision a new gateway instance"}
                        </span>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="px-3 py-3">
                  <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Agent Name
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    onKeyDown={handleNameKeyDown}
                    placeholder="My Agent"
                    className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
                  />
                  <div className="mt-2 flex justify-end gap-1.5">
                    <button
                      type="button"
                      className="rounded-md border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition hover:bg-muted"
                      onClick={() => {
                        if (hasDeployOption) {
                          setDropdownView("menu");
                          setAgentName("");
                        } else {
                          closeMenu();
                        }
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-primary px-2.5 py-1 font-mono text-[10px] font-semibold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!agentName.trim() || createDisabled}
                      onClick={handleConfirmCreate}
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              data-testid={option.testId}
              aria-pressed={active}
                className={`rounded-md border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] transition ${
                active
                  ? "border-border bg-surface-2 text-foreground"
                  : "border-border/80 bg-surface-1 text-muted-foreground hover:border-border hover:bg-surface-2"
              }`}
              onClick={() => onFilterChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {agents.length === 0 ? (
          <EmptyStatePanel title="No agents available." compact className="p-3 text-xs" />
        ) : (
          <div className="flex flex-col gap-2">
            {agents.map((agent) => {
              const selected = selectedAgentId === agent.agentId;
              const avatarSeed = agent.avatarSeed ?? agent.agentId;
              return (
                <button
                  key={agent.agentId}
                  type="button"
                  data-testid={`fleet-agent-row-${agent.agentId}`}
                  className={`group flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                    selected
                      ? "border-ring/45 bg-surface-2"
                      : "border-border/70 bg-surface-1 hover:border-border hover:bg-surface-2"
                  }`}
                  onClick={() => onSelectAgent(agent.agentId)}
                >
                  <AgentAvatar
                    seed={avatarSeed}
                    name={agent.name}
                    avatarUrl={agent.avatarUrl ?? null}
                    size={28}
                    isSelected={selected}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.13em] text-foreground">
                      {agent.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${statusClassName[agent.status]}`}
                      >
                        {statusLabel[agent.status]}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {onSidebarTabChange ? (
        <div className="flex gap-2 border-t border-sidebar-border px-1 pt-3">
          {(["chat", "knowledge", "documents"] as const).map((tab) => {
            const active = sidebarTab === tab;
            const label = tab === "chat" ? "Chat" : tab === "knowledge" ? "Know." : "Docs";
            return (
              <button
                key={tab}
                type="button"
                className={`flex-1 rounded-md border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] transition ${
                  active
                    ? "border-border bg-surface-2 text-foreground"
                    : "border-border/80 bg-surface-1 text-muted-foreground hover:border-border hover:bg-surface-2"
                }`}
                onClick={() => onSidebarTabChange(tab)}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
    </aside>
  );
};
