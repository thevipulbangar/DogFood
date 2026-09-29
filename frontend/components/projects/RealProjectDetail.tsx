"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, type GalleryDetail } from "@/lib/api";
import { fmtUTC } from "@/lib/utils";
import { Badge, Panel, Skeleton, Meta } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/States";

/**
 * Real, backend-backed public project detail page (GET /api/gallery/:id).
 * Replaces the old mock ProjectDetail component for the public route —
 * only fields the API actually returns are shown.
 */
export function RealProjectDetail({ id }: { id: number }) {
  const [item, setItem] = useState<GalleryDetail | null | "not-found">(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api
      .getGalleryItem(id)
      .then(setItem)
      .catch((err: Error) => {
        if (err.message.includes("404") || /not found/i.test(err.message)) setItem("not-found");
        else setError(err.message);
      });
  }, [id]);

  if (error) return <ErrorState onRetry={() => setError(undefined)} />;
  if (item === null) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading project">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (item === "not-found") {
    return (
      <div className="py-24 text-center">
        <p className="label">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Project not found</h1>
        <p className="mt-2 text-[13.5px] text-fg-2">It may still be a draft, or the link is wrong.</p>
        <Link href="/gallery" className="mt-6 inline-flex items-center gap-1.5 text-[13px] hover:text-accent"><ArrowLeft className="size-3.5" />Back to gallery</Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/gallery" className="label flex items-center gap-1.5 hover:text-fg"><ArrowLeft className="size-3" />Projects</Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[0.95] tracking-[-0.03em]">{item.title || "Untitled project"}</h1>
          <p className="mt-2 text-[13.5px] text-muted">{item.team_name} · {item.event_name}</p>
        </div>
        {item.track && <Badge tone="accent">{item.track}</Badge>}
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="About">
          <p className="whitespace-pre-line text-[14px] text-fg-2">{item.description || "No description provided."}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {item.repo_url && <a href={item.repo_url} target="_blank" rel="noreferrer" className="text-[13px] underline underline-offset-4 hover:text-accent">Repository ↗</a>}
            {item.demo_url && <a href={item.demo_url} target="_blank" rel="noreferrer" className="text-[13px] underline underline-offset-4 hover:text-accent">Live demo ↗</a>}
          </div>
        </Panel>

        <Panel title="Details">
          <dl className="space-y-2">
            {item.submitted_at && <Meta k="Submitted" v={fmtUTC(item.submitted_at)} />}
            <Meta k="Team" v={item.team_name} />
          </dl>
          {item.members.length > 0 && (
            <>
              <p className="label mt-5 border-t border-line pt-3">Team members</p>
              <ul className="mt-2 space-y-1">
                {item.members.map((m) => <li key={m.id} className="text-[13.5px] text-fg-2">{m.name}</li>)}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
