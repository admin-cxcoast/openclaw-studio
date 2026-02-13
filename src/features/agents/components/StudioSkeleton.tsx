/**
 * Skeleton layout that mirrors the real studio structure.
 * Shown during auth resolution and gateway connection to avoid blank screens.
 */
export const StudioSkeleton = ({
  statusText,
}: {
  statusText?: string;
}) => {
  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div className="flex h-full flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5">
        {/* Header skeleton */}
        <div className="glass-panel px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-7 w-40 animate-pulse rounded bg-surface-2" />
              <div className="hidden h-5 w-28 animate-pulse rounded bg-surface-2 sm:block" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 animate-pulse rounded-md bg-surface-2" />
              <div className="h-9 w-[72px] animate-pulse rounded-md bg-surface-2" />
              <div className="h-9 w-9 animate-pulse rounded-md bg-surface-2" />
            </div>
          </div>
        </div>

        {/* Body: sidebar + chat */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
          {/* Sidebar skeleton — hidden on mobile */}
          <aside className="glass-panel hidden min-w-72 flex-col gap-3 p-3 xl:flex xl:max-w-[320px]">
            <div className="flex items-center justify-between px-1">
              <div className="h-6 w-24 animate-pulse rounded bg-surface-2" />
              <div className="h-8 w-20 animate-pulse rounded-md bg-surface-2" />
            </div>
            {/* Filter buttons */}
            <div className="flex gap-2 px-1">
              <div className="h-7 w-12 animate-pulse rounded-md bg-surface-2" />
              <div className="h-7 w-16 animate-pulse rounded-md bg-surface-2" />
              <div className="h-7 w-12 animate-pulse rounded-md bg-surface-2" />
            </div>
            {/* Agent rows */}
            <div className="flex-1 space-y-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2"
                >
                  <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-surface-2" />
                  <div
                    className="h-3 animate-pulse rounded bg-surface-2"
                    style={{ width: `${50 + i * 12}px` }}
                  />
                </div>
              ))}
            </div>
          </aside>

          {/* Chat area skeleton */}
          <div className="glass-panel flex flex-1 flex-col p-4">
            {/* Agent header */}
            <div className="flex items-center gap-3 border-b border-border/30 pb-4">
              <div className="h-12 w-12 animate-pulse rounded-full bg-surface-2" />
              <div className="space-y-2">
                <div className="h-4 w-28 animate-pulse rounded bg-surface-2" />
                <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
              </div>
            </div>

            {/* Status text overlay */}
            {statusText ? (
              <div className="flex flex-1 items-center justify-center">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {statusText}
                </span>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {/* Composer skeleton */}
            <div className="mt-3 flex items-end gap-2">
              <div className="h-[52px] flex-1 animate-pulse rounded-lg bg-surface-2" />
              <div className="h-9 w-16 animate-pulse rounded-md bg-surface-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
