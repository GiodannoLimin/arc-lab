import { test } from "node:test";
import assert from "node:assert/strict";
import {
  releaseSpin,
  surfaceSpinSpeed,
  canTargetForward,
  MAX_LAUNCH_SPEED,
} from "./spin";
import { at, BALL_RADIUS, type Shot } from "./physics";
import { simulateRebounds, sampleRebounds } from "./rebounds";
const base: Shot = {
  angle: 52,
  speed: 9,
  height: 2,
  distance: 6.75,
  bearing: 0,
  aim: 0,
};
test("spin axes preserve angular speed, legacy backspin, and tangential surface speed", () => {
  for (const bearing of [-90, 0, 63])
    for (const azimuth of [-180, 0, 75])
      for (const tilt of [-90, 0, 42, 90]) {
        const w = releaseSpin(12, bearing, azimuth, tilt);
        assert.ok(Math.abs(Math.hypot(w.x, w.y, w.z) - 24 * Math.PI) < 1e-12);
      }
  assert.deepEqual(releaseSpin(0, 0), { x: 0, y: 0, z: -0 });
  assert.equal(surfaceSpinSpeed(1), 2 * Math.PI * BALL_RADIUS);
  assert.ok(releaseSpin(2, 0, 180, 0).x < 0);
  assert.ok(Math.abs(releaseSpin(2, 0, 0, 90).y - 4 * Math.PI) < 1e-12);
  const legacy = simulateRebounds(base, "FIBA", { backspin: 3, maxTime: 0.25 });
  const vector = simulateRebounds(base, "FIBA", {
    angularVelocity: releaseSpin(3, base.bearing),
    maxTime: 0.25,
  });
  assert.deepEqual(sampleRebounds(legacy, 0.2), sampleRebounds(vector, 0.2));
  assert.throws(() => releaseSpin(NaN, 0));
  assert.throws(() =>
    simulateRebounds(base, "FIBA", { angularVelocity: { x: NaN, y: 0, z: 0 } }),
  );
});
test("0–360 degree launches and 0–40 m/s remain finite and ballistic before contact", () => {
  assert.equal(MAX_LAUNCH_SPEED, 40);
  for (const angle of [0, 30, 90, 120, 180, 225, 270, 300, 360])
    for (const speed of [0, 10, 40]) {
      const shot = { ...base, angle, speed };
      const sim = simulateRebounds(shot, "FIBA", {
        angularVelocity: releaseSpin(20, 0, 33, 48),
        maxTime: 1,
      });
      const p = sampleRebounds(sim, 0.01).p,
        exact = at(shot, 0.01);
      assert.ok(
        Math.hypot(p.x - exact.x, p.y - exact.y, p.z - exact.z) < 1e-10,
      );
      for (const seg of sim.segments) {
        assert.ok(Object.values(seg.start.p).every(Number.isFinite));
        assert.ok(seg.start.p.y >= BALL_RADIUS - 1e-6);
        assert.ok(Math.abs(Math.hypot(...seg.start.q) - 1) < 1e-12);
      }
    }
  assert.equal(canTargetForward(90), false);
  assert.equal(canTargetForward(180), false);
  assert.equal(canTargetForward(270), false);
  assert.equal(canTargetForward(360), true);
});
test("angular velocity rotates the sphere without adding translational speed in free flight", () => {
  const a = simulateRebounds({ ...base, speed: 0 }, "FIBA", {
    angularVelocity: { x: 0, y: 2 * Math.PI, z: 0 },
    maxTime: 0.25,
  });
  const b = simulateRebounds({ ...base, speed: 0 }, "FIBA", { maxTime: 0.25 });
  const state = sampleRebounds(a, 0.25);
  assert.deepEqual(state.p, sampleRebounds(b, 0.25).p);
  assert.deepEqual(state.v, sampleRebounds(b, 0.25).v);
  assert.ok(Math.abs(state.q[1] - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(state.q[3] - Math.SQRT1_2) < 1e-12);
});
