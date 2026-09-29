// Everything the landing story shows is derived from the same seed data and
// scoring code the product uses. Nothing here is invented for marketing.

import {
  ASSIGNMENTS, JUDGES, LEADERBOARD, PROJECT_SCORES, PROJECTS, RAW_SCORES, RUBRIC, SUBMITTED, TRACKS,
  teamById, trackById,
} from "@/lib/data";
import { normalize, weightedScore } from "@/lib/scoring";
import { pad } from "@/lib/utils";

export { RUBRIC, TRACKS, JUDGES, PROJECTS, SUBMITTED, LEADERBOARD };

const judgeName = (id: string) => JUDGES.find((j) => j.id === id)!.name;

/** The project the camera follows: the highest-ranked one whose whole panel has submitted. */
const featuredRow =
  LEADERBOARD.find((r) => ASSIGNMENTS.filter((a) => a.projectId === r.project.id).every((a) => a.status === "submitted")) ??
  LEADERBOARD[0];

const panel = ASSIGNMENTS.filter((a) => a.projectId === featuredRow.project.id && a.status === "submitted");
const norm = normalize(RAW_SCORES);

export const FEATURED = {
  project: featuredRow.project,
  team: teamById(featuredRow.project.teamId),
  track: trackById(featuredRow.project.trackId),
  rank: LEADERBOARD.indexOf(featuredRow) + 1,
  raw: featuredRow.raw,
  normalized: featuredRow.normalized,
  judges: panel.map((a) => ({
    id: a.judgeId,
    name: judgeName(a.judgeId),
    title: JUDGES.find((j) => j.id === a.judgeId)!.title,
    scores: RUBRIC.map((c) => a.scores[c.id] ?? 0),
    raw: weightedScore(a.scores, RUBRIC),
    normalized: norm.get(`${a.judgeId}:${a.projectId}`) ?? weightedScore(a.scores, RUBRIC),
    confidence: a.confidence,
  })),
};

/** Per-criterion mean across the featured project's panel. */
export const FEATURED_CRITERIA = RUBRIC.map((c, i) => ({
  ...c,
  score: FEATURED.judges.reduce((s, j) => s + j.scores[i], 0) / Math.max(1, FEATURED.judges.length),
}));

// ── Analytics datasets (same derivations as /analytics) ───────────

const done = ASSIGNMENTS.filter((a) => a.status === "submitted");

export const SCORE_POINTS = done.map((a) => ({
  judge: a.judgeId,
  judgeIndex: JUDGES.findIndex((j) => j.id === a.judgeId),
  projectId: a.projectId,
  projectIndex: SUBMITTED.findIndex((p) => p.id === a.projectId),
  raw: weightedScore(a.scores, RUBRIC),
  normalized: norm.get(`${a.judgeId}:${a.projectId}`) ?? 0,
  label: `${a.judgeId} → P-${pad(a.projectId)}`,
}));

export const CRITERION_AVG = RUBRIC.map((c) => {
  const vals = done.map((a) => a.scores[c.id]).filter((v): v is number => v != null);
  return { id: c.id, label: c.name, weight: c.weight, value: vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length) };
});

export const JUDGE_SPREAD = JUDGES.map((j) => {
  const xs = SCORE_POINTS.filter((p) => p.judge === j.id).map((p) => p.raw);
  const mean = xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);
  return { id: j.id, name: j.name, mean, min: Math.min(...xs), max: Math.max(...xs), n: xs.length };
});

export const TOP = LEADERBOARD.slice(0, 8).map((r, i) => ({
  rank: i + 1, id: r.project.id, name: r.project.name, team: teamById(r.project.teamId).name, raw: r.raw, normalized: r.normalized, count: r.count,
}));

/** Scored projects as they travel the hero pipeline, with their per-criterion panel means. */
export const PIPELINE = LEADERBOARD.map((r) => {
  const mine = done.filter((a) => a.projectId === r.project.id);
  return {
    id: r.project.id,
    code: `P-${pad(r.project.id)}`,
    track: trackById(r.project.trackId).code,
    name: r.project.name,
    score: r.normalized,
    crit: RUBRIC.map((c) => mine.reduce((s, a) => s + (a.scores[c.id] ?? 0), 0) / Math.max(1, mine.length)),
  };
});

export const STATS = {
  projects: PROJECTS.length,
  submitted: SUBMITTED.length,
  judges: JUDGES.length,
  scores: done.length,
  assignments: ASSIGNMENTS.length,
  scored: PROJECT_SCORES.size,
};
