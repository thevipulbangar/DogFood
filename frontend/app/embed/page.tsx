import type { Metadata } from "next";
import Link from "next/link";
import { SUBMITTED, teamById } from "@/lib/data";
import { ProjectPreview } from "@/components/ui/ProjectPreview";
import { LogoMark } from "@/components/ui/Logo";

// Embeddable gallery (T4). Designed to live inside an <iframe>:
// <iframe src="https://dogfood.local/embed?track=judging" width="100%" height="640"></iframe>

export const metadata: Metadata = { title: "Embedded gallery", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track } = await searchParams;
  const list = SUBMITTED.filter((p) => !track || p.trackId === track);
  return (
    <main className="min-h-dvh bg-bg p-4">
      <header className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-fg-2"><LogoMark size={14} />DOGFOOD 2026 · {list.length} PROJECTS</span>
        <Link href="/gallery" target="_top" className="font-mono text-[10.5px] tracking-[0.1em] text-muted hover:text-accent">OPEN GALLERY ↗</Link>
      </header>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {list.map((p) => (
          <li key={p.id}>
            <Link href={`/gallery/${p.id}`} target="_top" className="group block overflow-hidden rounded-md border border-line bg-surface transition-colors hover:border-accent/50">
              <div className="aspect-[16/9]"><ProjectPreview seed={p.slug} /></div>
              <div className="border-t border-line p-3">
                <p className="font-mono text-[10px] text-muted">{p.code}</p>
                <p className="mt-0.5 text-[14px] font-medium text-fg group-hover:text-accent">{p.name}</p>
                <p className="truncate text-[12px] text-muted">{teamById(p.teamId).name}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
