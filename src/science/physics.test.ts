import { test } from "node:test";
import assert from "node:assert/strict";
import {
  at,
  BALL_RADIUS,
  cleanShot,
  COURTS,
  crossing,
  H,
  integrate,
  minimumSpeed,
  requiredSpeed,
  WIRE,
  type Shot,
} from "./physics";
const shot: Shot = {
  angle: 52,
  speed: requiredSpeed(6.75, 2, 52),
  height: 2,
  distance: 6.75,
  bearing: 0,
  aim: 0,
};
test("analytical trajectory reaches descending hoop center", () => {
  const p = at(shot, crossing(shot)!);
  assert.ok(Math.abs(p.y - H) < 1e-10);
  assert.ok(Math.abs(p.z) < 1e-10);
});
test("minimum-speed formula beats dense independent angle sweep", () => {
  const best = minimumSpeed(6.75, 2);
  for (let a = 15; a < 89; a += 0.01) {
    const v = requiredSpeed(6.75, 2, a);
    if (Number.isFinite(v)) assert.ok(v >= best.speed - 1e-9);
  }
});
test("RK4 agrees with closed form across timestep, bearing and aim", () => {
  for (const dt of [0.1, 0.01, 0.001])
    for (const bearing of [-75, 0, 60]) {
      const s = { ...shot, bearing, aim: 2 };
      const a = at(s, 1.25),
        b = integrate(s, 1.25, dt);
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-9);
    }
});
test("finite sphere: centered descending shot can pass; shallow and off-axis shots fail", () => {
  assert.equal(cleanShot(shot, "FIBA"), true);
  const shallow = { ...shot, angle: 25, speed: requiredSpeed(6.75, 2, 25) };
  assert.ok(Math.abs(at(shallow, crossing(shallow)!).z) < 1e-8);
  assert.equal(cleanShot(shallow, "FIBA"), false);
  assert.equal(cleanShot({ ...shot, aim: 3 }, "FIBA"), false);
});
test("rotational symmetry and unreachable / invalid shots", () => {
  for (const bearing of [-80, -40, 0, 40, 80])
    assert.equal(cleanShot({ ...shot, bearing }, "NBA"), true);
  assert.equal(cleanShot({ ...shot, speed: 1 }, "FIBA"), false);
  assert.equal(cleanShot({ ...shot, speed: NaN }, "FIBA"), false);
});
test("all certified passes also clear an independent dense sphere/ring distance sweep", () => {
  let successes = 0;
  for (let angle = 30; angle <= 75; angle += 3)
    for (const offset of [-0.08, 0, 0.08]) {
      const s = {
        ...shot,
        angle,
        speed: requiredSpeed(6.75, 2, angle) + offset,
      };
      if (!cleanShot(s, "FIBA")) continue;
      successes++;
      const end = crossing(s, H - BALL_RADIUS - WIRE)!;
      for (let i = 0; i <= 2000; i++) {
        const p = at(s, (end * i) / 2000);
        const d = Math.hypot(
          Math.hypot(p.x, p.z) - (COURTS.FIBA.inner + WIRE),
          p.y - H,
        );
        assert.ok(d > BALL_RADIUS + WIRE);
      }
    }
  assert.ok(successes > 5);
});
test("NBA uses the 10 foot upper rim height and center-plane target consistently", () => {
  const target = COURTS.NBA.height - WIRE;
  const s = {
    ...shot,
    distance: 7.239,
    speed: requiredSpeed(7.239, 2, 52, target),
  };
  const p = at(s, crossing(s, target)!);
  assert.ok(Math.abs(p.z) < 1e-10);
  assert.equal(cleanShot(s, "NBA"), true);
});
