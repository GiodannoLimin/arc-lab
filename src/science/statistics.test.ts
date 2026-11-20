import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normals,
  perturb,
  random,
  wilson,
  estimate,
  type Config,
} from "./statistics";
import { requiredSpeed } from "./physics";
test("seeded streams are reproducible, distinct, and normal moments converge", () => {
  assert.deepEqual(normals(10, 42), normals(10, 42));
  assert.notDeepEqual(normals(10, 42), normals(10, 43));
  assert.notEqual(random(1)(), random(2)());
  const z = normals(100000, 42);
  let sum = 0,
    sq = 0;
  for (const x of z) {
    sum += x;
    sq += x * x;
  }
  assert.ok(Math.abs(sum / z.length) < 0.01);
  assert.ok(Math.abs(sq / z.length - 1) < 0.01);
});
test("Wilson boundary intervals remain nonzero and bounded", () => {
  const a = wilson(0, 10000),
    b = wilson(10000, 10000);
  assert.equal(a.lo, 0);
  assert.ok(a.hi > 0);
  assert.equal(b.hi, 1);
  assert.ok(b.lo < 1);
});
test("zero release errors preserve the deterministic shot in 10,000 trials", () => {
  const c: Config = {
    shot: {
      angle: 52,
      speed: requiredSpeed(6.75, 2, 52),
      height: 2,
      distance: 6.75,
      bearing: 0,
      aim: 0,
    },
    league: "FIBA",
    samples: 10000,
    seed: 42,
    errors: { angle: 0, speed: 0, aim: 0, correlation: 0 },
  };
  assert.equal(estimate(c.shot, c, normals(10000, 42)).hits, 10000);
  assert.deepEqual(perturb(c.shot, c.errors, normals(1, 1), 0), c.shot);
});
test("angle-speed correlation transform preserves requested covariance", () => {
  const z = normals(100000, 123);
  let xy = 0;
  for (let i = 0; i < 100000; i++)
    xy += z[i * 3] * (0.6 * z[i * 3] + 0.8 * z[i * 3 + 1]);
  assert.ok(Math.abs(xy / 100000 - 0.6) < 0.015);
});
