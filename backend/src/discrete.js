// Discrete mathematics used by judging (MM0705 units 1–6).
// Pure functions, no database: easy to unit test (tests/discrete.test.js).

// ── Unit 2 · Basic counting ─────────────────────────────────────────────
// BigInt because n! and C(n,k)^P overflow normal numbers very quickly.

export function factorial(n) {
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return r;
}

// C(n, k): number of ways to pick a k-judge panel from n judges.
export function choose(n, k) {
  if (k < 0 || k > n) return 0n;
  k = Math.min(k, n - k);
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - k + i)) / BigInt(i);
  return r;
}

// ── Unit 3 · Advanced combinatorics ─────────────────────────────────────

// Derangements D(n): ways to give n judges n teams so nobody gets their own.
// Inclusion–exclusion: D(n) = Σ_{i=0..n} (-1)^i · C(n,i) · (n-i)!
// (Dividing by n! gives Σ (-1)^i / i!, the coefficients of the exponential
// generating function e^{-x} / (1-x).)
export function derangementsIE(n) {
  let r = 0n;
  for (let i = 0; i <= n; i++) r += (i % 2 ? -1n : 1n) * choose(n, i) * factorial(n - i);
  return r;
}

// Valid k-panels for a project when c of the n judges have a conflict with it.
// Inclusion–exclusion over the c "bad" judges: panels containing i chosen bad
// judges number C(n-i, k-i), so valid = Σ (-1)^i C(c,i) C(n-i, k-i).
// (It collapses to C(n-c, k); the test checks both agree.)
export function validPanels(n, c, k) {
  let r = 0n;
  for (let i = 0; i <= c; i++) r += (i % 2 ? -1n : 1n) * choose(c, i) * choose(n - i, k - i);
  return r;
}

// Pigeonhole bound: P projects × k judges each = P·k reviews over J judges,
// so the busiest judge must do at least ⌈P·k / J⌉. We use that as the cap.
export const workloadCap = (P, k, J) => (J ? Math.ceil((P * k) / J) : 0);

// ── Unit 4 · Recurrences ────────────────────────────────────────────────

// Derangements again, this time by recurrence: D(n) = (n-1)(D(n-1) + D(n-2)),
// D(0) = 1, D(1) = 0. Must equal derangementsIE(n).
export function derangementsRec(n) {
  let [a, b] = [1n, 0n]; // D(0), D(1)
  if (n === 0) return a;
  for (let i = 2; i <= n; i++) [a, b] = [b, BigInt(i - 1) * (a + b)];
  return b;
}

// Elimination rounds: each round keeps the top half (rounded up).
// R(1) = 0, R(n) = 1 + R(⌈n/2⌉)  →  R(n) = ⌈log₂ n⌉.
export const roundCount = (n) => (n <= 1 ? 0 : 1 + roundCount(Math.ceil(n / 2)));

export function eliminationRounds(ranked) {
  const rounds = [ranked];
  while (rounds.at(-1).length > 1) rounds.push(rounds.at(-1).slice(0, Math.ceil(rounds.at(-1).length / 2)));
  return rounds;
}

// ── Unit 5 · Modular arithmetic ─────────────────────────────────────────
// Project i in round r starts its judge search at (i·k + r) mod J, so the
// starting judge rotates around the list and shifts every round.
export const rotation = (i, k, r, J) => Array.from({ length: J }, (_, t) => (i * k + r + t) % J);

// ── Unit 6 · Graph theory ───────────────────────────────────────────────

// Bipartite matching as max-flow (Edmonds–Karp):
//   source → project (capacity = judges still needed)
//   project → judge  (capacity 1, only if no conflict and not already paired)
//   judge → sink     (capacity = workload cap − current load)
// Max flow = most (judge, project) pairs possible under every rule at once.
function maxFlowPairs({ projects, judges, need, spare, allowed, round, k }) {
  const P = projects.length, J = judges.length, S = 0, T = P + J + 1;
  const g = Array.from({ length: T + 1 }, () => []);
  const add = (u, v, cap) => {
    g[u].push({ to: v, cap, rev: g[v].length });
    g[v].push({ to: u, cap: 0, rev: g[u].length - 1 });
  };
  projects.forEach((_, i) => add(S, 1 + i, need[i]));
  projects.forEach((p, i) => {
    for (const j of rotation(i, k, round, J)) if (allowed(judges[j], p)) add(1 + i, 1 + P + j, 1);
  });
  judges.forEach((_, j) => add(1 + P + j, T, spare[j]));

  for (;;) {
    const prev = new Array(T + 1).fill(null);
    prev[S] = { u: S };
    const queue = [S];
    while (queue.length && !prev[T]) {
      const u = queue.shift();
      for (const e of g[u]) if (e.cap > 0 && !prev[e.to]) { prev[e.to] = { u, e }; queue.push(e.to); }
    }
    if (!prev[T]) break;
    for (let v = T; v !== S; v = prev[v].u) { prev[v].e.cap -= 1; g[v][prev[v].e.rev].cap += 1; }
  }

  const pairs = [];
  projects.forEach((p, i) => {
    for (const e of g[1 + i]) if (e.to > P && e.to < T && e.cap === 0) pairs.push({ judge_id: judges[e.to - 1 - P], submission_id: p });
  });
  return pairs;
}

// Plans new assignments on top of `existing` ones. Starts at the pigeonhole
// cap and only raises it if conflicts make a full assignment impossible.
export function planAssignment({ projects, judges, k, conflicts = new Set(), existing = [], round = 0 }) {
  const J = judges.length, P = projects.length;
  if (!J || !P) return { pairs: [], cap: 0 };
  k = Math.min(k, J);
  const paired = new Set(existing.map((e) => `${e.judge_id}:${e.submission_id}`));
  const allowed = (j, p) => !conflicts.has(`${j}:${p}`) && !paired.has(`${j}:${p}`);
  const need = projects.map((p) => Math.max(0, k - existing.filter((e) => e.submission_id === p).length));
  const load = judges.map((j) => existing.filter((e) => e.judge_id === j).length);
  const total = need.reduce((a, b) => a + b, 0);

  for (let cap = workloadCap(P, k, J); ; cap++) {
    const spare = load.map((l) => Math.max(0, cap - l));
    const pairs = maxFlowPairs({ projects, judges, need, spare, allowed, round, k });
    if (pairs.length === total || cap >= P) return { pairs, cap };
  }
}

// Greedy (Welsh–Powell) colouring. Vertices = projects; an edge joins two
// projects that share a judge. Colour = presentation time slot, so no judge
// is ever needed in two rooms at once. Uses at most (max degree + 1) slots.
export function colourSlots(pairs) {
  const judgesOf = new Map();
  for (const { judge_id, submission_id } of pairs) {
    if (!judgesOf.has(submission_id)) judgesOf.set(submission_id, new Set());
    judgesOf.get(submission_id).add(judge_id);
  }
  const ids = [...judgesOf.keys()];
  const adj = new Map(ids.map((p) => [p, ids.filter((q) => q !== p && [...judgesOf.get(p)].some((j) => judgesOf.get(q).has(j)))]));
  const slot = new Map();
  for (const p of ids.sort((a, b) => adj.get(b).length - adj.get(a).length || a - b)) {
    const used = new Set(adj.get(p).map((q) => slot.get(q)));
    let c = 1;
    while (used.has(c)) c++;
    slot.set(p, c);
  }
  return slot;
}

// ── Unit 1 · Logic ──────────────────────────────────────────────────────
// The assignment is valid iff all four propositions hold:
//   ∀p: |judges(p)| = k            (every project fully covered)
//   ∀(j,p): (j,p) ∉ conflicts       (nobody judges their own team)
//   ∀j: load(j) ≤ cap               (workload bound)
//   pairs is a set (no duplicates)  (the relation judge×project has no repeats)
export function checkAssignment({ pairs, projects, k, cap, conflicts = new Set() }) {
  const keys = pairs.map((x) => `${x.judge_id}:${x.submission_id}`);
  const count = (key, v) => pairs.filter((x) => x[key] === v).length;
  return {
    every_project_covered: projects.every((p) => count("submission_id", p) >= k),
    no_conflicts: keys.every((key) => !conflicts.has(key)),
    within_workload_cap: [...new Set(pairs.map((x) => x.judge_id))].every((j) => count("judge_id", j) <= cap),
    no_duplicates: new Set(keys).size === keys.length,
  };
}

// Proof sketch (induction) that plain rotation is balanced when J divides P·k:
// Base: after 0 projects every judge has load 0.
// Step: project i takes judges (i·k … i·k+k−1) mod J — k consecutive residues.
// After P projects the P·k picks cover residues 0…P·k−1 mod J, i.e. each
// residue exactly P·k/J times, so every judge's load is exactly P·k/J = cap. ∎
