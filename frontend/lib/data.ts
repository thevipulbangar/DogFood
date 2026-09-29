// Seeded, deterministic mock data. Identical on server and client.
// In production every one of these comes from the self-hosted REST API.

import { mulberry32, hash, pad } from "./utils";
import { projectAverages, weightedScore, type RawScore } from "./scoring";

export type Role = "participant" | "judge" | "organizer" | "admin";

export const EVENT = {
  id: "EVT-2026-DGF",
  name: "Dogfood 2026",
  tagline: "Build the platform that will judge you.",
  startsAt: "2026-09-25T18:00:00Z",
  deadline: "2026-09-28T18:00:00Z",
  resultsAt: "2026-09-30T17:00:00Z",
  instance: "dogfood.local",
  version: "v1.4.2",
  build: "a91f3c2",
};

export const EVENTS = [
  { id: EVENT.id, name: "Dogfood 2026", status: "LIVE" as const },
  { id: "EVT-2025-DGF", name: "Dogfood 2025", status: "ARCHIVE" as const },
];

export type Track = { id: string; name: string; code: string; description: string };
export const TRACKS: Track[] = [
  { id: "core", code: "TRK-01", name: "Full Platform", description: "End-to-end lifecycle: auth, teams, submissions, judging, results." },
  { id: "judging", code: "TRK-02", name: "Judging Engine", description: "Rubrics, assignment, normalization and judge ergonomics." },
  { id: "community", code: "TRK-03", name: "Community & Trust", description: "Voting, comments, anti-abuse and audit trails." },
  { id: "devex", code: "TRK-04", name: "Integrations & API", description: "REST API, webhooks, embeds, certificates and bulk I/O." },
];

export type Prize = { id: string; name: string; amount: string; trackId: string | null; winners: number };
export const PRIZES: Prize[] = [
  { id: "grand", name: "Grand Prize", amount: "$10,000", trackId: null, winners: 1 },
  { id: "judging", name: "Best Judging Engine", amount: "$3,000", trackId: "judging", winners: 1 },
  { id: "community", name: "Best Community Experience", amount: "$3,000", trackId: "community", winners: 1 },
  { id: "devex", name: "Best Developer Platform", amount: "$3,000", trackId: "devex", winners: 1 },
  { id: "people", name: "People's Choice", amount: "$1,500", trackId: null, winners: 1 },
];

export const RUBRIC = [
  { id: "innovation", name: "Innovation", weight: 25, description: "Does it rethink how hackathons are run, or reproduce what exists?" },
  { id: "execution", name: "Technical Execution", weight: 30, description: "Correctness, robustness, test coverage and code quality under real load." },
  { id: "impact", name: "Impact", weight: 20, description: "Would organizers adopt it tomorrow? Does it solve real operational pain?" },
  { id: "design", name: "Design", weight: 25, description: "Clarity of UX for participants, judges and organizers alike." },
];

// ── People ────────────────────────────────────────────────────

export type User = { id: string; name: string; email: string; role: Role; handle: string; teamId?: string; judgeId?: string };

export const DEMO_USERS: User[] = [
  { id: "u_093", name: "Maya Okafor", email: "maya@voidrunners.dev", role: "participant", handle: "PARTICIPANT_093", teamId: "t02" },
  { id: "u_014", name: "Lena Brandt", email: "lena.brandt@judges.local", role: "judge", handle: "JUDGE_014", judgeId: "JUDGE_014" },
  { id: "u_002", name: "Theo Marchetti", email: "theo@dogfood.local", role: "organizer", handle: "ORGANIZER_002" },
  { id: "u_001", name: "Sam Adeyemi", email: "sam@dogfood.local", role: "admin", handle: "ADMIN" },
];

export type Judge = { id: string; name: string; title: string; bias: number };
export const JUDGES: Judge[] = [
  { id: "JUDGE_003", name: "Priya Raman", title: "Distributed Systems Lead", bias: 0.3 },
  { id: "JUDGE_007", name: "Marcus Hale", title: "Principal Engineer, Payments", bias: -0.9 },
  { id: "JUDGE_011", name: "Yuki Tanaka", title: "Design Engineer", bias: 0.6 },
  { id: "JUDGE_014", name: "Lena Brandt", title: "Staff SRE", bias: -0.2 },
  { id: "JUDGE_018", name: "Omar Farouk", title: "Security Researcher", bias: -0.5 },
  { id: "JUDGE_021", name: "Ines Duarte", title: "Developer Advocate", bias: 0.8 },
  { id: "JUDGE_026", name: "Kwame Mensah", title: "CTO, Seed-stage Startup", bias: 0.1 },
  { id: "JUDGE_032", name: "Sofia Rossi", title: "Open Source Maintainer", bias: -0.4 },
];

// ── Projects ──────────────────────────────────────────────────

type Seed = [name: string, tagline: string, stack: string[], track: string, team: string, description: string, draft?: boolean];

const SEEDS: Seed[] = [
  ["Tribunal", "A single Go binary that runs your entire hackathon from a USB stick.", ["Go", "SQLite", "htmx"], "core", "Null Pointers",
    "Tribunal compiles the full event lifecycle — registration, teams, submissions, judging and results — into one 18 MB binary with an embedded SQLite database. No containers, no runtime, no network required: copy it to a laptop at the venue and the event is live."],
  ["Quorum", "Real-time judging with live consensus tracking across panels.", ["Elixir", "Phoenix LiveView", "Postgres"], "judging", "Void Runners",
    "Quorum streams every score to a live consensus view so head judges can see disagreement as it happens. When two judges diverge by more than two points on a criterion, the project is flagged for a calibration conversation before results are computed.", true],
  ["Gavel", "Rubric-first judging that tells judges exactly where they're drifting.", ["Rust", "Axum", "SQLite"], "judging", "Iron Lattice",
    "Gavel tracks each judge's scoring distribution in real time and surfaces gentle drift warnings — 'you have scored Design 1.4 points above panel average'. Scores are stored as immutable events so every adjustment is explainable."],
  ["Scorecard", "Hackathon ops in a box with zero-config Docker Compose.", ["Next.js", "Prisma", "SQLite"], "core", "Paper Planes",
    "One `docker compose up` gives organizers a complete platform with seeded demo data, role-based dashboards and CSV exports. Designed to be forked and rebranded in an afternoon."],
  ["Arbiter", "Bias-aware score normalization with explainable adjustments.", ["Python", "FastAPI", "DuckDB"], "judging", "Signal & Noise",
    "Arbiter applies per-judge z-score normalization and shows every participant exactly how raw scores became final scores. Organizers can compare three normalization strategies side by side before publishing results."],
  ["Ledgerline", "Append-only audit trail with hash-chained event records.", ["Go", "Postgres", "React"], "community", "Merkle Street",
    "Every state change — a vote, a score, a deadline extension — is written to a hash-chained ledger. Anyone can export the chain and verify offline that no record was altered after the fact."],
  ["Jury Box", "Keyboard-driven judge console. Score 40 projects before lunch.", ["SvelteKit", "Drizzle", "SQLite"], "judging", "Hotkeys Anonymous",
    "Jury Box treats judging like a code review queue: J/K to move, number keys to score, Enter to submit. In user testing, judges completed their queue 38% faster than with spreadsheet-based judging."],
  ["Commons", "Community voting that resists brigading without CAPTCHAs.", ["Django", "HTMX", "Redis"], "community", "Open Floor",
    "Commons combines account age, velocity limits and vote-graph clustering to detect coordinated voting. Suspicious votes are quarantined for organizer review rather than silently dropped."],
  ["Hackbase", "Rails 8 monolith with Solid Queue webhooks and CSV everything.", ["Rails 8", "Hotwire", "SQLite"], "core", "Monorail",
    "Hackbase leans on boring technology: a single Rails app, SQLite in production and background jobs without Redis. Every table in the admin can be exported to CSV and re-imported with a dry-run diff."],
  ["Relay", "Webhooks and REST API with signed payloads and replay.", ["Bun", "Hono", "SQLite"], "devex", "Packet Loss",
    "Relay exposes the complete platform over a versioned REST API with HMAC-signed webhooks. Failed deliveries are retried with exponential backoff and can be replayed from the admin console."],
  ["Exhibit", "Embeddable project gallery as a 4 KB web component.", ["Lit", "Deno", "SQLite"], "devex", "Small Batch",
    "Drop one script tag into any page and Exhibit renders a live, filterable gallery of submitted projects. It works without cookies and respects prefers-reduced-motion and dark mode."],
  ["Certify", "Verifiable certificates with offline signature checks.", ["TypeScript", "Ed25519", "SQLite"], "devex", "Proof of Work",
    "Certify issues certificates signed with the instance's Ed25519 key. A verification page — or any machine with the public key — can confirm authenticity without contacting the server."],
  ["Panel", "Laravel + Livewire platform with role isolation by design.", ["Laravel", "Livewire", "MySQL"], "core", "Artisan Collective",
    "Panel enforces role isolation at the query layer: a judge's database session physically cannot read another judge's scores. Policies are covered by 212 authorization tests."],
  ["Consensus", "Pairwise comparison judging using Bradley–Terry ranking.", ["Python", "Litestar", "Postgres"], "judging", "Pairwise",
    "Instead of absolute scores, judges answer 'which of these two is better?'. Consensus fits a Bradley–Terry model to produce a ranking with confidence intervals, reducing fatigue on large queues."],
  ["Townhall", "Threaded project comments with moderation queues.", ["Remix", "Postgres", "Tailwind"], "community", "Front Porch",
    "Townhall brings respectful discussion to project pages with threaded comments, rate limits per author and a moderation queue with one-click restore for false positives."],
  ["Kickoff", "From CSV import to live event in under five minutes.", [".NET 9", "Blazor", "SQLite"], "core", "Blue Screen Club",
    "Kickoff's setup wizard imports participants, judges, tracks and prizes from CSV, validates everything and generates invite links in bulk. The median organizer setup time in testing was 4m 12s."],
  ["Beacon", "Deadline enforcement with server-authoritative clocks.", ["Kotlin", "Ktor", "Postgres"], "core", "Latency Zero",
    "Beacon never trusts the client clock. Submissions lock at the server's deadline with a configurable grace window, and every lock event is recorded in the audit trail."],
  ["Shortlist", "Judge assignment solver balancing load and conflicts of interest.", ["Go", "OR-Tools", "SQLite"], "judging", "Constraint Solvers",
    "Shortlist formulates judge assignment as a constraint problem: equal load, track expertise, minimum coverage per project and zero conflicts of interest. It re-solves incrementally when a judge drops out."],
  ["Plaza", "Public voting with randomized order and fairness metrics.", ["Vue 3", "Nitro", "SQLite"], "community", "Fair Share",
    "Plaza randomizes project order per voter and tracks position bias across the event. Organizers see a fairness report showing whether early-listed projects received disproportionate votes."],
  ["Stackrank", "Hackathon platform with a first-class GraphQL and REST API.", ["NestJS", "Postgres", "React"], "devex", "Schema First",
    "Stackrank is API-first: the web UI is just one client of a documented REST and GraphQL API. Personal access tokens are scoped per role and per event."],
  ["Hearth", "Offline-first PWA for judges in venues with bad Wi-Fi.", ["React", "IndexedDB", "Hono"], "judging", "No Signal",
    "Hearth caches the judge's entire queue locally and syncs scores when connectivity returns, resolving conflicts with vector clocks. Tested through a full day in a basement venue."],
  ["Dossier", "Every submission becomes a structured, exportable case file.", ["Phoenix", "Elixir", "SQLite"], "core", "Case Closed",
    "Dossier structures submissions into typed fields — problem, approach, architecture, demo — so judges compare like with like. Each project exports as a self-contained static HTML archive."],
  ["Sentinel", "Rate limiting and duplicate-vote detection as a drop-in module.", ["Rust", "Tower", "Redis"], "community", "Byte Guard",
    "Sentinel is a Tower middleware that adds sliding-window rate limits, device fingerprint deduplication and anomaly alerts to any voting endpoint, with every decision written to the audit log."],
  ["Forge", "Bulk import/export engine with dry-run diffs.", ["Python", "Django", "Postgres"], "devex", "Migration Crew",
    "Forge validates bulk imports row by row, shows a diff of what will change and applies it in a single transaction — or not at all. Round-trips losslessly through CSV and JSON."],
  ["Podium", "Cinematic results reveal for live stage presentations.", ["SolidStart", "SQLite", "Canvas"], "community", "Stage Left",
    "Podium turns the results announcement into a stage-ready presenter mode with keyboard-controlled reveals, a confidence monitor for hosts and an instant public results page once the last prize is shown."],
  ["Gatekeeper", "RBAC with policy-as-code and permission diff reviews.", ["Go", "Cedar", "Postgres"], "core", "Least Privilege",
    "Gatekeeper expresses every permission as a Cedar policy checked on the server. Changing a role produces a human-readable diff of exactly which actions become allowed or denied."],
  ["Meridian", "Multi-timezone event scheduling that never confuses UTC.", ["Deno", "Fresh", "SQLite"], "core", "Timezone Hell",
    "Meridian shows every deadline in UTC and the viewer's local time side by side, and refuses to save an event whose dates are ambiguous across daylight-saving transitions.", true],
  ["Tally", "A minimal voting service in 800 lines of Zig.", ["Zig", "SQLite"], "community", "Low Level",
    "Tally is an exercise in restraint: a complete voting service with duplicate detection and rate limiting in under 800 lines, serving 40k votes per second on a Raspberry Pi 5.", true],
  ["Crucible", "End-to-end tested hackathon platform with 94% coverage.", ["Spring Boot", "Kotlin", "Postgres"], "core", "Test Pilots",
    "Crucible ships with 1,100 tests including full-lifecycle end-to-end scenarios: register, form a team, submit, judge, normalize and publish results — all against a real database."],
  ["Signal", "Webhook fan-out to Slack, Discord and Matrix — self-hosted.", ["Gleam", "Wisp", "SQLite"], "devex", "Actor Model",
    "Signal subscribes to platform events and fans them out to chat platforms with per-channel filters and templates. Built on the BEAM for fault-tolerant delivery.", true],
];

const FIRST = ["Alex", "Sarah", "Rahul", "Maya", "Jonas", "Aiko", "Diego", "Fatima", "Noah", "Lucia", "Kenji", "Amara", "Leo", "Zara", "Mateo", "Hana", "Ivan", "Nia", "Oscar", "Priya", "Tomás", "Elif", "Chen", "Ada", "Felix", "Imani", "Soren", "Yara", "Ravi", "Mila"];
const LAST = ["Chen", "Lindqvist", "Menon", "Okafor", "Weber", "Sato", "Alvarez", "Haddad", "Kim", "Moreau", "Ito", "Nwosu", "Novak", "Rahman", "Silva", "Park", "Petrov", "Mbeki", "Larsen", "Iyer", "Costa", "Yilmaz", "Wu", "Byrne", "Kowalski", "Osei", "Berg", "Nasser", "Kapoor", "Horvat"];
const COUNTRIES = ["DE", "JP", "IN", "NG", "BR", "US", "FR", "KR", "GH", "SE", "TR", "PL", "CA", "PT", "KE"];

export type Member = { name: string; handle: string; role: "captain" | "member"; country: string; initials: string };
export type Team = { id: string; name: string; members: Member[]; inviteCode: string; projectId: number; createdAt: string };
export type Project = {
  id: number;
  code: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  trackId: string;
  teamId: string;
  stack: string[];
  status: "submitted" | "draft";
  submittedAt: string | null;
  updatedAt: string;
  repo: string;
  demo: string;
  quality: number;
};

const rng = mulberry32(2026);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const START = Date.parse(EVENT.startsAt);
/** The moment the seed data was captured. */
const NOW_ANCHOR = Date.parse("2026-09-27T07:58:00Z");

export const TEAMS: Team[] = [];
export const PROJECTS: Project[] = SEEDS.map(([name, tagline, stack, trackId, teamName, description, draft], i) => {
  const id = [47, 12, 81, 112, 5, 23, 64, 38, 90, 17, 101, 56, 73, 29, 118, 44, 9, 86, 33, 125, 61, 97, 14, 70, 108, 52, 131, 136, 3, 140][i];
  const teamId = `t${pad(i + 1, 2)}`;
  const size = teamName === "Void Runners" ? 4 : 2 + Math.floor(rng() * 3);
  const members: Member[] =
    teamName === "Void Runners"
      ? [
          { name: "Maya Okafor", handle: "PARTICIPANT_093", role: "captain", country: "NG", initials: "MO" },
          { name: "Alex Chen", handle: "PARTICIPANT_094", role: "member", country: "CA", initials: "AC" },
          { name: "Sarah Lindqvist", handle: "PARTICIPANT_095", role: "member", country: "SE", initials: "SL" },
          { name: "Rahul Menon", handle: "PARTICIPANT_096", role: "member", country: "IN", initials: "RM" },
        ]
      : Array.from({ length: size }, (_, m) => {
          const f = FIRST[Math.floor(rng() * FIRST.length)];
          const l = LAST[Math.floor(rng() * LAST.length)];
          return {
            name: `${f} ${l}`,
            handle: `PARTICIPANT_${pad(100 + i * 4 + m)}`,
            role: m === 0 ? ("captain" as const) : ("member" as const),
            country: COUNTRIES[Math.floor(rng() * COUNTRIES.length)],
            initials: `${f[0]}${l[0]}`,
          };
        });
  const created = START + rng() * 6 * 3600e3;
  TEAMS.push({ id: teamId, name: teamName, members, inviteCode: hash(teamName).toString(36).slice(0, 6).toUpperCase(), projectId: id, createdAt: iso(created) });
  const submitted = draft ? null : START + (14 + rng() * 22) * 3600e3;
  return {
    id,
    code: `PROJECT ${pad(id)}`,
    slug: slugify(name),
    name,
    tagline,
    description,
    trackId,
    teamId,
    stack,
    status: draft ? "draft" : "submitted",
    submittedAt: submitted ? iso(submitted) : null,
    updatedAt: iso((submitted ?? START + 58 * 3600e3) - rng() * 3600e3),
    repo: `git.dogfood.local/${slugify(teamName)}/${slugify(name)}`,
    demo: `${slugify(name)}.demo.dogfood.local`,
    quality: 6.2 + rng() * 3,
  };
});

export const projectById = (id: number) => PROJECTS.find((p) => p.id === id);
export const teamById = (id: string) => TEAMS.find((t) => t.id === id)!;
export const trackById = (id: string) => TRACKS.find((t) => t.id === id)!;
export const SUBMITTED = PROJECTS.filter((p) => p.status === "submitted");

// ── Assignments & scores ──────────────────────────────────────

export type AssignmentStatus = "not_started" | "in_progress" | "submitted" | "flagged";
export type Assignment = {
  judgeId: string;
  projectId: number;
  status: AssignmentStatus;
  scores: Record<string, number>;
  confidence: number;
  notes: string;
  submittedAt: string | null;
};

const NOTES = [
  "Strong architecture write-up. Demo covered the full lifecycle without a hitch.",
  "Impressive normalization math; UI for organizers needs another pass.",
  "Ran it locally from a clean clone in under two minutes. Excellent README.",
  "Role isolation verified by attempting cross-judge reads — correctly denied.",
  "Webhook signatures validated. Retry behaviour is well thought out.",
  "Good idea, but the demo video skipped the judging flow entirely.",
  "Accessibility is clearly considered: full keyboard support, visible focus.",
];

export const ASSIGNMENTS: Assignment[] = [];
SUBMITTED.forEach((p, i) => {
  const picks = [i % 8, (i + 3) % 8, (i + 5) % 8];
  for (const j of picks) {
    const judge = JUDGES[j];
    const r = rng();
    const status: AssignmentStatus = r < 0.64 ? "submitted" : r < 0.8 ? "in_progress" : r < 0.97 ? "not_started" : "flagged";
    const scores: Record<string, number> = {};
    if (status !== "not_started") {
      for (const c of RUBRIC) {
        if (status === "in_progress" && rng() < 0.4) continue;
        scores[c.id] = Math.round(Math.min(10, Math.max(3, p.quality + judge.bias + (rng() - 0.5) * 1.6)) * 10) / 10;
      }
    }
    ASSIGNMENTS.push({
      judgeId: judge.id,
      projectId: p.id,
      status,
      scores,
      confidence: 3 + Math.floor(rng() * 3),
      notes: status === "not_started" ? "" : NOTES[Math.floor(rng() * NOTES.length)],
      submittedAt: status === "submitted" ? iso(Math.min(NOW_ANCHOR - rng() * 3600e3, Date.parse(p.submittedAt!) + (1 + rng() * 8) * 3600e3)) : null,
    });
  }
});

export const RAW_SCORES: RawScore[] = ASSIGNMENTS.filter((a) => a.status === "submitted").map((a) => ({
  judge: a.judgeId,
  project: a.projectId,
  raw: weightedScore(a.scores, RUBRIC),
}));

export const PROJECT_SCORES = projectAverages(RAW_SCORES);

export function judgeStats(judgeId: string) {
  const mine = ASSIGNMENTS.filter((a) => a.judgeId === judgeId);
  const done = mine.filter((a) => a.status === "submitted");
  const avg = done.length ? done.reduce((s, a) => s + weightedScore(a.scores, RUBRIC), 0) / done.length : 0;
  return { assigned: mine.length, completed: done.length, remaining: mine.length - done.length, average: avg, assignments: mine };
}

/** Ranked leaderboard over normalized scores. */
export const LEADERBOARD = [...PROJECT_SCORES]
  .map(([projectId, s]) => ({ project: projectById(projectId)!, ...s }))
  .sort((a, b) => b.normalized - a.normalized);

// ── Comments ──────────────────────────────────────────────────

const COMMENT_POOL = [
  "Ran this locally on an old ThinkPad — booted in under a second. Seriously impressive.",
  "How do you handle a judge who is assigned a project from their own company?",
  "The audit export is exactly what our org needed last year. Following this one.",
  "Love that it works fully offline. Our venue Wi-Fi died twice at our last event.",
  "Would be great to see the normalization strategy documented in the README.",
  "Clean keyboard shortcuts. Scored the demo queue without touching the mouse.",
  "Does the embed respect the host page's color scheme?",
];

export type Comment = { id: string; author: string; handle: string; body: string; at: string };
export function commentsFor(projectId: number): Comment[] {
  const r = mulberry32(projectId * 7);
  const n = 1 + Math.floor(r() * 3);
  return Array.from({ length: n }, (_, k) => {
    const f = FIRST[Math.floor(r() * FIRST.length)];
    const l = LAST[Math.floor(r() * LAST.length)];
    return {
      id: `c${projectId}-${k}`,
      author: `${f} ${l}`,
      handle: `PARTICIPANT_${pad(Math.floor(r() * 240))}`,
      body: COMMENT_POOL[Math.floor(r() * COMMENT_POOL.length)],
      at: iso(NOW_ANCHOR - 1800e3 - r() * 20 * 3600e3),
    };
  }).sort((a, b) => b.at.localeCompare(a.at));
}

// ── Audit ledger ──────────────────────────────────────────────

export type AuditEvent = { id: string; at: string; actor: string; action: string; object: string; ip: string; detail: string };

const ACTIONS: [action: string, actor: () => string, detail: string, weight: number][] = [
  ["SCORE_SUBMITTED", () => JUDGES[Math.floor(rng() * 8)].id, "Final score recorded", 5],
  ["SCORE_DRAFT_SAVED", () => JUDGES[Math.floor(rng() * 8)].id, "Draft autosaved", 4],
  ["JUDGE_ASSIGNED", () => "ORGANIZER_002", "Assignment created by solver", 2],
  ["SUBMISSION_UPDATED", () => `PARTICIPANT_${pad(90 + Math.floor(rng() * 120))}`, "Fields changed: description, demo", 5],
  ["SUBMISSION_CREATED", () => `PARTICIPANT_${pad(90 + Math.floor(rng() * 120))}`, "Draft created", 2],
  ["VOTE_CAST", () => `VOTER_${pad(Math.floor(rng() * 900), 4)}`, "Community vote accepted", 6],
  ["VOTE_REJECTED_DUPLICATE", () => `VOTER_${pad(Math.floor(rng() * 900), 4)}`, "Duplicate device fingerprint", 1],
  ["RATE_LIMIT_TRIGGERED", () => `VOTER_${pad(Math.floor(rng() * 900), 4)}`, "12 req / 10s exceeded", 1],
  ["COMMENT_POSTED", () => `PARTICIPANT_${pad(90 + Math.floor(rng() * 120))}`, "Comment published", 3],
  ["TEAM_MEMBER_JOINED", () => `PARTICIPANT_${pad(90 + Math.floor(rng() * 120))}`, "Joined via invite link", 2],
  ["EXPORT_GENERATED", () => "ADMIN", "submissions.csv (219 rows)", 1],
  ["WEBHOOK_DELIVERED", () => "SYSTEM", "POST 200 · 84ms", 2],
  ["RUBRIC_UPDATED", () => "ORGANIZER_002", "Weights locked", 1],
  ["ROLE_GRANTED", () => "ADMIN", "Role judge granted", 1],
];
const ACTION_BAG = ACTIONS.flatMap((a) => Array(a[3]).fill(a) as typeof ACTIONS);

export const AUDIT: AuditEvent[] = (() => {
  let t = NOW_ANCHOR + 18_000;
  return Array.from({ length: 120 }, (_, i) => {
    const [action, actor, detail] = ACTION_BAG[Math.floor(rng() * ACTION_BAG.length)];
    const p = PROJECTS[Math.floor(rng() * PROJECTS.length)];
    const ev: AuditEvent = {
      id: `evt_${(0xa3f000 + 120 - i).toString(16)}`,
      at: iso(t),
      actor: actor(),
      action,
      object: action === "ROLE_GRANTED" ? `USER_${pad(Math.floor(rng() * 300))}` : `PROJECT_${pad(p.id)}`,
      ip: `10.0.${Math.floor(rng() * 8)}.${Math.floor(rng() * 254) + 1}`,
      detail,
    };
    t -= (20 + rng() * 140) * 1000;
    return ev;
  });
})();

// ── Time series for analytics ─────────────────────────────────

/** Cumulative submissions by 6h bucket since the event opened. */
export const SUBMISSION_TIMELINE = Array.from({ length: 7 }, (_, i) => {
  const bucketEnd = START + (i + 1) * 6 * 3600e3;
  return { label: `+${(i + 1) * 6}h`, value: PROJECTS.filter((p) => p.submittedAt && Date.parse(p.submittedAt) <= bucketEnd).length };
});

export const VOTING_ACTIVITY = Array.from({ length: 24 }, (_, h) => ({
  label: `${pad(h, 2)}:00`,
  value: Math.round(40 + 120 * Math.max(0, Math.sin(((h - 6) / 24) * Math.PI * 2)) + rng() * 30),
}));

export const NOTIFICATIONS = [
  { id: "n1", title: "Submission deadline in 24h", body: "Drafts lock automatically at 18:00 UTC on 28 Sep.", at: "2026-09-27T07:30:00Z", unread: true },
  { id: "n2", title: "New comment on Quorum", body: "Ines Duarte: “Love the consensus view.”", at: "2026-09-27T06:12:00Z", unread: true },
  { id: "n3", title: "Webhook delivery recovered", body: "hooks.local/discord responded 200 after 2 retries.", at: "2026-09-27T04:40:00Z", unread: false },
];
