"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { pad } from "@/lib/utils";

const STAGES = [
  { word: "REGISTER", text: "Participants, judges and organizers sign in to a single local instance. Roles are granted by the server, never inferred by the client.", fig: "auth" },
  { word: "FORM TEAM", text: "Captains create a team and share an invite link. Members join in one click; team size limits are enforced.", fig: "team" },
  { word: "BUILD", text: "72 hours on one global clock. Drafts autosave. Every edit is written to the audit trail.", fig: "build" },
  { word: "SUBMIT", text: "Submissions lock at the server's deadline — not the browser's. Late edits are rejected, visibly.", fig: "submit" },
  { word: "JUDGE", text: "Judges score assigned projects against a weighted rubric in a focused, keyboard-first console.", fig: "judge" },
  { word: "NORMALIZE", text: "Per-judge z-score normalization removes harsh-judge and generous-judge bias before ranking.", fig: "normalize" },
  { word: "VOTE", text: "Community voting with randomized order, rate limits and duplicate detection. Tallies stay hidden.", fig: "vote" },
  { word: "RESULTS", text: "Results are published in one moment, with a transparent score breakdown for every project.", fig: "results" },
  { word: "CERTIFICATE", text: "Every participant and judge receives a verifiable certificate that checks out offline.", fig: "cert" },
];

function Figure({ kind }: { kind: string }) {
  const s = "stroke-white/15";
  switch (kind) {
    case "judge":
      return (
        <svg viewBox="0 0 200 110" className="w-full">
          {[["INNOV", 0.84], ["EXEC", 0.91], ["IMPACT", 0.87], ["DESIGN", 0.89]].map(([l, v], i) => (
            <g key={l as string} transform={`translate(0 ${i * 26})`}>
              <text x="0" y="12" className="fill-white/40 font-mono text-[8px]">{l}</text>
              <rect x="52" y="6" width="120" height="3" className="fill-white/10" />
              <rect x="52" y="6" width={120 * (v as number)} height="3" className={i === 1 ? "fill-[#ff5a1f]" : "fill-white/40"} />
              <text x="178" y="12" className="fill-white/60 font-mono text-[8px]">{((v as number) * 10).toFixed(1)}</text>
            </g>
          ))}
        </svg>
      );
    case "normalize":
      return (
        <svg viewBox="0 0 200 110" className="w-full" fill="none">
          <path d="M10 95 C 40 95, 50 30, 70 30 S 100 95, 130 95" className="stroke-white/30" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M50 95 C 80 95, 90 20, 110 20 S 140 95, 170 95" className="stroke-white/30" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M30 95 C 60 95, 70 12, 90 12 S 120 95, 150 95" stroke="#ff5a1f" strokeWidth="2" />
          <line x1="0" y1="95" x2="200" y2="95" className={s} />
        </svg>
      );
    case "vote":
      return (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`flex h-12 items-end justify-between border p-1.5 font-mono text-[8px] ${i === 4 ? "border-accent text-accent" : "border-line-strong text-muted"}`}>
              <span>P-{pad(i * 17 + 3)}</span><span>{i === 4 ? "✓" : "—"}</span>
            </div>
          ))}
          <p className="col-span-3 mt-1 font-mono text-[9px] tracking-[0.1em] text-muted">TALLY HIDDEN UNTIL RESULTS</p>
        </div>
      );
    case "results":
      return (
        <svg viewBox="0 0 200 110" className="w-full">
          {[[70, 60, "2"], [100, 90, "1"], [130, 40, "3"]].map(([x, h, n]) => (
            <g key={n as string}>
              <rect x={(x as number) - 14} y={100 - (h as number)} width="28" height={h as number} className={n === "1" ? "fill-[#ff5a1f]" : "fill-white/15"} />
              <text x={x as number} y={94 - (h as number)} textAnchor="middle" className="fill-white/70 font-mono text-[9px]">{n}</text>
            </g>
          ))}
          <line x1="20" y1="100" x2="180" y2="100" className={s} />
        </svg>
      );
    case "cert":
      return (
        <div className="bg-paper p-3 text-ink">
          <p className="font-mono text-[7px] tracking-[0.2em]">DOGFOOD 2026</p>
          <p className="mt-2 text-[13px] font-semibold tracking-tight">Certificate of Achievement</p>
          <div className="mt-3 flex items-end justify-between">
            <p className="font-mono text-[7px]">VRF-7F3A-19C2</p>
            <div className="grid grid-cols-5 gap-px">{Array.from({ length: 25 }, (_, i) => <span key={i} className={`size-1.5 ${(i * 7) % 3 ? "bg-ink" : "bg-transparent"}`} />)}</div>
          </div>
        </div>
      );
    default: {
      const rows = { auth: ["EMAIL", "PASSWORD", "ROLE"], team: ["CAPTAIN", "MEMBER", "MEMBER", "INVITE ↗"], build: ["DRAFT SAVED 14S AGO", "REPO", "DEMO"], submit: ["DEADLINE 18:00 UTC", "SUBMISSION LOCKED", "✓ 17:42:08"] }[kind] ?? [];
      return (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={i} className={`flex h-7 items-center border px-2 font-mono text-[9px] tracking-[0.08em] ${i === rows.length - 1 ? "border-accent/50 text-accent" : "border-line-strong text-muted"}`}>{r}</li>
          ))}
        </ul>
      );
    }
  }
}

function Card({ i, stage }: { i: number; stage: (typeof STAGES)[number] }) {
  return (
    <article className="group relative flex h-full w-[82vw] shrink-0 flex-col justify-between border-l border-line px-6 py-8 sm:w-[440px] md:px-10">
      <div>
        <p className="label flex justify-between"><span>STAGE {pad(i + 1, 2)} / {pad(STAGES.length, 2)}</span><span className="text-accent">●</span></p>
        <h3 className="mt-6 text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[0.9] tracking-[-0.045em]">{stage.word}</h3>
        <p className="mt-5 max-w-[34ch] text-[15px] leading-relaxed text-fg-2">{stage.text}</p>
      </div>
      <div className="mt-8 rounded-sm border border-line bg-surface/60 p-4"><Figure kind={stage.fig} /></div>
    </article>
  );
}

function Track({ progress }: { progress: MotionValue<number> }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  useLayoutEffect(() => {
    const measure = () => trackRef.current && setDistance(Math.max(0, trackRef.current.scrollWidth - window.innerWidth));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const x = useTransform(progress, [0, 1], [0, -distance]);
  const bar = useTransform(progress, [0, 1], ["0%", "100%"]);

  return (
    <>
      <motion.div ref={trackRef} style={{ x }} className="flex h-[min(620px,72vh)] w-max">
        <div className="flex w-[82vw] shrink-0 flex-col justify-end px-5 pb-8 sm:w-[520px] md:px-10">
          <p className="label">THE LIFECYCLE</p>
          <h2 className="mt-4 text-[clamp(2.6rem,6vw,5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">One system.<br />Nine stages.<br /><span className="text-muted">Zero hand-offs.</span></h2>
        </div>
        {STAGES.map((s, i) => <Card key={s.word} i={i} stage={s} />)}
        <div className="w-[10vw] shrink-0" />
      </motion.div>
      <div className="mx-5 mt-8 md:mx-10">
        <div className="relative h-px bg-line">
          <motion.div style={{ width: bar }} className="absolute inset-y-0 left-0 bg-accent" />
        </div>
        <div className="mt-3 hidden justify-between font-mono text-[10px] tracking-[0.1em] text-muted md:flex">
          {STAGES.map((s) => <span key={s.word}>{s.word}</span>)}
        </div>
      </div>
    </>
  );
}

export function Lifecycle() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  if (reduce) {
    return (
      <section id="lifecycle" className="border-b border-line py-20">
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">{STAGES.map((s, i) => <Card key={s.word} i={i} stage={s} />)}</div>
      </section>
    );
  }

  return (
    <section id="lifecycle" ref={ref} className="relative h-[420vh] border-b border-line">
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <Track progress={scrollYProgress} />
      </div>
    </section>
  );
}
