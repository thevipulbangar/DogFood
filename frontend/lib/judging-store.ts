"use client";

import { useSyncExternalStore } from "react";
import { ASSIGNMENTS, type Assignment } from "./data";

// Judge-local working copy of assignments, persisted in localStorage so drafts
// survive reloads. In production each save is a PUT to /api/v1/scores.

type Override = Partial<Pick<Assignment, "scores" | "notes" | "confidence" | "status" | "submittedAt">> & { evidence?: string; savedAt?: number };
type State = Record<string, Override>;

const listeners = new Set<() => void>();
const cache = new Map<string, State>();
const EMPTY: State = {};
const key = (judgeId: string) => `dogfood.judge.${judgeId}`;

function read(judgeId: string): State {
  if (typeof window === "undefined") return EMPTY;
  if (!cache.has(judgeId)) {
    let s: State = {};
    try { s = JSON.parse(localStorage.getItem(key(judgeId)) ?? "{}"); } catch {}
    cache.set(judgeId, s);
  }
  return cache.get(judgeId)!;
}

export function saveAssignment(judgeId: string, projectId: number, patch: Override) {
  const s = { ...read(judgeId), [projectId]: { ...read(judgeId)[projectId], ...patch, savedAt: Date.now() } };
  cache.set(judgeId, s);
  try { localStorage.setItem(key(judgeId), JSON.stringify(s)); } catch {}
  listeners.forEach((l) => l());
}

export type WorkingAssignment = Assignment & { evidence: string; savedAt?: number };

export function useJudgeAssignments(judgeId: string): WorkingAssignment[] {
  const state = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => read(judgeId),
    () => EMPTY,
  );
  return ASSIGNMENTS.filter((a) => a.judgeId === judgeId).map((a) => ({ ...a, evidence: "", ...state[a.projectId] }));
}
