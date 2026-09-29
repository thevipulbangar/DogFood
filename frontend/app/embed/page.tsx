"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, type GalleryItem } from "@/lib/api";
import { ProjectPreview } from "@/components/ui/ProjectPreview";
import { LogoMark } from "@/components/ui/Logo";

// Embeddable gallery (T4). Designed to live inside an <iframe>, backed by
// the real public gallery API — no login, no fabricated projects:
// <iframe src="https://dogfood.local/embed?track=Web" width="100%" height="640"></iframe>

export default function Page({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track } = use(searchParams);
  const [list, setList] = useState<GalleryItem[] | null>(null);

  useEffect(() => {
    api.getGallery({ track }).then(setList).catch(() => setList([]));
  }, [track]);

  return (
    <main className="min-h-dvh bg-bg p-4">
      <header className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-fg-2">
          <LogoMark size={14} />DOGFOOD 2026 · {list ? `${list.length} PROJECTS` : "LOADING…"}
        </span>
        <Link href="/gallery" target="_top" className="font-mono text-[10.5px] tracking-[0.1em] text-muted hover:text-accent">OPEN GALLERY ↗</Link>
      </header>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {(list ?? []).map((p) => (
          <li key={p.id}>
            <Link href={`/gallery/${p.id}`} target="_top" className="group block overflow-hidden rounded-md border border-line bg-surface transition-colors hover:border-accent/50">
              <div className="aspect-[16/9]"><ProjectPreview seed={String(p.id)} /></div>
              <div className="border-t border-line p-3">
                <p className="mt-0.5 text-[14px] font-medium text-fg group-hover:text-accent">{p.title || "Untitled project"}</p>
                <p className="truncate text-[12px] text-muted">{p.team_name}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
