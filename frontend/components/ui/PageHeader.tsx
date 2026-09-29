"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ crumbs, eyebrow, title, meta, actions, className }: {
  crumbs?: { href?: string; label: string }[];
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {c.href ? (
                  <Link href={c.href} className="label hover:text-fg">{c.label}</Link>
                ) : (
                  <span className="label text-fg-2" aria-current="page">{c.label}</span>
                )}
                {i < crumbs.length - 1 && <ChevronRight className="size-3 text-muted" aria-hidden />}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <div className="label mb-3 flex items-center gap-2">{eyebrow}</div>}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-fg"
        >
          {title}
        </motion.h1>
        {meta && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11.5px] uppercase tracking-[0.06em] text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
