"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Database, Download, FileUp, HardDrive, KeyRound, Minus, Plus, Save, ScrollText, Server, Shuffle, Webhook } from "lucide-react";
import {
  ASSIGNMENTS, AUDIT, DEMO_USERS, EVENT, JUDGES, PRIZES, PROJECTS, RUBRIC, SUBMITTED, TEAMS, TRACKS,
  projectById, teamById, trackById, type Assignment, type Role, type User,
} from "@/lib/data";
import { ROLE_LABEL } from "@/lib/rbac";
import { cn, downloadCSV, fmtUTC, pad } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Button, Field, Meta, Panel, StatusDot, buttonClass, fieldClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { STATUS_META } from "@/components/judging/JudgeDashboard";
import { DataTable } from "./DataTable";

type SectionId = "event" | "roles" | "tracks" | "prizes" | "rubric" | "assignments" | "voting" | "io" | "api" | "system";
const SECTIONS: { id: SectionId; label: string; adminOnly?: boolean }[] = [
  { id: "event", label: "Event configuration" },
  { id: "roles", label: "Roles & permissions", adminOnly: true },
  { id: "tracks", label: "Tracks" },
  { id: "prizes", label: "Prizes" },
  { id: "rubric", label: "Judging rubric" },
  { id: "assignments", label: "Judge assignments" },
  { id: "voting", label: "Voting settings" },
  { id: "io", label: "Import / Export" },
  { id: "api", label: "API & webhooks", adminOnly: true },
  { id: "system", label: "System", adminOnly: true },
];

function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line py-4 last:border-0">
      <div>
        <p className="text-[14px]">{label}</p>
        {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
      </div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 shrink-0 rounded-full border transition-colors", checked ? "border-accent bg-accent" : "border-line-strong bg-surface-3")}>
        <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 35 }} className={cn("absolute top-0.5 size-3.5 rounded-full", checked ? "right-0.5 bg-accent-ink" : "left-0.5 bg-fg-2")} />
      </button>
    </div>
  );
}

const toLocalInput = (iso: string) => iso.slice(0, 16);

function EventConfig() {
  const toast = useToast();
  const [v, setV] = useState({ name: EVENT.name, start: toLocalInput(EVENT.startsAt), deadline: toLocalInput(EVENT.deadline), results: toLocalInput(EVENT.resultsAt), grace: "5", maxTeam: "5" });
  const invalid = v.deadline <= v.start ? "Deadline must be after the start." : v.results <= v.deadline ? "Results must be after the deadline." : undefined;
  return (
    <Panel title="Event configuration" meta={EVENT.id}>
      <form className="grid gap-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!invalid) toast({ tone: "ok", title: "Event updated", body: "EVENT_UPDATED · audit logged" }); }}>
        <Field label="Event name" htmlFor="ev-name" className="sm:col-span-2"><input id="ev-name" className={cn(fieldClass, "h-10")} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Starts (UTC)" htmlFor="ev-start"><input id="ev-start" type="datetime-local" className={cn(fieldClass, "h-10 font-mono text-[13px]")} value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /></Field>
        <Field label="Submission deadline (UTC)" htmlFor="ev-deadline" error={invalid}><input id="ev-deadline" type="datetime-local" aria-invalid={!!invalid} className={cn(fieldClass, "h-10 font-mono text-[13px]")} value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} /></Field>
        <Field label="Results publish (UTC)" htmlFor="ev-results"><input id="ev-results" type="datetime-local" className={cn(fieldClass, "h-10 font-mono text-[13px]")} value={v.results} onChange={(e) => setV({ ...v, results: e.target.value })} /></Field>
        <Field label="Grace window" htmlFor="ev-grace" hint="Server-enforced">
          <select id="ev-grace" className={cn(fieldClass, "h-10")} value={v.grace} onChange={(e) => setV({ ...v, grace: e.target.value })}>
            {["0", "2", "5", "10"].map((g) => <option key={g} value={g}>{g === "0" ? "None" : `${g} minutes`}</option>)}
          </select>
        </Field>
        <Field label="Max team size" htmlFor="ev-team"><input id="ev-team" type="number" min={1} max={10} className={cn(fieldClass, "h-10 font-mono")} value={v.maxTeam} onChange={(e) => setV({ ...v, maxTeam: e.target.value })} /></Field>
        <div className="flex items-end justify-end gap-2 sm:col-span-2">
          <Button type="button" onClick={() => toast({ tone: "info", title: "New event draft", body: "EVT-2027-DGF created as draft — configure before publishing" })}><Plus className="size-3.5" />Create event</Button>
          <Button type="submit" variant="primary" disabled={!!invalid}><Save className="size-3.5" />Save changes</Button>
        </div>
      </form>
    </Panel>
  );
}

const PERMS: [string, Role[]][] = [
  ["View public gallery", ["participant", "judge", "organizer", "admin"]],
  ["Create & edit own submission", ["participant"]],
  ["Vote in community round", ["participant"]],
  ["Score assigned projects", ["judge"]],
  ["View all scores", ["organizer", "admin"]],
  ["Assign judges", ["organizer", "admin"]],
  ["Publish results", ["organizer", "admin"]],
  ["Export data", ["organizer", "admin"]],
  ["Manage roles", ["admin"]],
  ["API tokens & webhooks", ["admin"]],
  ["System configuration", ["admin"]],
];
const ROLES: Role[] = ["participant", "judge", "organizer", "admin"];

function RolesPermissions() {
  const toast = useToast();
  const users: (User & { status: string })[] = [
    ...DEMO_USERS.map((u) => ({ ...u, status: "active" })),
    ...JUDGES.filter((j) => j.id !== "JUDGE_014").map((j) => ({ id: j.id, name: j.name, email: `${j.name.split(" ")[0].toLowerCase()}@judges.local`, role: "judge" as Role, handle: j.id, status: "active" })),
    ...TEAMS.slice(2, 10).flatMap((t) => t.members.slice(0, 1)).map((m) => ({ id: m.handle, name: m.name, email: `${m.name.split(" ")[0].toLowerCase()}@teams.local`, role: "participant" as Role, handle: m.handle, status: "active" })),
  ];
  return (
    <div className="space-y-6">
      <Panel title="Permission matrix" meta="ENFORCED SERVER-SIDE" bodyClassName="p-0 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <caption className="sr-only">Permissions by role</caption>
          <thead><tr className="border-b border-line"><th scope="col" className="label px-4 py-3 font-normal">Capability</th>{ROLES.map((r) => <th key={r} scope="col" className="label px-4 py-3 text-center font-normal">{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>
            {PERMS.map(([p, roles]) => (
              <tr key={p} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-2.5 text-[13.5px] font-normal">{p}</th>
                {ROLES.map((r) => (
                  <td key={r} className="px-4 py-2.5 text-center">
                    {roles.includes(r) ? <Check className="mx-auto size-3.5 text-accent" aria-label="Allowed" /> : <Minus className="mx-auto size-3.5 text-line-strong" aria-label="Denied" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Accounts" meta={`${users.length} USERS`}>
        <DataTable caption="Accounts" rows={users} rowKey={(u) => u.id} search={(u) => `${u.name} ${u.email} ${u.handle} ${u.role}`}
          bulkActions={(sel, clear) => (<>
            <Button size="sm" onClick={() => { toast({ tone: "ok", title: `Judge role granted to ${sel.length}`, body: "ROLE_GRANTED · audit logged" }); clear(); }}>Grant judge</Button>
            <Button size="sm" variant="danger" onClick={() => { toast({ tone: "warn", title: `${sel.length} sessions revoked`, body: "SESSION_REVOKED" }); clear(); }}>Revoke sessions</Button>
          </>)}
          columns={[
            { key: "name", header: "Name", sort: (u) => u.name, cell: (u) => <span><span className="block text-fg">{u.name}</span><span className="font-mono text-[10.5px] text-muted">{u.email}</span></span> },
            { key: "handle", header: "Handle", sort: (u) => u.handle, cell: (u) => <span className="font-mono text-[11.5px] text-fg-2">{u.handle}</span> },
            { key: "role", header: "Role", sort: (u) => u.role, cell: (u) => <Badge tone={u.role === "admin" ? "accent" : u.role === "organizer" ? "steel" : "neutral"}>{ROLE_LABEL[u.role]}</Badge> },
            { key: "status", header: "Status", cell: () => <span className="flex items-center gap-2 font-mono text-[11px] text-fg-2"><StatusDot tone="ok" />ACTIVE</span> },
          ]} />
      </Panel>
    </div>
  );
}

function Tracks() {
  return (
    <Panel title="Tracks" meta={`${TRACKS.length} TRACKS`}>
      <DataTable caption="Tracks" rows={TRACKS} rowKey={(t) => t.id} search={(t) => `${t.name} ${t.description}`}
        columns={[
          { key: "code", header: "Code", sort: (t) => t.code, cell: (t) => <span className="font-mono text-[11.5px] text-muted">{t.code}</span> },
          { key: "name", header: "Track", sort: (t) => t.name, cell: (t) => <span><span className="block text-fg">{t.name}</span><span className="text-[12px] text-muted">{t.description}</span></span> },
          { key: "subs", header: "Submissions", align: "right", sort: (t) => SUBMITTED.filter((p) => p.trackId === t.id).length, cell: (t) => <span className="font-mono tabular">{SUBMITTED.filter((p) => p.trackId === t.id).length}</span> },
          { key: "drafts", header: "Drafts", align: "right", cell: (t) => <span className="font-mono tabular text-muted">{PROJECTS.filter((p) => p.trackId === t.id && p.status === "draft").length}</span> },
        ]} />
    </Panel>
  );
}

function Prizes() {
  return (
    <Panel title="Prizes" meta={`${PRIZES.length} PRIZES`}>
      <DataTable caption="Prizes" rows={PRIZES} rowKey={(p) => p.id}
        columns={[
          { key: "name", header: "Prize", sort: (p) => p.name, cell: (p) => <span className="text-fg">{p.name}</span> },
          { key: "track", header: "Scope", cell: (p) => <span className="font-mono text-[11.5px] text-fg-2">{p.trackId ? trackById(p.trackId).name : p.id === "people" ? "Community vote" : "Overall"}</span> },
          { key: "winners", header: "Winners", align: "right", cell: (p) => <span className="font-mono">{p.winners}</span> },
          { key: "amount", header: "Amount", align: "right", sort: (p) => +p.amount.replace(/\D/g, ""), cell: (p) => <span className="font-mono text-fg">{p.amount}</span> },
        ]} />
    </Panel>
  );
}

function Rubric() {
  const toast = useToast();
  const [weights, setWeights] = useState(Object.fromEntries(RUBRIC.map((c) => [c.id, c.weight])));
  const [locked, setLocked] = useState(true);
  const total = Object.values(weights).reduce((s, w) => s + (Number(w) || 0), 0);
  return (
    <Panel title="Judging rubric" meta={locked ? "LOCKED · SCORING IN PROGRESS" : "EDITING"}
      action={<Button size="sm" variant="ghost" onClick={() => setLocked((l) => !l)}>{locked ? "Unlock" : "Lock"}</Button>}>
      <ul className="space-y-3">
        {RUBRIC.map((c, i) => (
          <li key={c.id} className="grid items-center gap-3 rounded-md border border-line p-4 sm:grid-cols-[32px_1fr_120px]">
            <span className="font-mono text-[11px] text-muted">{pad(i + 1, 2)}</span>
            <div><p className="text-[14.5px]">{c.name}</p><p className="text-[12.5px] text-muted">{c.description}</p></div>
            <label className="flex items-center gap-2">
              <span className="sr-only">{c.name} weight</span>
              <input type="number" min={0} max={100} disabled={locked} value={weights[c.id]} onChange={(e) => setWeights({ ...weights, [c.id]: Number(e.target.value) })} className={cn(fieldClass, "h-9 text-right font-mono")} />
              <span className="font-mono text-muted">%</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between">
        <p className={cn("font-mono text-[12px]", total === 100 ? "text-ok" : "text-danger")} role="status">TOTAL {total}% {total === 100 ? "· VALID" : "· MUST EQUAL 100%"}</p>
        <Button variant="primary" disabled={locked || total !== 100} onClick={() => toast({ tone: "ok", title: "Rubric saved", body: "RUBRIC_UPDATED · existing scores re-weighted" })}><Save className="size-3.5" />Save rubric</Button>
      </div>
      {locked && <p className="mt-3 text-[12.5px] text-muted">Weights are locked while scoring is in progress. Unlocking and changing weights re-computes every weighted total and is recorded in the audit log.</p>}
    </Panel>
  );
}

function Assignments() {
  const toast = useToast();
  return (
    <Panel title="Judge assignments" meta={`${ASSIGNMENTS.length} ASSIGNMENTS · 3 / PROJECT`}>
      <DataTable<Assignment> caption="Judge assignments" rows={ASSIGNMENTS} rowKey={(a) => `${a.judgeId}:${a.projectId}`}
        search={(a) => `${a.judgeId} ${projectById(a.projectId)!.name} ${a.status} ${JUDGES.find((j) => j.id === a.judgeId)?.name}`}
        toolbar={<Button size="sm" onClick={() => toast({ tone: "ok", title: "Solver complete", body: "0 conflicts · load σ 0.4 · coverage 3/project" })}><Shuffle className="size-3" />Auto-assign</Button>}
        bulkActions={(sel, clear) => (<>
          <Button size="sm" onClick={() => { toast({ tone: "ok", title: `Reminder sent to ${new Set(sel.map((a) => a.judgeId)).size} judges`, body: "Delivered via local mail relay" }); clear(); }}>Send reminder</Button>
          <Button size="sm" onClick={() => { toast({ tone: "ok", title: `${sel.length} assignments rebalanced`, body: "JUDGE_ASSIGNED · audit logged" }); clear(); }}>Reassign</Button>
          <Button size="sm" variant="danger" onClick={() => { toast({ tone: "warn", title: `${sel.length} assignments removed`, body: "JUDGE_UNASSIGNED · audit logged" }); clear(); }}>Remove</Button>
        </>)}
        columns={[
          { key: "project", header: "Project", sort: (a) => projectById(a.projectId)!.name, cell: (a) => { const p = projectById(a.projectId)!; return <span><span className="block text-fg">{p.name}</span><span className="font-mono text-[10.5px] text-muted">{p.code} · {teamById(p.teamId).name}</span></span>; } },
          { key: "judge", header: "Judge", sort: (a) => a.judgeId, cell: (a) => <span><span className="block">{JUDGES.find((j) => j.id === a.judgeId)?.name}</span><span className="font-mono text-[10.5px] text-muted">{a.judgeId}</span></span> },
          { key: "status", header: "Status", sort: (a) => a.status, cell: (a) => <Badge tone={STATUS_META[a.status].tone} dot>{STATUS_META[a.status].label}</Badge> },
          { key: "at", header: "Scored", sort: (a) => a.submittedAt ?? "", cell: (a) => <span className="font-mono text-[11px] text-muted">{a.submittedAt ? fmtUTC(a.submittedAt) : "—"}</span> },
        ]} />
    </Panel>
  );
}

function Voting() {
  const [s, setS] = useState({ open: true, random: true, hidden: true, dupes: true, rate: true, comments: true });
  const set = (k: keyof typeof s) => (v: boolean) => setS({ ...s, [k]: v });
  return (
    <Panel title="Voting settings" meta="T3">
      <Switch label="Community voting open" description="Closes 30 SEP 2026 · 12:00 UTC" checked={s.open} onChange={set("open")} />
      <Switch label="Randomize project order" description="Per-voter seeded shuffle to remove position bias" checked={s.random} onChange={set("random")} />
      <Switch label="Hide tallies until results" description="Nobody — including organizers — sees counts before publishing" checked={s.hidden} onChange={set("hidden")} />
      <Switch label="Duplicate vote detection" description="Account + device fingerprint; duplicates are rejected and logged" checked={s.dupes} onChange={set("dupes")} />
      <Switch label="Rate limiting" description="1 vote action per 2 seconds, 12 requests / 10s per IP" checked={s.rate} onChange={set("rate")} />
      <Switch label="Comments enabled" description="1 comment / 20s per author, moderation queue for flagged content" checked={s.comments} onChange={set("comments")} />
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <Field label="Votes per voter" htmlFor="v-max"><input id="v-max" type="number" defaultValue={3} min={1} max={10} className={cn(fieldClass, "h-10 font-mono")} /></Field>
        <Field label="Minimum account age" htmlFor="v-age"><select id="v-age" defaultValue="24" className={cn(fieldClass, "h-10")}><option value="0">None</option><option value="24">24 hours</option><option value="72">72 hours</option></select></Field>
      </div>
    </Panel>
  );
}

function ImportExport() {
  const toast = useToast();
  const [preview, setPreview] = useState<{ name: string; rows: string[][]; errors: number } | null>(null);
  const exports = [
    { k: "Submissions", f: "submissions.csv", n: SUBMITTED.length, run: () => downloadCSV("dogfood-2026-submissions.csv", SUBMITTED.map((p) => ({ id: p.id, name: p.name, tagline: p.tagline, team: teamById(p.teamId).name, track: trackById(p.trackId).name, stack: p.stack.join(" · "), repo: p.repo, submitted_at: p.submittedAt }))) },
    { k: "Teams", f: "teams.csv", n: TEAMS.length, run: () => downloadCSV("dogfood-2026-teams.csv", TEAMS.map((t) => ({ id: t.id, name: t.name, members: t.members.map((m) => m.name).join("; "), invite: t.inviteCode, project: t.projectId }))) },
    { k: "Scores", f: "scores.csv", n: ASSIGNMENTS.filter((a) => a.status === "submitted").length, run: () => downloadCSV("dogfood-2026-scores.csv", ASSIGNMENTS.filter((a) => a.status === "submitted").map((a) => ({ judge: a.judgeId, project: a.projectId, ...a.scores, confidence: a.confidence }))) },
    { k: "Audit log", f: "audit.csv", n: AUDIT.length, run: () => downloadCSV("dogfood-2026-audit.csv", AUDIT.map(({ id, at, actor, action, object, detail }) => ({ id, at, actor, action, object, detail }))) },
  ];
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const rows = text.trim().split(/\r?\n/).map((l) => l.split(","));
    const width = rows[0]?.length ?? 0;
    setPreview({ name: file.name, rows, errors: rows.filter((r) => r.length !== width).length });
  };
  return (
    <div className="space-y-6">
      <Panel title="Export" meta="CSV · GENERATED LOCALLY">
        <ul className="grid gap-3 sm:grid-cols-2">
          {exports.map((e) => (
            <li key={e.f}>
              <button onClick={() => { e.run(); toast({ tone: "ok", title: `${e.k} exported`, body: `${e.f} · ${e.n} rows` }); }}
                className="group flex w-full items-center gap-4 rounded-md border border-line p-4 text-left transition-colors hover:border-line-strong">
                <Download className="size-4 text-muted group-hover:text-accent" />
                <span className="flex-1"><span className="block text-[14px]">{e.k}</span><span className="font-mono text-[10.5px] text-muted">{e.f} · {e.n} ROWS</span></span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Bulk import" meta="DRY RUN FIRST">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-line-strong p-8 text-center hover:border-accent/50"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
          <FileUp className="size-5 text-muted" />
          <span className="text-[13.5px] text-fg-2">Drop a CSV of participants, judges, tracks or projects</span>
          <span className="font-mono text-[10.5px] text-muted">PARSED IN YOUR BROWSER · NOTHING IS UPLOADED UNTIL YOU APPLY</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <AnimatePresence>
          {preview && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                <span className="text-fg-2">{preview.name} · {Math.max(0, preview.rows.length - 1)} ROWS · {preview.rows[0]?.length ?? 0} COLUMNS</span>
                <span className={preview.errors ? "text-danger" : "text-ok"}>{preview.errors ? `${preview.errors} MALFORMED ROWS` : "VALID"}</span>
              </div>
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full font-mono text-[11px]">
                  <tbody>
                    {preview.rows.slice(0, 6).map((r, i) => (
                      <tr key={i} className={cn("border-b border-line last:border-0", i === 0 && "bg-white/[0.03] text-muted")}>
                        {r.map((c, j) => <td key={j} className="whitespace-nowrap px-3 py-1.5">{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Discard</Button>
                <Button size="sm" variant="primary" disabled={!!preview.errors} onClick={() => { toast({ tone: "ok", title: "Import applied", body: `${preview.rows.length - 1} rows · single transaction` }); setPreview(null); }}>Apply import</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Panel>
    </div>
  );
}

const ENDPOINTS = [
  ["GET", "/api/v1/events/:id", "Event, tracks, prizes, dates"],
  ["GET", "/api/v1/projects", "Public gallery (submitted only)"],
  ["POST", "/api/v1/submissions", "Create or update own draft"],
  ["GET", "/api/v1/assignments", "Judge: own assignments only"],
  ["PUT", "/api/v1/scores/:project", "Judge: draft or submit score"],
  ["POST", "/api/v1/votes", "Cast community vote (rate limited)"],
  ["GET", "/api/v1/results", "Published results (403 before publish)"],
  ["GET", "/api/v1/certificates/:id/verify", "Offline-verifiable signature"],
];

function Api() {
  const toast = useToast();
  const [token, setToken] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <Panel title="REST API" meta={`http://${EVENT.instance}/api/v1`} bodyClassName="p-0">
        <ul className="divide-y divide-line font-mono text-[12px]">
          {ENDPOINTS.map(([m, path, d]) => (
            <li key={path + m} className="grid grid-cols-[56px_1fr] gap-x-3 gap-y-0.5 px-4 py-2.5 sm:grid-cols-[56px_300px_1fr]">
              <span className={m === "GET" ? "text-steel" : m === "POST" ? "text-ok" : "text-warn"}>{m}</span>
              <span className="text-fg">{path}</span>
              <span className="col-start-2 text-muted sm:col-start-auto">{d}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Access tokens" action={<Button size="sm" onClick={() => setToken(`dgf_${Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("")}`)}><KeyRound className="size-3" />New token</Button>}>
        {token ? (
          <div className="rounded-md border border-warn/30 bg-warn/[0.05] p-4">
            <p className="label text-warn">Copy now — this token is shown once</p>
            <div className="mt-2 flex gap-2">
              <code className="flex-1 truncate rounded-sm border border-line bg-bg px-3 py-2 font-mono text-[12px]">{token}</code>
              <Button onClick={async () => { try { await navigator.clipboard.writeText(token); toast({ tone: "ok", title: "Token copied" }); } catch { toast({ tone: "warn", title: "Clipboard unavailable" }); } }}><Copy className="size-3.5" /></Button>
            </div>
          </div>
        ) : (
          <dl><Meta k="ci-export (read:projects)" v="dgf_••••3fa1 · last used 2h ago" /><Meta k="discord-bot (read:results)" v="dgf_••••9b0c · never used" /></dl>
        )}
      </Panel>
      <Panel title="Webhooks" meta="HMAC-SHA256 SIGNED">
        <ul className="space-y-2 font-mono text-[12px]">
          {[["hooks.local/discord", "submission.locked, results.published", "200"], ["ci.local/dogfood", "score.submitted", "200"], ["matrix.local/announce", "results.published", "—"]].map(([u, ev, s]) => (
            <li key={u} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border border-line px-3 py-2.5">
              <Webhook className="size-3.5 text-muted" /><span className="text-fg">{u}</span><span className="text-muted">{ev}</span>
              <span className={cn("ml-auto", s === "200" ? "text-ok" : "text-muted")}>{s === "200" ? "● 200 OK" : "○ IDLE"}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function System() {
  const toast = useToast();
  const services = [
    { k: "dogfood-api", v: "healthy · :8080", icon: Server },
    { k: "dogfood-web", v: "healthy · :3000", icon: Server },
    { k: "database", v: "SQLite · 18.4 MB · WAL", icon: Database },
    { k: "storage", v: "./data/uploads · 212 MB", icon: HardDrive },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <div key={s.k} className="flex items-center gap-4 rounded-md border border-line bg-surface/70 p-4">
            <s.icon className="size-4 text-muted" />
            <span className="flex-1"><span className="block font-mono text-[12.5px]">{s.k}</span><span className="font-mono text-[11px] text-muted">{s.v}</span></span>
            <StatusDot tone="ok" pulse />
          </div>
        ))}
      </div>
      <Panel title="Instance">
        <dl className="grid gap-x-10 sm:grid-cols-2">
          <Meta k="Hostname" v={EVENT.instance} /><Meta k="Version" v={`${EVENT.version} (${EVENT.build})`} />
          <Meta k="Uptime" v="3d 14h 22m" /><Meta k="Last backup" v="27 SEP 2026 · 04:00 UTC" />
          <Meta k="Outbound network" v={<span className="text-ok">NOT REQUIRED</span>} /><Meta k="External services" v="None configured" />
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => toast({ tone: "ok", title: "Backup complete", body: "./backups/event-2026-09-27.db · 18.4 MB" })}><Database className="size-3.5" />Back up now</Button>
          <Link href="/audit" className={buttonClass("ghost")}><ScrollText className="size-3.5" />Audit log</Link>
        </div>
      </Panel>
    </div>
  );
}

export function AdminPanel({ user }: { user: User }) {
  const sections = SECTIONS.filter((s) => !s.adminOnly || user.role === "admin");
  const [active, setActive] = useState<SectionId>("event");
  const view: Record<SectionId, React.ReactNode> = {
    event: <EventConfig />, roles: <RolesPermissions />, tracks: <Tracks />, prizes: <Prizes />, rubric: <Rubric />,
    assignments: <Assignments />, voting: <Voting />, io: <ImportExport />, api: <Api />, system: <System />,
  };

  return (
    <>
      <PageHeader eyebrow={`${ROLE_LABEL[user.role]} · ${EVENT.id}`} title="Administration"
        meta={<><span>{sections.length} areas</span><span>All changes audited</span></>} />
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Administration sections" className="lg:sticky lg:top-24 lg:self-start">
          <label htmlFor="admin-section" className="sr-only">Section</label>
          <select id="admin-section" value={active} onChange={(e) => setActive(e.target.value as SectionId)} className={cn(fieldClass, "h-10 lg:hidden")}>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <ul className="hidden space-y-0.5 lg:block">
            {sections.map((s) => (
              <li key={s.id}>
                <button onClick={() => setActive(s.id)} aria-current={active === s.id ? "page" : undefined}
                  className={cn("relative flex h-9 w-full items-center rounded-sm px-3 text-left text-[13.5px] transition-colors", active === s.id ? "bg-white/[0.05] text-fg" : "text-fg-2 hover:text-fg")}>
                  {active === s.id && <motion.span layoutId="admin-nav" className="absolute inset-y-2 left-0 w-[2px] bg-accent" />}
                  {s.label}
                </button>
              </li>
            ))}
            <li className="pt-2"><Link href="/audit" className="flex h-9 items-center gap-2 px-3 text-[13.5px] text-muted hover:text-fg"><ScrollText className="size-3.5" />Audit log ↗</Link></li>
          </ul>
        </nav>
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.25 }} className="min-w-0">
            {view[active]}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
