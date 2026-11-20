import { test } from "node:test";
import assert from "node:assert/strict";
import { at, cleanShot, requiredSpeed } from "../science/physics";
import { experiment, normals, perturb } from "../science/statistics";
import { buildSequence, sequenceFrame } from "./sequence";
import { PlaybackClock } from "./view";
import { sampleRebounds } from "../science/rebounds";

const result = experiment({
  shot: {
    angle: 52,
    speed: requiredSpeed(6.75, 2, 52),
    height: 2,
    distance: 6.75,
    bearing: 0,
    aim: 0,
  },
  league: "FIBA",
  seed: 42,
  samples: 10000,
  errors: { angle: 1.5, speed: 0.12, aim: 0.6, correlation: 0 },
});

test("sequence reproduces the original ordered validation prefix for either strategy", () => {
  const saved = JSON.stringify(result);
  const z = normals(result.config.samples, result.config.seed ^ 0x9e3779b9);
  for (const strategy of ["best", "baseline"] as const) {
    const sequence = buildSequence(result, strategy, 100);
    const c = result[strategy];
    const intended = {
      ...result.config.shot,
      angle: c.angle,
      speed: c.speed,
      aim: c.aim,
    };
    sequence.shots.forEach((entry, i) => {
      const expected = perturb(intended, result.config.errors, z, i);
      assert.deepEqual(entry.shot, expected);
      assert.equal(entry.success, cleanShot(expected, result.config.league));
      assert.ok(entry.decision <= entry.end);
    });
    assert.deepEqual(
      buildSequence(result, strategy, 10).shots,
      sequence.shots.slice(0, 10),
    );
    assert.ok(sequence.shots.some((s) => s.success));
    assert.ok(sequence.shots.some((s) => !s.success));
  }
  assert.equal(JSON.stringify(result), saved);
});

test("consecutive timeline has no overlap, resolves only at the physical event, and completes exactly", () => {
  const sequence = buildSequence(result, "best", 25, 0.35);
  let swishes = 0,
    misses = 0;
  sequence.shots.forEach((s, i) => {
    const before = sequenceFrame(sequence, s.start + s.decision - 1e-6);
    assert.equal(before.index, i);
    assert.equal(before.completed, i);
    const decision = sequenceFrame(sequence, s.start + s.decision);
    if (s.success) swishes++;
    else misses++;
    assert.equal(decision.swishes, swishes);
    assert.equal(decision.misses, misses);
    if (i < sequence.shots.length - 1) {
      const next = sequence.shots[i + 1];
      assert.ok(next.start >= s.start + s.end);
      assert.equal(
        sequenceFrame(sequence, s.start + s.end + 0.1).visible,
        false,
      );
      assert.equal(sequenceFrame(sequence, next.start).index, i + 1);
    }
  });
  const final = sequenceFrame(sequence, sequence.duration);
  assert.equal(final.done, true);
  assert.equal(final.visible, false);
  assert.equal(final.completed, 25);
  assert.equal(final.released, 25);
  assert.equal(final.swishes, sequence.shots.filter((s) => s.success).length);
  assert.deepEqual(sequenceFrame(sequence, 0), sequenceFrame(sequence, -1));
});

test("sequence playback is frame-rate independent, pauses, changes speed, and replays without changing outcomes", () => {
  const sequence = buildSequence(result, "best", 10);
  for (const time of [0.5, 3, 12, sequence.duration]) {
    const expected = sequenceFrame(sequence, time);
    for (const rate of [0.1, 0.5, 1, 2]) {
      const clock = new PlaybackClock();
      clock.setRate(rate, 0);
      clock.setRunning(true, 0);
      const frame = sequenceFrame(sequence, clock.time((time * 1000) / rate));
      assert.deepEqual(frame, expected);
      assert.deepEqual(
        at(sequence.shots[frame.index].shot, frame.localTime),
        at(sequence.shots[expected.index].shot, expected.localTime),
      );
      clock.setRunning(false, (time * 1000) / rate);
      assert.deepEqual(
        sequenceFrame(sequence, clock.time((time * 1000) / rate + 3000)),
        expected,
      );
      clock.reset(100000);
      assert.deepEqual(
        sequenceFrame(sequence, clock.time(110000)),
        sequenceFrame(sequence, 0),
      );
    }
  }
  assert.throws(() => buildSequence(result, "best", 0));
  assert.throws(() => buildSequence(result, "best", 101));
  assert.throws(() => buildSequence(result, "best", 10, -1));
});
test("rebound replay preserves baseline trials and labels while continuing after contacts with at most four moving balls", () => {
  const baseline = buildSequence(result, "best", 10);
  const sequence = buildSequence(result, "best", 10, 0.35, { rebounds: true });
  sequence.shots.forEach((s, i) => {
    assert.deepEqual(s.shot, baseline.shots[i].shot);
    assert.equal(s.success, baseline.shots[i].success);
    assert.equal(s.decision, baseline.shots[i].decision);
    assert.ok(s.physical);
    const first = s.physical!.contacts[0];
    assert.ok(s.end > first.time);
    assert.ok(sampleRebounds(s.physical!, first.time + 0.02).time > first.time);
    if (i >= 4)
      assert.ok(
        s.start >= sequence.shots[i - 4].start + sequence.shots[i - 4].end,
      );
    const moving = sequence.shots.filter(
      (e) => e.start <= s.start && e.start + e.end > s.start,
    );
    assert.ok(moving.length <= 4);
  });
  const final = sequenceFrame(sequence, sequence.duration);
  assert.equal(final.physicalResolved + final.unresolved, 10);
  assert.equal(final.swishes, baseline.shots.filter((s) => s.success).length);
  assert.equal(final.physicalBaskets, final.clean + final.rim + final.board);
  assert.equal(final.done, true);
});
