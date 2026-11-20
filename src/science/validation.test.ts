import { test } from "node:test";
import assert from "node:assert/strict";
import {
  G,
  COURTS,
  BALL_RADIUS,
  WIRE,
  H,
  at,
  firstContact,
  rimClearance,
  boardClearance,
  playbackTime,
  requiredSpeed,
  flightTime,
  cleanShot,
  integrate,
  type Shot,
} from "./physics";
import { validateNumerically } from "./numerics";
const base: Shot = {
  angle: 52,
  speed: requiredSpeed(6.75, 2, 52),
  height: 2,
  distance: 6.75,
  bearing: 0,
  aim: 0,
};
test("gravity is exactly the requested 9.81 m/s²", () => assert.equal(G, 9.81));
test("48 optimization cases and 720 numerical target checks pass", () => {
  const r = validateNumerically();
  assert.equal(r.cases, 48);
  for (const row of r.rows) {
    assert.ok(row.angleAbsoluteError < 1e-5);
    assert.ok(row.speedRelativeError < 1e-12);
    assert.ok(row.maxTargetError < 1e-9);
    assert.ok(row.maxPositionError < 1e-9);
  }
});
test("continuous first contact stops a rim hit before sphere penetration", () => {
  const s = { ...base, angle: 25, speed: requiredSpeed(6.75, 2, 25) };
  const hit = firstContact(s, "FIBA");
  assert.equal(hit.kind, "rim");
  assert.ok(hit.time < flightTime(s));
  assert.ok(rimClearance(at(s, hit.time), "FIBA") >= -1e-10);
  assert.ok(rimClearance(at(s, hit.time + 1e-4), "FIBA") < 0);
  assert.equal(cleanShot(s, "FIBA"), false);
});
test("continuous first contact stops a backboard hit before penetration", () => {
  const s = { ...base, angle: 30, speed: 12 };
  const hit = firstContact(s, "FIBA");
  assert.equal(hit.kind, "backboard");
  assert.ok(boardClearance(at(s, hit.time), "FIBA") >= -1e-10);
  assert.ok(boardClearance(at(s, hit.time + 1e-4), "FIBA") < 0);
  assert.equal(cleanShot(s, "FIBA"), false);
});
test("clean descending sphere passes remain successful and land on the floor", () => {
  assert.equal(cleanShot(base, "FIBA"), true);
  const hit = firstContact(base, "FIBA");
  assert.equal(hit.kind, "floor");
  assert.ok(Math.abs(at(base, hit.time).y - 0.12) < 1e-12);
});
test("playback and collision endpoints agree at 10, 30, 60 and 144 fps and across a stalled frame", () => {
  for (const slow of [false, true])
    for (const fps of [10, 30, 60, 144]) {
      let t = 0;
      for (let i = 0; i < fps; i++) t = playbackTime(t, 1 / fps, slow);
      assert.ok(Math.abs(t - (slow ? 0.25 : 1)) < 1e-12);
      assert.ok(Math.abs(at(base, t).y - at(base, slow ? 0.25 : 1).y) < 1e-10);
    }
  assert.equal(playbackTime(0, 1, false), 1);
  const miss = { ...base, angle: 25, speed: requiredSpeed(6.75, 2, 25) },
    end = firstContact(miss, "FIBA").time;
  for (const fps of [10, 30, 144]) {
    let t = 0;
    while (t < end) t = playbackTime(t, 1 / fps, false);
    assert.equal(Math.min(t, end), end);
  }
});
test("nonfinite shots are rejected and invalid integration steps cannot loop forever", () => {
  for (const key of Object.keys(base)) {
    assert.equal(cleanShot({ ...base, [key]: NaN }, "FIBA"), false);
  }
  assert.throws(() => integrate(base, 1, 0));
  assert.throws(() => integrate(base, -1));
});

test("regulation presets and finite sphere dimensions use meters consistently", () => {
  assert.equal(COURTS.FIBA.length, 28);
  assert.equal(COURTS.FIBA.width, 15);
  assert.equal(COURTS.FIBA.height, 3.05);
  assert.equal(COURTS.FIBA.inner * 2, 0.45);
  assert.ok(Math.abs(COURTS.NBA.height - 10 * 0.3048) < 1e-14);
  assert.ok(Math.abs(COURTS.NBA.inner * 2 - 18 * 0.0254) < 1e-14);
  assert.equal(WIRE * 2, 0.018);
  assert.ok(
    2 * Math.PI * BALL_RADIUS >= 0.75 && 2 * Math.PI * BALL_RADIUS <= 0.77,
  );
});
