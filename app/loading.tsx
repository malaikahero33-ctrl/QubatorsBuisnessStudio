/**
 * Loading state for the product area.
 *
 * The PRD's target is three seconds to first paint. Every page here waits on
 * Postgres round trips, so without this a user on a slow connection gets a
 * blank screen and no signal that anything is happening — which reads as a
 * broken app rather than a slow one.
 *
 * Deliberately shaped like the pages it stands in for: the sidebar is already
 * rendered by the layout, so the skeleton fills the content column only.
 */

export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="mb-8 space-y-2">
        <div className="h-3 w-28 animate-pulse rounded bg-surface-2" />
        <div className="h-7 w-56 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-full max-w-md animate-pulse rounded bg-surface-2" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4">
            <div className="h-2.5 w-20 animate-pulse rounded bg-surface-2" />
            <div className="mt-2.5 h-6 w-28 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
            <div className="h-3 flex-1 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </main>
  );
}
