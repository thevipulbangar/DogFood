"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { teamById, trackById, type Project } from "@/lib/data";
import { fmtUTC } from "@/lib/utils";
import { ProjectPreview } from "@/components/ui/ProjectPreview";
import { Badge } from "@/components/ui/primitives";

/** A project as a digital dossier: code, preview, then structured metadata. */
export const ProjectCard = forwardRef<HTMLDivElement, { project: Project; index?: number; href?: string }>(function ProjectCard(
  { project: p, index = 0, href },
  ref,
) {
  const team = teamById(p.teamId);
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={href ?? `/projects/${p.id}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-md border border-line bg-surface/70 transition-[border-color,transform,background-color] duration-300 ease-(--ease-out-expo) hover:-translate-y-1 hover:border-line-strong hover:bg-surface"
      >
        {/* accent line draws in on hover */}
        <span aria-hidden className="absolute inset-x-0 top-0 z-10 h-px origin-left scale-x-0 bg-accent transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-x-100" />

        <div className="flex h-10 items-center justify-between border-b border-line px-4">
          <span className="font-mono text-[10.5px] tracking-[0.1em] text-muted group-hover:text-fg-2">{p.code}</span>
          {p.status === "submitted" ? <Badge tone="ok" dot>Submitted</Badge> : <Badge tone="warn" dot>Draft</Badge>}
        </div>

        <div className="relative aspect-[16/9] overflow-hidden border-b border-line">
          <div className="h-full w-full transition-transform duration-700 ease-(--ease-out-expo) group-hover:scale-[1.04]">
            <ProjectPreview seed={p.slug} animated />
          </div>
          <span className="absolute bottom-2 left-2 rounded-xs border border-line-strong bg-bg/80 px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.1em] text-fg-2 backdrop-blur">
            {trackById(p.trackId).code}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">{p.name}</h3>
          <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-fg-2">{p.tagline}</p>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-3">
            <div className="min-w-0">
              <dt className="label">Team</dt>
              <dd className="mt-0.5 truncate text-[12.5px] text-fg">{team.name} <span className="font-mono text-[10.5px] text-muted">/{team.members.length}</span></dd>
            </div>
            <div className="min-w-0">
              <dt className="label">Submitted</dt>
              <dd className="mt-0.5 truncate font-mono text-[11px] text-fg-2">{p.submittedAt ? fmtUTC(p.submittedAt).replace(" 2026", "") : "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="sr-only">Tech stack</dt>
              <dd className="flex flex-wrap gap-1">
                {p.stack.map((s) => <span key={s} className="rounded-xs border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">{s}</span>)}
              </dd>
            </div>
          </dl>

          <span className="mt-auto flex items-center justify-between pt-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted transition-colors group-hover:text-accent">
            View project
            <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
});
