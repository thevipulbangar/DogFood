"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Gavel, GitBranch, Globe, Lock, MessageSquare, Send } from "lucide-react";
import {
  ASSIGNMENTS, AUDIT, EVENT, JUDGES, PROJECT_SCORES, RUBRIC, RAW_SCORES,
  commentsFor, teamById, trackById, type Comment, type Project, type User,
} from "@/lib/data";
import { normalize, weightedScore } from "@/lib/scoring";
import { cn, fmtUTC, pad } from "@/lib/utils";
import { ProjectPreview } from "@/components/ui/ProjectPreview";
import { Avatar, Badge, Button, Meta, Ticks, buttonClass, fieldClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";

const SECTIONS = ["About", "Technology", "Demo", "Team", "Submission", "Judging", "Comments", "Audit history"];
const sid = (s: string) => s.toLowerCase().replace(/\s+/g, "-");

function Section({ title, children, index }: { title: string; children: React.ReactNode; index: number }) {
  return (
    <section id={sid(title)} className="scroll-mt-32 grid gap-4 border-t border-line py-10 md:grid-cols-[220px_1fr] md:gap-10">
      <h2 className="label flex items-baseline gap-3 text-fg-2"><span className="text-muted">{pad(index + 1, 2)}</span>{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ScoreTable({ scores, total, label }: { scores: Record<string, number>; total?: number; label: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <table className="w-full text-left">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b border-line bg-white/[0.02]">
            <th scope="col" className="label px-4 py-2.5 font-normal">Criterion</th>
            <th scope="col" className="label px-4 py-2.5 text-right font-normal">Weight</th>
            <th scope="col" className="label px-4 py-2.5 text-right font-normal">Score</th>
          </tr>
        </thead>
        <tbody>
          {RUBRIC.map((c) => (
            <tr key={c.id} className="border-b border-line last:border-0">
              <th scope="row" className="px-4 py-3 text-[14px] font-normal text-fg">
                {c.name}
                <div className="mt-2 h-[3px] w-full max-w-60 rounded-full bg-white/[0.06]">
                  <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} whileInView={{ width: `${(scores[c.id] ?? 0) * 10}%` }} viewport={{ once: true }} transition={{ duration: 0.9 }} />
                </div>
              </th>
              <td className="px-4 py-3 text-right font-mono text-[13px] text-muted">{c.weight}%</td>
              <td className="px-4 py-3 text-right font-mono text-[15px] tabular text-fg">
                {scores[c.id] != null ? scores[c.id].toFixed(1) : "—"}<span className="text-muted"> / 10</span>
              </td>
            </tr>
          ))}
        </tbody>
        {total != null && (
          <tfoot>
            <tr className="border-t border-line-strong bg-white/[0.02]">
              <th scope="row" className="label px-4 py-3 font-normal text-fg-2">Weighted total</th>
              <td />
              <td className="px-4 py-3 text-right font-mono text-lg tabular text-accent">{total.toFixed(2)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Judging({ project, user }: { project: Project; user: User | null }) {
  const role = user?.role;
  if (role === "judge") {
    const mine = ASSIGNMENTS.find((a) => a.projectId === project.id && a.judgeId === user!.judgeId);
    if (!mine) {
      return <p className="flex items-center gap-2 text-[14px] text-muted"><Lock className="size-4" />You are not assigned to this project. Other judges&apos; scores are never visible to you.</p>;
    }
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="label text-fg-2">Judging panel · your scores</p>
          <Link href={`/judging/${project.id}`} className={buttonClass("primary", "sm")}><Gavel className="size-3" />{mine.status === "submitted" ? "Review score" : "Open in judging session"}</Link>
        </div>
        <ScoreTable scores={mine.scores} total={Object.keys(mine.scores).length ? weightedScore(mine.scores, RUBRIC) : undefined} label="Your rubric scores" />
      </div>
    );
  }
  if (role === "organizer" || role === "admin") {
    const rows = ASSIGNMENTS.filter((a) => a.projectId === project.id);
    const norm = normalize(RAW_SCORES);
    const agg = PROJECT_SCORES.get(project.id);
    if (!rows.length) return <p className="text-[14px] text-muted">Drafts are not assigned to judges until submitted.</p>;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 border-l border-t border-line">
          {[["Raw mean", agg?.raw], ["Normalized", agg?.normalized], ["Scores in", agg ? `${agg.count}/${rows.length}` : `0/${rows.length}`]].map(([k, v]) => (
            <div key={k as string} className="border-b border-r border-line p-4">
              <p className="label">{k}</p>
              <p className="mt-2 font-mono text-2xl tabular">{typeof v === "number" ? v.toFixed(2) : v ?? "—"}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[560px] text-left font-mono text-[12px]">
            <caption className="sr-only">Per-judge scores</caption>
            <thead><tr className="border-b border-line bg-white/[0.02] text-muted">
              <th scope="col" className="px-4 py-2.5 font-normal">JUDGE</th>
              {RUBRIC.map((c) => <th key={c.id} scope="col" className="px-3 py-2.5 text-right font-normal">{c.name.split(" ")[0].toUpperCase()}</th>)}
              <th scope="col" className="px-3 py-2.5 text-right font-normal">RAW</th>
              <th scope="col" className="px-4 py-2.5 text-right font-normal">NORM</th>
            </tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.judgeId} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-2.5 font-normal text-fg-2">{a.judgeId}<span className="ml-2 text-muted">{JUDGES.find((j) => j.id === a.judgeId)?.name}</span></th>
                  {RUBRIC.map((c) => <td key={c.id} className="px-3 py-2.5 text-right tabular">{a.scores[c.id]?.toFixed(1) ?? "—"}</td>)}
                  <td className="px-3 py-2.5 text-right tabular">{a.status === "submitted" ? weightedScore(a.scores, RUBRIC).toFixed(2) : <Badge tone={a.status === "flagged" ? "danger" : "neutral"}>{a.status.replace("_", " ")}</Badge>}</td>
                  <td className="px-4 py-2.5 text-right tabular text-accent">{norm.get(`${a.judgeId}:${project.id}`)?.toFixed(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed border-line-strong p-5">
      <Lock className="mt-0.5 size-4 text-muted" />
      <div>
        <p className="text-[14px]">Scores are sealed</p>
        <p className="mt-1 text-[13px] text-muted">Judging results are hidden from participants until results are published on {fmtUTC(EVENT.resultsAt)}.</p>
      </div>
    </div>
  );
}

function Comments({ project, user }: { project: Project; user: User | null }) {
  const toast = useToast();
  const [list, setList] = useState<Comment[]>(() => commentsFor(project.id));
  const [body, setBody] = useState("");
  const [lastAt, setLastAt] = useState(0);
  const [error, setError] = useState<string>();

  const post = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const text = body.trim();
    if (text.length < 3) return setError("Comment must be at least 3 characters.");
    if (Date.now() - lastAt < 20_000) return setError(`Rate limited — please wait ${Math.ceil((20_000 - (Date.now() - lastAt)) / 1000)}s before commenting again.`);
    setError(undefined);
    setList((l) => [{ id: `new${Date.now()}`, author: user.name, handle: user.handle, body: text, at: new Date().toISOString() }, ...l]);
    setBody("");
    setLastAt(Date.now());
    toast({ tone: "ok", title: "Comment posted", body: "Logged as COMMENT_POSTED" });
  };

  return (
    <div>
      {user ? (
        <form onSubmit={post} className="mb-6">
          <label htmlFor="comment" className="sr-only">Add a comment</label>
          <textarea id="comment" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1000} placeholder="Ask a question or leave constructive feedback…"
            aria-invalid={!!error} aria-describedby={error ? "comment-error" : undefined} className={cn(fieldClass, "resize-y py-2.5")} />
          <div className="mt-2 flex items-center justify-between gap-3">
            {error ? <p id="comment-error" role="alert" className="font-mono text-[11px] text-danger">{error}</p> : <span className="font-mono text-[10.5px] text-muted">{body.length}/1000 · 1 COMMENT / 20S</span>}
            <Button type="submit" size="sm" variant="secondary" disabled={!body.trim()}><Send className="size-3" />Post</Button>
          </div>
        </form>
      ) : (
        <p className="mb-6 text-[13px] text-muted"><Link href="/signin" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent">Sign in</Link> to join the discussion.</p>
      )}
      {list.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] text-muted"><MessageSquare className="size-4" />No comments yet.</p>
      ) : (
        <ul className="space-y-5">
          {list.map((c) => (
            <motion.li key={c.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
              <Avatar initials={c.author.split(" ").map((s) => s[0]).join("")} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]"><span className="text-fg">{c.author}</span><span className="font-mono text-[10.5px] text-muted">{c.handle} · {fmtUTC(c.at)}</span></p>
                <p className="mt-1 text-[14px] leading-relaxed text-fg-2">{c.body}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProjectDetail({ project: p, user, publicView }: { project: Project; user: User | null; publicView?: boolean }) {
  const team = teamById(p.teamId);
  const track = trackById(p.trackId);
  const staff = user?.role === "organizer" || user?.role === "admin";
  const [active, setActive] = useState(SECTIONS[0]);
  const sections = useMemo(() => SECTIONS.filter((s) => (s === "Audit history" ? staff : s === "Judging" ? !publicView : true)), [staff, publicView]);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const hit = entries.find((e) => e.isIntersecting);
      if (hit) setActive(SECTIONS.find((s) => sid(s) === hit.target.id) ?? SECTIONS[0]);
    }, { rootMargin: "-30% 0px -60% 0px" });
    sections.forEach((s) => { const el = document.getElementById(sid(s)); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [sections]);

  const history = [
    ...AUDIT.filter((e) => e.object === `PROJECT_${pad(p.id)}`),
    ...(p.submittedAt ? [{ id: "sub", at: p.submittedAt, actor: team.members[0].handle, action: "SUBMISSION_LOCKED", object: `PROJECT_${pad(p.id)}`, ip: "10.0.1.4", detail: "Final submission" }] : []),
    { id: "cr", at: team.createdAt, actor: team.members[0].handle, action: "SUBMISSION_CREATED", object: `PROJECT_${pad(p.id)}`, ip: "10.0.1.4", detail: "Draft created" },
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <article>
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5">
        <Link href={publicView ? "/gallery" : "/projects"} className="label hover:text-fg">Projects</Link>
        <span className="label">/</span>
        <span className="label text-fg-2" aria-current="page">{p.code}</span>
      </nav>

      <header className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-end">
        <div>
          <p className="font-mono text-[12px] tracking-[0.12em] text-accent">{p.code}</p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 text-[clamp(3rem,9vw,7.5rem)] font-semibold leading-[0.85] tracking-[-0.055em]">{p.name}</motion.h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-snug text-fg-2">{p.tagline}</p>
        </div>
        <dl className="rounded-md border border-line bg-surface/70 px-4 py-1">
          <Meta k="Built by" v={team.name} />
          <Meta k="Status" v={p.status === "submitted" ? <span className="text-ok">SUBMITTED</span> : <span className="text-warn">DRAFT</span>} />
          <Meta k="Track" v={track.name} />
          <Meta k="Technology" v={p.stack.join(" · ")} />
        </dl>
      </header>

      <div className="relative mt-10 overflow-hidden rounded-md border border-line">
        <Ticks />
        <div className="aspect-[16/9] max-h-[640px] w-full md:aspect-[21/9]"><ProjectPreview seed={p.slug} animated /></div>
      </div>

      <nav aria-label="Sections" className="no-scrollbar sticky top-14 z-20 -mx-4 mt-8 flex overflow-x-auto border-b border-line bg-bg/85 px-4 backdrop-blur-xl md:mx-0 md:px-0">
        {sections.map((s) => (
          <a key={s} href={`#${sid(s)}`} aria-current={active === s ? "true" : undefined}
            className={cn("relative flex h-11 shrink-0 items-center px-3 font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors",
              active === s ? "text-fg" : "text-muted hover:text-fg-2")}>
            {s}
            {active === s && <motion.span layoutId="detail-tab" className="absolute inset-x-3 -bottom-px h-px bg-accent" />}
          </a>
        ))}
      </nav>

      {sections.map((s, i) => (
        <Section key={s} title={s} index={i}>
          {s === "About" && <p className="max-w-3xl text-[17px] leading-relaxed text-fg-2">{p.description}</p>}
          {s === "Technology" && (
            <ul className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
              {p.stack.map((t, k) => (
                <li key={t} className="bg-surface p-4">
                  <p className="label">LAYER {pad(k + 1, 2)}</p>
                  <p className="mt-2 text-lg font-medium">{t}</p>
                </li>
              ))}
            </ul>
          )}
          {s === "Demo" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[{ icon: Globe, k: "Live demo", v: p.demo }, { icon: GitBranch, k: "Repository", v: p.repo }].map(({ icon: Icon, k, v }) => (
                <a key={k} href={`http://${v}`} target="_blank" rel="noreferrer" className="group flex items-center gap-4 rounded-md border border-line p-4 transition-colors hover:border-line-strong">
                  <Icon className="size-5 text-muted group-hover:text-accent" />
                  <span className="min-w-0 flex-1"><span className="label block">{k}</span><span className="block truncate font-mono text-[12.5px] text-fg">{v}</span></span>
                  <ArrowUpRight className="size-4 text-muted" />
                </a>
              ))}
            </div>
          )}
          {s === "Team" && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {team.members.map((m) => (
                <li key={m.handle} className="flex items-center gap-3 rounded-md border border-line p-3">
                  <Avatar initials={m.initials} size={36} />
                  <span className="min-w-0 flex-1"><span className="block text-[14px]">{m.name}</span><span className="font-mono text-[10.5px] text-muted">{m.handle} · {m.country}</span></span>
                  {m.role === "captain" && <Badge tone="accent">Captain</Badge>}
                </li>
              ))}
            </ul>
          )}
          {s === "Submission" && (
            <dl className="max-w-xl">
              <Meta k="Submitted" v={p.submittedAt ? fmtUTC(p.submittedAt) : "Not yet submitted"} />
              <Meta k="Last updated" v={fmtUTC(p.updatedAt)} />
              <Meta k="Deadline" v={fmtUTC(EVENT.deadline)} />
              <Meta k="Lock state" v={p.submittedAt ? "LOCKED" : "EDITABLE"} />
            </dl>
          )}
          {s === "Judging" && <Judging project={p} user={user} />}
          {s === "Comments" && <Comments project={p} user={user} />}
          {s === "Audit history" && (
            <ol className="divide-y divide-line rounded-md border border-line font-mono text-[11.5px]">
              {history.map((e) => (
                <li key={e.id} className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2.5 sm:grid-cols-[170px_150px_1fr_auto]">
                  <span className="text-muted">{fmtUTC(e.at)}</span>
                  <span className="text-fg-2">{e.actor}</span>
                  <span className="text-fg">{e.action}</span>
                  <span className="text-muted">{e.detail}</span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      ))}
    </article>
  );
}
