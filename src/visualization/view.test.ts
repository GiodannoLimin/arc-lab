import { test } from "node:test";
import assert from "node:assert/strict";
import { fitCamera, PlaybackClock } from "./view";
import { at, requiredSpeed, type Vec } from "../science/physics";
import { simulateRebounds, sampleRebounds } from "../science/rebounds";
const shot = {
  angle: 52,
  speed: requiredSpeed(6.75, 2, 52),
  height: 2,
  distance: 6.75,
  bearing: 0,
  aim: 0,
};
test("clock pauses, resumes, replays, and rebases speed without jumps", () => {
  const c = new PlaybackClock();
  c.reset(0);
  c.setRunning(true, 0);
  assert.equal(c.time(1000), 1);
  c.setRunning(false, 1000);
  assert.equal(c.time(9000), 1);
  c.setRunning(true, 9000);
  c.setRate(0.25, 10000);
  assert.equal(c.time(10000), 2);
  assert.equal(c.time(14000), 3);
  c.reset(14000);
  assert.equal(c.time(18000), 1);
});
test("different playback rates sample identical physical states at the same simulation time", () => {
  const sim = simulateRebounds(shot, "FIBA");
  for (const rate of [0.1, 0.25, 0.5, 1, 2]) {
    const c = new PlaybackClock();
    c.reset(0);
    c.setRate(rate, 0);
    c.setRunning(true, 0);
    const state = sampleRebounds(sim, c.time(1000 / rate));
    assert.deepEqual(state, sampleRebounds(sim, 1));
  }
});
test("camera fits source points at desktop and portrait aspect ratios without changing data", () => {
  const points: Vec[] = [
    { x: -1, y: 3, z: -0.4 },
    { x: 1, y: 4.1, z: -0.4 },
    ...Array.from({ length: 40 }, (_, i) => at(shot, (1.3 * i) / 39)),
  ];
  const saved = JSON.stringify(points);
  for (const aspect of [16 / 9, 9 / 16, 0.48, 1, 2.5])
    for (const direction of [
      { x: 1, y: 0.1, z: 0.3 },
      { x: 0.001, y: 1, z: 0.001 },
      { x: 1, y: 0.3, z: 1 },
    ]) {
      const spec = fitCamera(points, direction, aspect);
      const len = Math.hypot(direction.x, direction.y, direction.z),
        n = {
          x: direction.x / len,
          y: direction.y / len,
          z: direction.z / len,
        };
      const rightLen = Math.hypot(n.z, n.x),
        right = { x: n.z / rightLen, y: 0, z: -n.x / rightLen };
      const up = {
        x: n.y * right.z,
        y: n.z * right.x - n.x * right.z,
        z: -n.y * right.x,
      };
      const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
      for (const p of points) {
        const q = {
            x: p.x - spec.position.x,
            y: p.y - spec.position.y,
            z: p.z - spec.position.z,
          },
          depth = -dot(q, n);
        assert.ok(depth > 0);
        assert.ok(
          Math.abs(dot(q, right)) <
            depth * Math.tan((spec.fov * Math.PI) / 360) * aspect,
        );
        assert.ok(
          Math.abs(dot(q, up)) < depth * Math.tan((spec.fov * Math.PI) / 360),
        );
      }
    }
  assert.equal(JSON.stringify(points), saved);
});
test("two comparison views read the same clock without advancing it", () => {
  const c = new PlaybackClock();
  c.setRunning(true, 100);
  assert.equal(c.time(1100), 1);
  assert.equal(c.time(1100), 1);
  assert.throws(() => c.setRate(0, 1200));
});
