// Run: node scripts/check-scoring.mts
import assert from "node:assert/strict";
import { weightedScore, normalize, projectAverages } from "../lib/scoring.ts";

const criteria = [ { id: "a", weight: 25 }, { id: "b", weight: 75 } ];
assert.equal(weightedScore({ a: 8, b: 4 }, criteria), 5);
assert.equal(weightedScore({ a: 8 }, criteria), 8, "unscored criteria are excluded");
assert.equal(weightedScore({}, criteria), 0);

// A harsh judge and a generous judge rank the same two projects identically.
const entries = [
  { judge: "harsh", project: 1, raw: 4 }, { judge: "harsh", project: 2, raw: 6 },
  { judge: "kind", project: 1, raw: 8 }, { judge: "kind", project: 2, raw: 10 },
];
const n = normalize(entries);
assert.equal(n.get("harsh:1"), n.get("kind:1"), "bias removed");
assert.ok(n.get("harsh:2")! > n.get("harsh:1")!, "order preserved");

// Single-score judges pass through unchanged.
assert.equal(normalize([{ judge: "solo", project: 9, raw: 7.3 }]).get("solo:9"), 7.3);

const avg = projectAverages(entries);
assert.equal(avg.get(1)!.count, 2);
assert.ok(Math.abs(avg.get(1)!.raw - 6) < 1e-9);
console.log("scoring: all checks passed");
