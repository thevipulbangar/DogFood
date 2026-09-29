"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { cn, fmtUTC } from "@/lib/utils";
import { Badge, Panel, Skeleton, fieldClass } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";

/**
 * The real, backend-backed public gallery (GET /api/gallery). Unlike the
 * richer staff-facing Gallery component (still on mock data — see
 * lib/data.ts), this only shows fields the API actually returns.
 */
export function RealGallery() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof api.getGallery>> | null>(null);
  const [error, setError] = useState<string>();
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      setError(undefined);
      api
        .getGallery({ q: q || undefined, track: track || undefined })
        .then((rows) => setItems(rows))
        .catch((err: Error) => setError(err.message));
    }, 250);
    return () => clearTimeout(id);
  }, [q, track]);

  return (
    <div>
      <header className="mb-8">
        <p className="label">Public gallery{items ? ` · ${items.length} submission${items.length === 1 ? "" : "s"}` : ""}</p>
        <h1 className="mt-2 text-[clamp(3rem,8vw,6.5rem)] font-semibold leading-[0.85] tracking-[-0.055em]">PROJECTS</h1>
      </header>

      <div className="sticky top-14 z-30 -mx-4 mb-6 flex gap-2 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-xl md:mx-0 md:rounded-md md:border md:px-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search projects"
            placeholder="Search submitted projects…"
            className={cn(fieldClass, "h-9 pl-9")}
          />
        </div>
        <input
          value={track}
          onChange={(e) => setTrack(e.target.value)}
          aria-label="Filter by track"
          placeholder="Track"
          className={cn(fieldClass, "h-9 w-40")}
        />
      </div>

      {error ? (
        <ErrorState onRetry={() => setQ((x) => x)} />
      ) : items === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading projects">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[200px]" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState code="0 MATCHES" title="No submissions yet" body="Submitted projects will appear here once teams lock in their work." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <Link key={p.id} href={`/gallery/${p.id}`} className="block">
              <Panel title={p.title || "Untitled project"} action={p.track ? <Badge tone="accent">{p.track}</Badge> : undefined} className="h-full transition-colors hover:border-accent/50">
                <p className="line-clamp-3 text-[13.5px] text-fg-2">{p.description}</p>
                <dl className="mt-4 space-y-1 border-t border-line pt-3 font-mono text-[11px] text-muted">
                  <div>TEAM · {p.team_name}</div>
                  {p.submitted_at && <div>SUBMITTED · {fmtUTC(p.submitted_at)}</div>}
                </dl>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
