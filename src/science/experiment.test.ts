import { test } from "node:test";
import assert from "node:assert/strict";
import { experiment, estimate, normals, type Config } from "./statistics";
import { cleanShot, requiredSpeed } from "./physics";
const config: Config = {
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
  errors: { angle: 1.5, speed: 0.12, aim: 0.6, correlation: 0 },
};
test("end-to-end search is reproducible and displayed probabilities use the independent stream", () => {
  const a = experiment(config),
    b = experiment(config);
  assert.deepEqual(a.best, b.best);
  assert.deepEqual(a.baseline, b.baseline);
  assert.deepEqual(a.profile, b.profile);
  assert.deepEqual(a.previews, b.previews);
  assert.deepEqual(a.sensitivity, b.sensitivity);
  const independent = normals(config.samples, config.seed ^ 0x9e3779b9);
  assert.deepEqual(
    a.best,
    estimate(
      {
        ...config.shot,
        angle: a.best.angle,
        speed: a.best.speed,
        aim: a.best.aim,
      },
      config,
      independent,
    ),
  );
  assert.equal(a.shots, 2050000);
  assert.equal(a.profile.length, 11);
  assert.equal(
    a.previews.filter((s) => cleanShot(s, config.league)).length,
    12,
  );
  assert.equal(
    a.previews.filter((s) => !cleanShot(s, config.league)).length,
    12,
  );
});
test("zero uncertainty can retain the minimum-speed solution without assuming a difference", () => {
  const result = experiment({
    ...config,
    errors: { angle: 0, speed: 0, aim: 0, correlation: 0 },
  });
  assert.equal(result.best.angle, result.baseline.angle);
  assert.equal(result.best.speed, result.baseline.speed);
  assert.equal(result.best.p, 1);
  assert.equal(result.difference.value, 0);
});
