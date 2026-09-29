"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Check, Lock, Send } from "lucide-react";
import { useNow, useMyTeam } from "@/lib/hooks";
import { cn, fmtUTC, hms } from "@/lib/utils";
import { api } from "@/lib/api";
import { Avatar, Badge, Button, Field, Panel, Skeleton, fieldClass } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

type Draft = { title: string; description: string; track: string; repo_url: string; demo_url: string };
type Errors = Partial<Record<keyof Draft, string>>;

const isUrl = (s: string) => !s || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s.trim());

function validate(d: Draft, hasTracks: boolean): Errors {
  const e: Errors = {};
  if (d.title.trim().length < 2) e.title = "Project name is required.";
  if (d.description.trim().length < 30) e.description = `Description needs at least 30 characters (${d.description.trim().length}/30).`;
  if (!d.repo_url.trim() || !isUrl(d.repo_url)) e.repo_url = "Enter a valid repository URL.";
  if (d.demo_url && !isUrl(d.demo_url)) e.demo_url = "Enter a valid demo URL, or leave empty.";
  // Only required when the event actually configured tracks to choose from.
  if (hasTracks && !d.track) e.track = "Choose a track.";
  return e;
}

export function SubmissionBuilder() {
  const toast = useToast();
  const now = useNow();
  const { team, members, submission, loading, error, refresh } = useMyTeam();

  if (loading) return <div className="space-y-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;
  if (error) return <ErrorState onRetry={refresh} />;
  if (!team) {
    return (
      <div className="rounded-md border border-line bg-white/[0.015] p-6">
        <p className="text-[14px] text-fg-2">You need to be on a team before you can start a submission.</p>
        <Link href="/teams" className="mt-3 inline-block text-[14px] text-fg underline underline-offset-4 hover:text-accent">Join or create a team</Link>
      </div>
    );
  }

  return <Builder team={team} members={members} submission={submission} now={now} refresh={refresh} toast={toast} />;
}

function Builder({ team, members, submission, now, refresh, toast }: {
  team: NonNullable<ReturnType<typeof useMyTeam>["team"]>;
  members: ReturnType<typeof useMyTeam>["members"];
  submission: ReturnType<typeof useMyTeam>["submission"];
  now: number | null;
  refresh: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const eventTracks = team.event_tracks ?? [];
  const [d, setD] = useState<Draft>({
    title: submission?.title ?? "",
    description: submission?.description ?? "",
    track: submission?.track ?? "",
    repo_url: submission?.repo_url ?? "",
    demo_url: submission?.demo_url ?? "",
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hydrated = useRef(false);

  const deadline = Date.parse(team.submission_deadline);
  const left = now == null ? null : deadline - now;
  const closed = left != null && left <= 0;
  // Locked once it's been submitted (is_draft === false), or the deadline passed.
  const isLocked = (submission && !submission.is_draft) || closed;
  const urgency = left == null ? "calm" : left < 3600e3 ? "critical" : left < 6 * 3600e3 ? "warn" : "calm";

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Autosave the draft to the backend (debounced), once it exists and isn't locked.
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    if (!submission || isLocked) return;
    const id = setTimeout(async () => {
      setSaving(true);
      try {
        await api.updateSubmission(submission.id, d);
        setSavedAt(Date.now());
      } catch {
        toast({ tone: "warn", title: "Autosave failed", body: "Your changes are still on this page — try again." });
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  const startDraft = async () => {
    setSaving(true);
    try {
      await api.createSubmission(team.id, d);
      refresh();
    } catch (err) {
      toast({ tone: "warn", title: "Could not start submission", body: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    const e = validate(d, eventTracks.length > 0);
    setErrors(e);
    if (Object.keys(e).length) {
      setConfirming(false);
      document.getElementById(`f-${Object.keys(e)[0]}`)?.focus();
      toast({ tone: "warn", title: "Submission incomplete", body: `${Object.keys(e).length} field(s) need attention` });
      return;
    }
    if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 5000); return; }
    setSubmitting(true);
    try {
      await api.updateSubmission(submission!.id, d);
      await api.submitSubmission(submission!.id);
      toast({ tone: "ok", title: "Submission locked", body: "Now visible in the public gallery." });
      refresh();
    } catch (err) {
      toast({ tone: "warn", title: "Could not submit", body: err instanceof Error ? err.message : undefined });
    } finally {
      setConfirming(false);
      setSubmitting(false);
    }
  };

  if (!submission) {
    return (
      <div className="rounded-md border border-line bg-white/[0.015] p-6">
        <p className="text-[14px] text-fg-2">Your team hasn&apos;t started a submission yet.</p>
        <Button variant="primary" className="mt-4" onClick={startDraft} disabled={saving}>
          {saving ? "Starting…" : "Start submission draft"}
        </Button>
      </div>
    );
  }

  const checklist: [string, boolean][] = [
    ["Name", !validate(d, eventTracks.length > 0).title],
    ["Description", !validate(d, eventTracks.length > 0).description],
    ["Repository", isUrl(d.repo_url) && !!d.repo_url],
    ["Demo link", !!d.demo_url && isUrl(d.demo_url)],
    ["Track", eventTracks.length === 0 || !!d.track],
  ];
  const done = checklist.filter(([, ok]) => ok).length;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <p className="label">Submission builder</p>
        <h1 className="mt-2 text-[clamp(2.2rem,5vw,3.5rem)] font-semibold leading-[0.9] tracking-[-0.04em]">{d.title || "Untitled project"}</h1>

        <AnimatePresence>
          {!submission.is_draft && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex items-start gap-4 rounded-md border border-ok/30 bg-ok/[0.05] p-5" role="status">
              <Lock className="mt-0.5 size-5 text-ok" />
              <div>
                <p className="font-mono text-[12px] tracking-[0.1em] text-ok">SUBMISSION LOCKED</p>
                <p className="mt-1 font-mono text-[13px] text-fg">SUBMITTED {submission.submitted_at ? fmtUTC(submission.submitted_at).toUpperCase() : ""}</p>
                <p className="mt-2 text-[13px] text-muted">Your project is now visible in the public gallery.</p>
              </div>
            </motion.div>
          )}
          {closed && submission.is_draft && (
            <div className="mt-6 flex items-center gap-3 rounded-md border border-danger/30 bg-danger/[0.05] p-4 text-[13.5px]" role="alert">
              <AlertTriangle className="size-4 text-danger" />Submissions closed at {fmtUTC(team.submission_deadline)}. The server rejects further edits.
            </div>
          )}
        </AnimatePresence>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-10 space-y-8" noValidate>
          <fieldset disabled={isLocked} className="space-y-8 disabled:opacity-70">
            <Field label="Project name" htmlFor="f-title" error={errors.title} required>
              <input id="f-title" value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={80} aria-invalid={!!errors.title} className={cn(fieldClass, "h-11 text-[15px]")} />
            </Field>

            <Field label="Description" htmlFor="f-description" error={errors.description} hint={`${d.description.length} characters`} required>
              <textarea id="f-description" rows={7} value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={2000}
                aria-invalid={!!errors.description} className={cn(fieldClass, "resize-y py-3 leading-relaxed")} />
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Repository" htmlFor="f-repo_url" error={errors.repo_url} required>
                <input id="f-repo_url" value={d.repo_url} onChange={(e) => set("repo_url", e.target.value)} inputMode="url" aria-invalid={!!errors.repo_url} className={cn(fieldClass, "h-11 font-mono text-[13px]")} placeholder="https://github.com/team/project" />
              </Field>
              <Field label="Demo" htmlFor="f-demo_url" error={errors.demo_url} hint="Optional">
                <input id="f-demo_url" value={d.demo_url} onChange={(e) => set("demo_url", e.target.value)} inputMode="url" aria-invalid={!!errors.demo_url} className={cn(fieldClass, "h-11 font-mono text-[13px]")} placeholder="https://project.demo" />
              </Field>
            </div>

            <fieldset>
              <legend className="label mb-2 text-fg-2">Track {eventTracks.length > 0 && <span className="text-accent">*</span>}</legend>
              {eventTracks.length === 0 ? (
                <p className="text-[13px] text-muted">This event has no configured tracks — the organizer hasn't set any, so track is optional.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                  {eventTracks.map((name, i) => (
                    <label key={name} className={cn("relative flex cursor-pointer gap-3 rounded-md border p-3.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-accent",
                      d.track === name ? "border-accent/50 bg-accent/[0.04]" : "border-line hover:border-line-strong")}>
                      <input type="radio" name="track" value={name} checked={d.track === name} onChange={() => set("track", name)} className="sr-only" id={i === 0 ? "f-track" : undefined} />
                      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", d.track === name ? "border-accent" : "border-line-strong")}>
                        {d.track === name && <span className="size-2 rounded-full bg-accent" />}
                      </span>
                      <span className="text-[14px]">{name}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <div>
              <p className="label mb-2 text-fg-2">Team</p>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-2 rounded-sm border border-line py-1 pl-1 pr-2.5 text-[13px]"><Avatar initials={m.name.split(" ").map((s) => s[0]).join("")} size={22} />{m.name}</span>
                ))}
                <Link href="/teams" className="inline-flex items-center rounded-sm border border-dashed border-line-strong px-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted hover:text-fg">Manage</Link>
              </div>
            </div>
          </fieldset>
        </form>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className={cn("rounded-md border p-5 transition-colors",
          urgency === "critical" ? "border-danger/40 bg-danger/[0.05]" : urgency === "warn" ? "border-warn/30 bg-warn/[0.04]" : "border-line bg-surface/70")}>
          <p className={cn("label", urgency === "critical" ? "text-danger" : urgency === "warn" ? "text-warn" : "")}>{closed ? "Submissions closed" : "Submission closes in"}</p>
          <p className={cn("mt-2 font-mono text-[40px] font-semibold leading-none tabular tracking-tight", urgency === "critical" && "animate-pulse")} role="timer" aria-live="off">
            {left == null ? "--:--:--" : hms(left)}
          </p>
          <p className="mt-3 font-mono text-[10.5px] text-muted">{fmtUTC(team.submission_deadline).toUpperCase()}</p>
        </div>

        <Panel title="Status" action={!submission.is_draft ? <Badge tone="ok" dot>Submitted</Badge> : <Badge tone="warn" dot>Draft</Badge>}>
          <p className="flex items-center gap-2 font-mono text-[11px] text-muted" aria-live="polite">
            {!submission.is_draft ? <><Lock className="size-3" />LOCKED</> : saving ? "SAVING…" : savedAt ? <><Check className="size-3 text-ok" />DRAFT SAVED</> : "AUTOSAVE ON"}
          </p>
          <ul className="mt-4 space-y-2">
            {checklist.map(([k, ok]) => (
              <li key={k} className="flex items-center justify-between text-[13px]">
                <span className={ok ? "text-fg-2" : "text-fg"}>{k}</span>
                {ok ? <Check className="size-3.5 text-ok" /> : <span className="font-mono text-[10px] text-muted">TODO</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-[10px] text-muted">{done}/{checklist.length} complete</p>
        </Panel>

        {!isLocked && (
          <Button variant={confirming ? "danger" : "primary"} size="lg" className="w-full" onClick={submit} disabled={submitting}>
            <Send className="size-3.5" />{submitting ? "Submitting…" : confirming ? "Confirm — lock submission" : "Submit project"}
          </Button>
        )}
        {confirming && <p className="text-center font-mono text-[10.5px] text-muted">Submitting locks all fields. Click again to confirm.</p>}
      </aside>
    </div>
  );
}
