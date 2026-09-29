"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { api, type GalleryItem } from "@/lib/api";
import { pad } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { Counter } from "@/components/ui/Counter";
import { ProjectPreview } from "@/components/ui/ProjectPreview";
import { Magnetic, StatusDot, Ticks, buttonClass } from "@/components/ui/primitives";

const ease = [0.16, 1, 0.3, 1] as const;

export function LandingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-bg/60 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-5 md:px-10">
        <Link href="/" aria-label="Dogfood home"><Logo /></Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 font-mono text-[11px] uppercase tracking-[0.1em] text-muted md:flex">
          <Link href="/gallery" className="hover:text-fg">Projects</Link>
          <a href="#lifecycle" className="hover:text-fg">Lifecycle</a>
          <a href="#platform" className="hover:text-fg">Platform</a>
          <a href="#self-host" className="hover:text-fg">Self-host</a>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden items-center gap-2 font-mono text-[10.5px] tracking-[0.1em] text-fg-2 sm:flex"><StatusDot tone="ok" pulse />LOCAL INSTANCE</span>
          <Link href="/signin" className={buttonClass("secondary", "sm")}>Sign in</Link>
        </div>
      </div>
    </header>
  );
}

/** Horizontal project showcase — an endless ticker of real submissions, pulled live from GET /api/gallery. */
export function Marquee() {
  const [submitted, setSubmitted] = useState<GalleryItem[]>([]);

  useEffect(() => {
    api.getGallery().then(setSubmitted).catch(() => setSubmitted([]));
  }, []);

  if (submitted.length === 0) return null;
  const items = [...submitted, ...submitted];

  return (
    <section aria-label="Submitted projects" className="relative overflow-hidden border-b border-line py-6">
      <div className="animate-marquee flex w-max gap-10 hover:[animation-play-state:paused]">
        {items.map((p, i) => (
          <Link key={`${p.id}-${i}`} href={`/gallery/${p.id}`} tabIndex={i >= submitted.length ? -1 : 0} aria-hidden={i >= submitted.length}
            className="group flex shrink-0 items-baseline gap-3 whitespace-nowrap">
            <span className="font-mono text-[11px] text-muted">P-{String(p.id).padStart(3, "0")}</span>
            <span className="text-2xl font-semibold tracking-[-0.03em] text-fg-2 transition-colors group-hover:text-accent">{p.title || "Untitled project"}</span>
            <span className="text-line-strong">/</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Marketing → product: a live miniature of the control room tilts into place. */
export function PlatformReveal() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [28, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0.2, 1]);

  const [stats, setStats] = useState<{ events: number; teams: number; submissions: number } | null>(null);
  const [preview, setPreview] = useState<GalleryItem[]>([]);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => setStats(null));
    api.getGallery().then((rows) => setPreview(rows.slice(0, 4))).catch(() => setPreview([]));
  }, []);

  // Real, live aggregate counts from GET /api/stats — no fabricated numbers.
  const metrics = stats
    ? [
        { k: "EVENTS", v: stats.events },
        { k: "TEAMS", v: stats.teams },
        { k: "SUBMITTED", v: stats.submissions },
      ]
    : [];

  return (
    <section id="platform" ref={ref} className="relative overflow-hidden border-b border-line px-5 py-24 md:px-10 md:py-36">
      <div className="mx-auto max-w-[1600px]">
        <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-end">
          <div>
            <p className="label">FIG. 02 — THE PLATFORM</p>
            <h2 className="mt-4 text-[clamp(2.4rem,6vw,5.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">Mission control<br />for hackathons<span className="text-accent">.</span></h2>
          </div>
          <p className="max-w-md text-[16px] leading-relaxed text-fg-2 md:justify-self-end">
            One operations surface for every role. Participants see their team and deadline. Judges see their queue. Organizers see everything — with the audit trail to prove it.
          </p>
        </div>

        <div style={{ perspective: 1600 }} className="mt-16">
          <motion.div style={{ rotateX, scale, opacity, transformOrigin: "50% 0%" }}
            className="relative overflow-hidden rounded-lg border border-line-strong bg-surface shadow-[0_60px_160px_-40px_rgb(255_90_31/0.18)]">
            <Ticks />
            <div className="flex h-10 items-center gap-2 border-b border-line px-4">
              {[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-white/15" />)}
              <span className="ml-4 font-mono text-[10.5px] text-muted">local/dashboard</span>
              <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-ok"><StatusDot tone="ok" pulse />LIVE</span>
            </div>
            <div className="p-5 md:p-8">
              <p className="label">EVENT CONTROL CENTER</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Dogfood 2026</p>
              {metrics.length > 0 && (
                <dl className="mt-6 grid grid-cols-3 border-l border-t border-line">
                  {metrics.map((m) => (
                    <div key={m.k} className="border-b border-r border-line p-4">
                      <dt className="label">{m.k}</dt>
                      <dd className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl"><Counter value={m.v} /></dd>
                    </div>
                  ))}
                </dl>
              )}
              {preview.length > 0 && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {preview.map((p) => (
                    <div key={p.id} className="overflow-hidden rounded-sm border border-line">
                      <div className="aspect-[16/9]"><ProjectPreview seed={String(p.id)} animated /></div>
                      <div className="border-t border-line p-3">
                        <p className="mt-1 text-[14px] font-medium">{p.title || "Untitled project"}</p>
                        <p className="truncate text-[12px] text-muted">{p.team_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

const TIERS = [
  { t: "T1", name: "Foundations", items: ["Authentication & sessions", "Participant / Judge / Organizer / Admin roles", "Events with configurable dates", "Tracks & prizes", "Teams & invite links", "Drafts, edits & deadline enforcement", "Public project gallery"] },
  { t: "T2", name: "Judging", items: ["Judge invitation & assignment", "Weighted rubrics", "Strict role isolation", "Judge progress dashboards", "Score normalization", "CSV export"] },
  { t: "T3", name: "Community & trust", items: ["Community voting", "Comments", "Hidden results", "Randomized ordering", "Rate limiting & duplicate detection", "Audit trails"] },
  { t: "T4", name: "Platform", items: ["REST API & webhooks", "Verifiable certificates", "Verifiable judge records", "Embeddable gallery", "Bulk import / export"] },
];

export function Capabilities() {
  return (
    <section className="border-b border-line px-5 py-24 md:px-10 md:py-32">
      <div className="mx-auto grid max-w-[1600px] gap-12 lg:grid-cols-[360px_1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="label">FIG. 03 — SPECIFICATION</p>
          <h2 className="mt-4 text-[clamp(2.2rem,4.5vw,3.75rem)] font-semibold leading-[0.9] tracking-[-0.045em]">Every tier.<br />Shipped.</h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-fg-2">Built against the Dogfood specification — nothing invented, nothing missing.</p>
        </div>
        <div className="grid border-l border-t border-line sm:grid-cols-2">
          {TIERS.map((tier, i) => (
            <motion.div key={tier.t} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: i * 0.08, ease }} className="group relative border-b border-r border-line p-6 md:p-8">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-5xl font-semibold tracking-tight text-fg transition-colors group-hover:text-accent">{tier.t}</span>
                <span className="label">{pad(tier.items.length, 2)} CAPABILITIES</span>
              </div>
              <p className="mt-3 text-lg font-medium">{tier.name}</p>
              <ul className="mt-5 space-y-2">
                {tier.items.map((it) => (
                  <li key={it} className="flex items-start gap-2.5 text-[14px] text-fg-2"><Check className="mt-0.5 size-3.5 shrink-0 text-accent" strokeWidth={2.5} />{it}</li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const TERMINAL = [
  ["$", "docker compose up -d", "text-ink"],
  ["", "✓ dogfood-api       healthy   :8080", "text-ink/60"],
  ["", "✓ dogfood-web       healthy   :3000", "text-ink/60"],
  ["", "✓ storage           ./data/event.db", "text-ink/60"],
  ["", "✓ network           not required", "text-ink/60"],
  ["→", "http://localhost:3000", "text-[#c93c0b]"],
];

export function SelfHosted() {
  return (
    <section id="self-host" className="grain relative bg-paper px-5 py-24 text-ink md:px-10 md:py-32">
      <div className="mx-auto grid max-w-[1600px] gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink/50">FIG. 04 — SELF-HOSTED</p>
          <h2 className="mt-4 text-[clamp(2.6rem,6vw,5.5rem)] font-semibold leading-[0.86] tracking-[-0.05em]">Your event.<br />Your hardware.<br />Your data.</h2>
          <p className="mt-6 max-w-md text-[16px] leading-relaxed text-ink/70">
            Dogfood runs entirely on your machine. No hosted databases, no external APIs, no cloud accounts, no network connection. Unplug the router — judging continues.
          </p>
          <dl className="mt-10 grid grid-cols-2 gap-px border border-ink/15 bg-ink/15 sm:grid-cols-4">
            {[["0", "Cloud deps"], ["1", "Data file"], ["4", "Roles"], ["MIT", "License"]].map(([v, k]) => (
              <div key={k} className="bg-paper p-4">
                <dd className="text-3xl font-semibold tracking-tight">{v}</dd>
                <dt className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/50">{k}</dt>
              </div>
            ))}
          </dl>
        </div>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease }}
          className="rounded-md border border-ink/15 bg-paper-2 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.35)]">
          <div className="flex h-9 items-center gap-2 border-b border-ink/10 px-4">
            {[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-ink/20" />)}
            <span className="ml-3 font-mono text-[10.5px] text-ink/50">~/dogfood</span>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-7 md:p-7 md:text-[13.5px]">
            {TERMINAL.map(([p, cmd, c], i) => (
              <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.18 }} className={c}>
                <span className="mr-3 select-none text-ink/40">{p || " "}</span>{cmd}
              </motion.div>
            ))}
          </pre>
        </motion.div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden px-5 py-28 md:px-10 md:py-40">
      <div className="event-grid fade-mask-radial absolute inset-0" aria-hidden />
      <div className="relative mx-auto flex max-w-[1600px] flex-col items-start gap-10 md:flex-row md:items-end md:justify-between">
        <h2 className="text-[clamp(3rem,9vw,8.5rem)] font-semibold leading-[0.85] tracking-[-0.055em]">Build.<br />Submit.<br /><span className="text-accent">Judge.</span></h2>
        <Magnetic>
          <Link href="/signin" className={buttonClass("primary", "lg", "h-14 px-8")}>Enter Dogfood <ArrowRight className="size-4" /></Link>
        </Magnetic>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line px-5 py-8 md:px-10">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted md:flex-row md:items-center md:justify-between">
        <Logo />
        <span>Open source · Self-hosted · No cloud dependencies</span>
        <span className="flex items-center gap-2"><StatusDot tone="ok" />All systems local</span>
      </div>
    </footer>
  );
}
