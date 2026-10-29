// Unit tests for src/discrete.js — no server or database needed:
//   node --test tests/discrete.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  factorial, choose, derangementsIE, derangementsRec, validPanels, workloadCap,
  roundCount, eliminationRounds, rotation, planAssignment, colourSlots, checkAssignment,
} from "../src/discrete.js";

test("counting: factorial and C(n,k)", () => {
  assert.equal(factorial(5), 120n);
  assert.equal(choose(10, 3), 120n);
  assert.equal(choose(4, 5), 0n);
  // Pascal's rule C(n,k) = C(n-1,k-1) + C(n-1,k)
  for (let n = 1; n < 15; n++) for (let k = 1; k < n; k++) assert.equal(choose(n, k), choose(n - 1, k - 1) + choose(n - 1, k));
});

test("derangements: inclusion–exclusion equals the recurrence", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(derangementsIE), [1n, 0n, 1n, 2n, 9n, 44n]);
  for (let n = 0; n <= 20; n++) assert.equal(derangementsIE(n), derangementsRec(n));
});

test("inclusion–exclusion: valid panels = C(n-c, k)", () => {
  for (let n = 1; n <= 10; n++) for (let c = 0; c <= n; c++) for (let k = 0; k <= n; k++) assert.equal(validPanels(n, c, k), choose(n - c, k));
});

test("recurrence: elimination rounds = ⌈log₂ n⌉", () => {
  for (let n = 1; n <= 100; n++) assert.equal(roundCount(n), Math.ceil(Math.log2(n)));
  assert.deepEqual(eliminationRounds([1, 2, 3, 4, 5]), [[1, 2, 3, 4, 5], [1, 2, 3], [1, 2], [1]]);
});

test("modular: rotation visits every judge exactly once", () => {
  for (let J = 1; J <= 7; J++) for (let r = 0; r < 3; r++) assert.deepEqual([...rotation(4, 3, r, J)].sort((a, b) => a - b), [...Array(J).keys()]);
});

test("graph: matching respects coverage, conflicts and workload cap", () => {
  const projects = [10, 11, 12, 13, 14, 15], judges = [1, 2, 3, 4], k = 2;
  const conflicts = new Set(["1:10", "2:11", "3:12"]); // judge 1 is on team of project 10, etc.
  const { pairs, cap } = planAssignment({ projects, judges, k, conflicts });
  assert.equal(cap, workloadCap(6, 2, 4)); // ⌈12/4⌉ = 3, achievable despite conflicts
  assert.deepEqual(checkAssignment({ pairs, projects, k, cap, conflicts }),
    { every_project_covered: true, no_conflicts: true, within_workload_cap: true, no_duplicates: true });
});

test("graph: re-running only fills gaps", () => {
  const projects = [1, 2, 3], judges = [7, 8, 9];
  const existing = [{ judge_id: 7, submission_id: 1 }];
  const { pairs } = planAssignment({ projects, judges, k: 2, existing });
  assert.equal(pairs.length, 5); // 6 needed, 1 already there
  assert.ok(!pairs.some((p) => p.judge_id === 7 && p.submission_id === 1));
});

test("graph: colouring never gives a judge two projects in one slot", () => {
  const { pairs } = planAssignment({ projects: [1, 2, 3, 4, 5, 6, 7], judges: [1, 2, 3, 4, 5], k: 3 });
  const slot = colourSlots(pairs);
  const seen = new Set();
  for (const { judge_id, submission_id } of pairs) {
    const key = `${judge_id}@${slot.get(submission_id)}`;
    assert.ok(!seen.has(key), `judge ${judge_id} double-booked`);
    seen.add(key);
  }
});

test("logic: a broken assignment fails the checks", () => {
  const r = checkAssignment({ pairs: [{ judge_id: 1, submission_id: 5 }, { judge_id: 1, submission_id: 5 }], projects: [5, 6], k: 1, cap: 1, conflicts: new Set(["1:5"]) });
  assert.deepEqual(r, { every_project_covered: false, no_conflicts: false, within_workload_cap: false, no_duplicates: false });
});
