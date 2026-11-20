import { test } from "node:test";
import assert from "node:assert/strict";
import {
  at,
  BALL_RADIUS as R,
  COURTS,
  G,
  requiredSpeed,
  cleanShot,
  type Shot,
} from "./physics";
import {
  DEFAULT_REBOUNDS as O,
  impact,
  kinetic,
  freeFlight,
  contactGeometry,
  simulateRebounds,
  sampleRebounds,
  BasketTracker,
  type State,
} from "./rebounds";
const state: State = {
  time: 0,
  p: { x: 0, y: 2, z: 0 },
  v: { x: 2, y: -3, z: 1 },
  w: { x: 1, y: 2, z: 3 },
  q: [0, 0, 0, 1],
};
const base: Shot = {
  angle: 52,
  speed: requiredSpeed(6.75, 2, 52),
  height: 2,
  distance: 6.75,
  bearing: 0,
  aim: 0,
};
test("elastic frictionless impact conserves kinetic energy and reverses only normal velocity", () => {
  const o = { ...O, bounceThreshold: 0 };
  const s = impact(
    state,
    { x: 0, y: 1, z: 0 },
    { restitution: 1, friction: 0 },
    o,
  );
  assert.ok(Math.abs(kinetic(s, o) - kinetic(state, o)) < 1e-12);
  assert.equal(s.v.y, 3);
  assert.equal(s.v.x, 2);
  assert.deepEqual(s.w, state.w);
});
test("restitution dissipates expected normal energy; friction dissipates and exchanges angular momentum", () => {
  const o = { ...O, bounceThreshold: 0 };
  const s = impact(
    state,
    { x: 0, y: 1, z: 0 },
    { restitution: 0.6, friction: 0 },
    o,
  );
  assert.ok(
    Math.abs(
      kinetic(state, o) - kinetic(s, o) - 0.5 * o.mass * 9 * (1 - 0.36),
    ) < 1e-12,
  );
  const r = impact(
    state,
    { x: 0, y: 1, z: 0 },
    { restitution: 0.6, friction: 0.4 },
    o,
  );
  assert.ok(kinetic(r, o) <= kinetic(s, o));
  assert.notEqual(r.w.x, state.w.x);
  const I = o.inertiaFactor * o.mass * R * R; // angular momentum about instantaneous floor contact
  assert.ok(
    Math.abs(I * (r.w.x - state.w.x) + R * o.mass * (r.v.z - state.v.z)) <
      1e-12,
  );
  assert.ok(
    Math.abs(I * (r.w.z - state.w.z) - R * o.mass * (r.v.x - state.v.x)) <
      1e-12,
  );
});
test("free flight agrees with analytics, conserves mechanical energy and quaternion norm", () => {
  const s = { ...state, v: { x: 1, y: 7, z: -3 } };
  const r = freeFlight(s, 1.2);
  const energy = (s: State) => kinetic(s) + O.mass * G * s.p.y;
  assert.ok(Math.abs(energy(s) - energy(r)) < 1e-12);
  assert.ok(Math.abs(Math.hypot(...r.q) - 1) < 1e-12);
  const sim = simulateRebounds(base, "FIBA", { maxTime: 0.5 });
  const exact = at(base, 0.5),
    v = sampleRebounds(sim, 0.5).p;
  assert.ok(Math.hypot(v.x - exact.x, v.y - exact.y, v.z - exact.z) < 1e-10);
});
test("sphere contacts have correct analytic distances and normals", () => {
  assert.equal(contactGeometry({ x: 0, y: R, z: 0 }, "FIBA", "floor").gap, 0);
  const b = contactGeometry(
    { x: 0, y: 3.4, z: -COURTS.FIBA.boardOffset + R },
    "FIBA",
    "backboard",
  );
  assert.ok(Math.abs(b.gap) < 1e-14);
  assert.equal(b.n.z, 1);
  const ring = contactGeometry(
    {
      x: COURTS.FIBA.inner + 0.009,
      y: COURTS.FIBA.height - 0.009 + R + 0.009,
      z: 0,
    },
    "FIBA",
    "rim",
  );
  assert.ok(Math.abs(ring.gap) < 1e-14);
  assert.ok(ring.n.y > 0.999999);
});
test("CCD catches a 100 m/s board impact even at 30 Hz and prevents penetration", () => {
  const r = simulateRebounds(
    { ...base, angle: 1, speed: 100, height: 3.4 },
    "FIBA",
    { step: 1 / 30, maxTime: 0.25 },
  );
  assert.ok(r.contacts.some((c) => c.surface === "backboard"));
  for (const segment of r.segments)
    for (const f of [0, 0.5, 1]) {
      const p = freeFlight(
        segment.start,
        (segment.end - segment.start.time) * f,
        segment.acceleration,
      ).p;
      for (const surface of ["floor", "backboard", "rim"] as const)
        assert.ok(contactGeometry(p, "FIBA", surface).gap > -2e-7);
    }
});
test("multiple bounces dissipate motion and settle only on the floor", () => {
  const r = simulateRebounds(base, "FIBA");
  assert.ok(r.settled);
  assert.equal(r.limited, false);
  assert.ok(r.contacts.filter((c) => c.surface === "floor").length > 3);
  assert.ok(Math.abs(r.final.p.y - R) < 3e-6);
  assert.equal(kinetic(r.final), 0);
  const floor = r.contacts.find((c) => c.surface === "floor")!;
  const after = sampleRebounds(r, floor.time + 1e-4);
  assert.ok(after.v.y > 0);
});
test("end-to-end scoring distinguishes swish, rim assistance, board assistance, and misses", () => {
  const cases: [Shot, string][] = [
    [base, "Clean swish"],
    [{ ...base, angle: 35, speed: 9.5 }, "Rim-assisted"],
    [{ ...base, angle: 35, speed: 9.6 }, "Backboard-assisted"],
    [{ ...base, angle: 30, speed: 12 }, "Miss"],
  ];
  for (const [s, outcome] of cases) {
    const r = simulateRebounds(s, "FIBA");
    assert.equal(r.outcome, outcome);
    assert.equal(r.limited, false);
    if (outcome.includes("assisted")) assert.equal(cleanShot(s, "FIBA"), false);
  }
});
test("scoring requires descending full-sphere exit; rejects upward, off-axis and floor-first shots", () => {
  const h = COURTS.FIBA.height - 0.009;
  const drop: State = {
    ...state,
    p: { x: 0, y: h + 0.3, z: 0 },
    v: { x: 0, y: -2, z: 0 },
  };
  for (const kind of ["clean", "rim", "backboard"] as const) {
    const t = new BasketTracker("FIBA");
    if (kind !== "clean") t.contact(kind);
    t.advance(drop, 0.12, { x: 0, y: -G, z: 0 });
    assert.equal(t.scored, false);
    const next = freeFlight(drop, 0.12);
    t.advance(next, 0.12, { x: 0, y: -G, z: 0 });
    assert.equal(t.scored, true);
  }
  for (const s of [
    { ...drop, p: { x: 0.2, y: h + 0.3, z: 0 } },
    { ...drop, p: { x: 0, y: h - 0.3, z: 0 }, v: { x: 0, y: 3, z: 0 } },
  ]) {
    const t = new BasketTracker("FIBA");
    t.advance(s, 0.25, { x: 0, y: 0, z: 0 });
    assert.equal(t.scored, false);
  }
  const t = new BasketTracker("FIBA");
  t.contact("floor");
  t.advance(drop, 1, { x: 0, y: -G, z: 0 });
  assert.equal(t.scored, false);
});
test("step refinement and frame-independent sampling agree through a rebound", () => {
  const s = { ...base, angle: 30, speed: 12 };
  const a = simulateRebounds(s, "FIBA", { step: 1 / 120, maxTime: 2 }),
    b = simulateRebounds(s, "FIBA", { step: 1 / 480, maxTime: 2 });
  assert.ok(Math.abs(a.contacts[0].time - b.contacts[0].time) < 1e-6);
  const pa = sampleRebounds(a, 1).p,
    pb = sampleRebounds(b, 1).p;
  assert.ok(Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z) < 1e-4);
  for (const fps of [10, 30, 60, 144]) {
    let t = 0;
    for (let i = 0; i < fps; i++) t += 1 / fps;
    const p = sampleRebounds(a, t).p;
    assert.ok(Math.hypot(p.x - pa.x, p.y - pa.y, p.z - pa.z) < 1e-10);
  }
});
test("unresolved time limits are disclosed and deterministic runs match", () => {
  const a = simulateRebounds(base, "FIBA", { maxTime: 0.1 }),
    b = simulateRebounds(base, "FIBA", { maxTime: 0.1 });
  assert.equal(a.outcome, "Unresolved");
  assert.deepEqual(a, b);
  assert.throws(() => simulateRebounds(base, "FIBA", { step: 0 }));
});

test("drop rebound height follows the restitution-squared law", () => {
  const drop = { ...base, angle: 0, speed: 0 };
  const r = simulateRebounds(drop, "FIBA", { maxTime: 1.3 });
  const t = Math.sqrt((2 * (drop.height - R)) / G),
    peak = t + O.materials.floor.restitution * t;
  const p = sampleRebounds(r, peak).p;
  const expected = R + O.materials.floor.restitution ** 2 * (drop.height - R);
  assert.ok(Math.abs(p.y - expected) < 4e-6);
});
test("stressed 3D paths stay finite, outside solids, and normalize spin orientation", () => {
  for (const bearing of [-65, 0, 65])
    for (const spin of [0, 5]) {
      const r = simulateRebounds(
        { ...base, bearing, aim: 1.3, angle: 45, speed: 10 },
        "NBA",
        { backspin: spin, maxTime: 4 },
      );
      for (const segment of r.segments)
        for (const f of [0, 0.5, 1]) {
          const s = freeFlight(
            segment.start,
            (segment.end - segment.start.time) * f,
            segment.acceleration,
          );
          assert.ok(Object.values(s.p).every(Number.isFinite));
          assert.ok(Math.abs(Math.hypot(...s.q) - 1) < 1e-12);
          for (const surface of ["floor", "backboard", "rim"] as const)
            assert.ok(contactGeometry(s.p, "NBA", surface).gap > -3e-7);
        }
    }
});
test("invalid energy and time-step parameters fail before simulation", () => {
  for (const settings of [
    { mass: NaN },
    { inertiaFactor: 0 },
    { step: 1e-12 },
    { rollingDrag: -1 },
    { spinDrag: Infinity },
  ])
    assert.throws(() => simulateRebounds(base, "FIBA", settings));
});

test("backspin changes the physical rebound without changing the pre-contact ballistic path", () => {
  const shot = { ...base, angle: 30, speed: 12 };
  const a = simulateRebounds(shot, "FIBA", { maxTime: 2, backspin: 0 }),
    b = simulateRebounds(shot, "FIBA", { maxTime: 2, backspin: 3 });
  const preA = sampleRebounds(a, 0.4).p,
    preB = sampleRebounds(b, 0.4).p;
  assert.deepEqual(preA, preB);
  const postA = sampleRebounds(a, 1).p,
    postB = sampleRebounds(b, 1).p;
  assert.ok(
    Math.hypot(postA.x - postB.x, postA.y - postB.y, postA.z - postB.z) > 0.01,
  );
});
