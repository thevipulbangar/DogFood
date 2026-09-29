"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, GitBranch, Globe, Lock, Save, X } from "lucide-react";
import { RUBRIC, projectById, teamById, trackById, type User } from "@/lib/data";
import { saveAssignment, useJudgeAssignments } from "@/lib/judging-store";
import { weightedScore } from "@/lib/scoring";
import { useNow } from "@/lib/hooks";
import { cn, fmtUTC, hash, pad, relativeTime } from "@/lib/utils";
import { ProjectPreview } from "@/components/ui/ProjectPreview";
import { Badge, Button, Field, Kbd, Meter, buttonClass, fieldClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { Restricted } from "@/components/ui/States";
import { STATUS_META } from "./JudgeDashboard";

const CONFIDENCE = ["Low", "Some", "Moderate", "High", "Expert"];

function Criterion({ c, i, value, onChange, locked, inputRef }: {
  c: (typeof RUBRIC)[number]; i: number; value: number | undefined; onChange: (v: number) => void; locked: boolean; inputRef: (el: HTMLInputElement | null) => void;
}) {
  const id = `crit-${c.id}`;
  return (
    <fieldset className={cn("group rounded-md border p-4 transition-colors focus-within:border-accent/50 focus-within:bg-accent/[0.02]", value == null ? "border-line" : "border-line-strong")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <legend className="flex items-center gap-2">
            <Kbd>{i + 1}</Kbd>
            <span className="text-[15px] font-medium">{c.name}</span>
            <span className="font-mono text-[11px] text-muted">{c.weight}%</span>
          </legend>
          <p id={`${id}-desc`} className="mt-1.5 text-[12.5px] leading-snug text-muted">{c.description}</p>
        </div>
        <output htmlFor={id} className="shrink-0 text-right font-mono tabular">
          <span className={cn("text-3xl font-semibold tracking-tight", value == null ? "text-muted" : "text-fg")}>{value != null ? value.toFixed(1) : "—"}</span>
          <span className="block text-[10px] text-muted">/ 10</span>
        </output>
      </div>
      <input
        ref={inputRef} id={id} type="range" min={0} max={10} step={0.5} disabled={locked}
        value={value ?? 5} onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${c.name} score, out of 10`} aria-describedby={`${id}-desc`} aria-valuetext={value != null ? `${value} out of 10` : "Not scored"}
        className="range mt-3" style={{ ["--fill" as string]: `${((value ?? 0) / 10) * 100}%` }}
      />
      <div className="mt-1 flex justify-between" aria-hidden>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button key={n} type="button" tabIndex={-1} disabled={locked} onClick={() => onChange(n)}
            className={cn("font-mono text-[10px] transition-colors hover:text-fg", value === n ? "text-accent" : "text-muted")}>{n}</button>
        ))}
      </div>
    </fieldset>
  );
}

export function JudgingSession({ projectId, user }: { projectId: number; user: User }) {
  const router = useRouter();
  const toast = useToast();
  const now = useNow();
  const rows = useJudgeAssignments(user.judgeId!);
  const idx = rows.findIndex((a) => a.projectId === projectId);
  const a = rows[idx];
  const p = projectById(projectId);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [missing, setMissing] = useState<string[]>([]);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const loadedFor = useRef<number | null>(null);
  const sliders = useRef<(HTMLInputElement | null)[]>([]);

  // Load working copy when the project changes.
  useEffect(() => {
    if (!a || loadedFor.current === projectId) return;
    loadedFor.current = projectId;
    setScores(a.scores);
    setNotes(a.notes);
    setEvidence(a.evidence);
    setConfidence(a.confidence);
    setMissing([]);
    setJustSubmitted(false);
  }, [a, projectId]);

  const locked = a?.status === "submitted";
  const total = weightedScore(scores, RUBRIC);
  const scored = RUBRIC.filter((c) => scores[c.id] != null).length;
  const done = rows.filter((r) => r.status === "submitted").length;

  // Debounced autosave of drafts.
  const dirty = a && !locked && (JSON.stringify(scores) !== JSON.stringify(a.scores) || notes !== a.notes || evidence !== a.evidence || confidence !== a.confidence);
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(() => saveAssignment(user.judgeId!, projectId, {
      scores, notes, evidence, confidence, status: a!.status === "not_started" ? "in_progress" : a!.status,
    }), 900);
    return () => clearTimeout(id);
  }, [dirty, scores, notes, evidence, confidence, user.judgeId, projectId, a]);

  const go = (d: 1 | -1) => {
    const n = rows[idx + d];
    if (n) router.push(`/judging/${n.projectId}`);
  };

  const saveDraft = () => {
    if (locked) return;
    saveAssignment(user.judgeId!, projectId, { scores, notes, evidence, confidence, status: "in_progress" });
    toast({ tone: "ok", title: "Draft saved", body: `SCORE_DRAFT_SAVED · PROJECT_${pad(projectId)}` });
  };

  const submit = () => {
    if (locked) return;
    const miss = RUBRIC.filter((c) => scores[c.id] == null).map((c) => c.name);
    setMissing(miss);
    if (miss.length) return;
    saveAssignment(user.judgeId!, projectId, { scores, notes, evidence, confidence, status: "submitted", submittedAt: new Date().toISOString() });
    setJustSubmitted(true);
  };

  // Session shortcuts. Text fields keep their keys; sliders still allow J/K/S/Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && (t as HTMLInputElement).type !== "range");
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "j") go(1);
      else if (k === "k") go(-1);
      else if (k === "s") { e.preventDefault(); saveDraft(); }
      else if (k === "enter" && t.tagName !== "BUTTON" && t.tagName !== "A") { e.preventDefault(); submit(); }
      else if (/^[1-9]$/.test(k) && +k <= RUBRIC.length) { e.preventDefault(); sliders.current[+k - 1]?.focus(); }
      else if (k === "escape") router.push("/judging");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!p || !a) return <Restricted role="Judge (not assigned to this project)" />;
  const team = teamById(p.teamId);
  const meta = STATUS_META[a.status];

  return (
    <div>
      {/* Focus header */}
      <header className="sticky top-14 z-30 -mx-4 -mt-8 mb-8 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-xl md:-mx-8 md:-mt-10 md:px-8 xl:-mx-12 xl:px-12">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/judging" className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted hover:text-fg"><ArrowLeft className="size-3" />Queue</Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-2">Judging session · <span className="text-fg">{p.code}</span> <span className="text-muted">/ {pad(idx + 1, 2)} of {pad(rows.length, 2)}</span></p>
          <div className="order-last flex w-full items-center gap-3 md:order-none md:ml-auto md:w-64">
            <Meter value={(done / rows.length) * 100} label="Session progress" />
            <span className="shrink-0 font-mono text-[10.5px] tabular text-muted">{done}/{rows.length} REVIEWED</span>
          </div>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Button size="sm" variant="ghost" onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous project (K)"><ChevronLeft className="size-3.5" /><Kbd>K</Kbd></Button>
            <Button size="sm" variant="ghost" onClick={() => go(1)} disabled={idx === rows.length - 1} aria-label="Next project (J)"><Kbd>J</Kbd><ChevronRight className="size-3.5" /></Button>
          </div>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[1fr_480px]">
        {/* Project */}
        <section aria-label="Project under review" className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone} dot>{meta.label}</Badge>
            <Badge>{trackById(p.trackId).name}</Badge>
          </div>
          <h1 className="mt-4 text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">{p.name}</h1>
          <p className="mt-3 text-[17px] text-fg-2">{p.tagline}</p>
          <div className="mt-6 overflow-hidden rounded-md border border-line"><div className="aspect-[16/9]"><ProjectPreview seed={p.slug} animated /></div></div>
          <p className="mt-6 max-w-2xl text-[15.5px] leading-relaxed text-fg-2">{p.description}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[{ icon: Globe, k: "Demo", v: p.demo }, { icon: GitBranch, k: "Repository", v: p.repo }].map(({ icon: Icon, k, v }) => (
              <a key={k} href={`http://${v}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-sm border border-line p-3 hover:border-line-strong">
                <Icon className="size-4 text-muted" /><span className="min-w-0"><span className="label block">{k}</span><span className="block truncate font-mono text-[12px]">{v}</span></span>
              </a>
            ))}
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <div><dt className="label">Team</dt><dd className="mt-1 text-[14px]">{team.name} · {team.members.length}</dd></div>
            <div><dt className="label">Stack</dt><dd className="mt-1 font-mono text-[12px] text-fg-2">{p.stack.join(" · ")}</dd></div>
            <div><dt className="label">Submitted</dt><dd className="mt-1 font-mono text-[12px] text-fg-2">{p.submittedAt && fmtUTC(p.submittedAt)}</dd></div>
          </dl>
        </section>

        {/* Rubric */}
        <section aria-label="Scoring rubric" className="xl:sticky xl:top-32 xl:self-start">
          <AnimatePresence mode="wait">
            {justSubmitted ? (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="relative overflow-hidden rounded-md border border-ok/30 bg-ok/[0.04] p-6" role="status">
                <div className="flex size-10 items-center justify-center rounded-sm bg-ok text-bg"><Check className="size-5" strokeWidth={3} /></div>
                <p className="label mt-5 text-ok">Score submitted</p>
                <p className="mt-2 font-mono text-6xl font-semibold tabular tracking-tight">{total.toFixed(2)}</p>
                <dl className="mt-5 space-y-1 font-mono text-[11px] text-muted">
                  <div className="flex justify-between"><dt>PROJECT</dt><dd className="text-fg-2">{p.code}</dd></div>
                  <div className="flex justify-between"><dt>JUDGE</dt><dd className="text-fg-2">{user.judgeId}</dd></div>
                  <div className="flex justify-between"><dt>RECORDED</dt><dd className="text-fg-2">{now ? fmtUTC(new Date(now).toISOString(), "clock") : ""} UTC</dd></div>
                  <div className="flex justify-between"><dt>RECEIPT</dt><dd className="text-fg-2">sha256:{hash(`${user.judgeId}${p.id}${total}`).toString(16).padStart(8, "0")}</dd></div>
                </dl>
                <div className="mt-6 flex gap-2">
                  {rows[idx + 1] ? (
                    <Button variant="primary" autoFocus onClick={() => go(1)}>Next project <ArrowRight className="size-3.5" /></Button>
                  ) : (
                    <Link href="/judging" autoFocus className={buttonClass("primary")}>Back to queue</Link>
                  )}
                  <Button variant="ghost" onClick={() => setJustSubmitted(false)}>View scores</Button>
                </div>
              </motion.div>
            ) : (
              <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
                <div className="flex items-end justify-between rounded-md border border-line bg-surface/70 p-4">
                  <div>
                    <p className="label">Weighted total</p>
                    <p className="mt-1 font-mono text-5xl font-semibold tabular tracking-tight">{scored ? total.toFixed(2) : "—"}</p>
                  </div>
                  <div className="text-right font-mono text-[10.5px] text-muted">
                    <p>{scored}/{RUBRIC.length} CRITERIA</p>
                    <p className="mt-1" aria-live="polite">
                      {locked ? <span className="flex items-center gap-1 text-ok"><Lock className="size-3" />LOCKED</span>
                        : a.savedAt && now ? `DRAFT SAVED ${relativeTime(a.savedAt, now).toUpperCase()}` : "NOT SAVED"}
                    </p>
                  </div>
                </div>

                {RUBRIC.map((c, i) => (
                  <Criterion key={c.id} c={c} i={i} value={scores[c.id]} locked={locked}
                    inputRef={(el) => { sliders.current[i] = el; }}
                    onChange={(v) => { setScores((s) => ({ ...s, [c.id]: v })); setMissing((m) => m.filter((x) => x !== c.name)); }} />
                ))}

                <Field label="Notes" htmlFor="notes" hint="Private to judges and organizers">
                  <textarea id="notes" rows={3} value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)}
                    className={cn(fieldClass, "resize-y py-2 text-[13.5px]")} placeholder="What stood out? What would you ask the team?" />
                </Field>
                <Field label="Evidence" htmlFor="evidence" hint="Links, timestamps, commits">
                  <input id="evidence" value={evidence} disabled={locked} onChange={(e) => setEvidence(e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    className={cn(fieldClass, "h-9 font-mono text-[12.5px]")} placeholder="demo 02:14 — judging flow; commit a91f3c2" />
                </Field>
                <div role="radiogroup" aria-label="Confidence in this assessment">
                  <p className="label mb-1.5 text-fg-2">Confidence</p>
                  <div className="grid grid-cols-5 gap-1 rounded-sm border border-line-strong p-1">
                    {CONFIDENCE.map((l, i) => (
                      <button key={l} type="button" role="radio" aria-checked={confidence === i + 1} disabled={locked} onClick={() => setConfidence(i + 1)}
                        className={cn("h-8 rounded-xs font-mono text-[10px] uppercase tracking-[0.06em] transition-colors",
                          confidence === i + 1 ? "bg-fg text-bg" : "text-muted hover:bg-white/[0.05] hover:text-fg")}>{l}</button>
                    ))}
                  </div>
                </div>

                <AnimatePresence>
                  {missing.length > 0 && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} role="alert"
                      className="flex items-center gap-2 font-mono text-[11px] text-danger"><X className="size-3" />Score required: {missing.join(", ")}</motion.p>
                  )}
                </AnimatePresence>

                {locked ? (
                  <p className="flex items-center gap-2 rounded-sm border border-line p-3 text-[12.5px] text-muted"><Lock className="size-3.5" />Submitted {a.submittedAt && fmtUTC(a.submittedAt)}. Amendments go through an organizer and are audited.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button type="button" size="lg" onClick={saveDraft}><Save className="size-3.5" />Save draft <Kbd className="ml-1">S</Kbd></Button>
                    <Button type="submit" size="lg" variant="primary">Submit score <Kbd className="ml-1 border-accent-ink/20 bg-accent-ink/10 text-accent-ink">↵</Kbd></Button>
                  </div>
                )}
                <p className="hidden pt-1 text-center font-mono text-[10px] text-muted md:block">1–{RUBRIC.length} FOCUS CRITERION · ←/→ ADJUST · J/K PROJECT · ESC QUEUE</p>
              </motion.form>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
