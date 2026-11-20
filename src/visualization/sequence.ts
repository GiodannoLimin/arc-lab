/** Replays an ordered prefix of the existing held-out Monte Carlo stream.
 * No outcome selection, new distribution, or rebound-inclusive rescoring. */
import {
  BALL_RADIUS,
  COURTS,
  WIRE,
  cleanShot,
  crossing,
  firstContact,
  type Shot,
} from "../science/physics";
import { normals, perturb, type Result } from "../science/statistics";
import {
  simulateRebounds,
  type ReboundResult,
  type Options,
} from "../science/rebounds";

export type SequenceStrategy = "best" | "baseline";
export type SequenceShot = {
  shot: Shot;
  start: number;
  end: number;
  decision: number;
  success: boolean;
  contact: "rim" | "backboard" | "floor";
  /** Optional physical visualization; success/decision above remain clean-shot baseline. */
  physical?: ReboundResult;
};
export type ShotSequence = {
  shots: SequenceShot[];
  duration: number;
  intended: Shot;
  league: Result["config"]["league"];
  rebounds: boolean;
};

export function buildSequence(
  result: Result,
  strategy: SequenceStrategy,
  count: number,
  gap = 0.35,
  playback: { rebounds?: boolean; settings?: Partial<Options> } = {},
): ShotSequence {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > Math.min(100, result.config.samples)
  )
    throw new Error(
      "Replay length must be 1–100 shots within the saved sample.",
    );
  if (!Number.isFinite(gap) || gap < 0) throw new Error("Invalid replay gap.");
  const candidate = result[strategy];
  const intended = {
    ...result.config.shot,
    angle: candidate.angle,
    speed: candidate.speed,
    aim: candidate.aim,
  };
  // normals() is prefix-stable: this regenerates the exact first N validation trials.
  const noise = normals(count, result.config.seed ^ 0x9e3779b9);
  let start = 0;
  const shots: SequenceShot[] = [];
  for (let i = 0; i < count; i++) {
    const shot = perturb(intended, result.config.errors, noise, i);
    const contact = firstContact(shot, result.config.league);
    const success = cleanShot(shot, result.config.league);
    const lower = COURTS[result.config.league].height - 2 * WIRE - BALL_RADIUS;
    const physical = playback.rebounds
      ? simulateRebounds(shot, result.config.league, playback.settings)
      : undefined;
    // At most four moving balls; reuse a slot only after its previous shot ends.
    if (physical && i >= 4)
      start = Math.max(start, shots[i - 4].start + shots[i - 4].end + gap);
    const entry: SequenceShot = {
      shot,
      start,
      end: physical?.final.time ?? contact.time,
      success,
      contact: contact.kind,
      // A swish registers only after the entire sphere clears the rim region.
      decision: success
        ? (crossing(shot, lower) ?? contact.time)
        : contact.time,
      ...(physical ? { physical } : {}),
    };
    shots.push(entry);
    start += physical
      ? (physical.contacts.find((c) => c.surface === "floor")?.time ??
          physical.final.time) + gap
      : contact.time + gap;
  }
  return {
    shots,
    duration: Math.max(...shots.map((s) => s.start + s.end)),
    intended,
    league: result.config.league,
    rebounds: Boolean(playback.rebounds),
  };
}

/** Stateless timeline: independent of frame count, camera, or playback rate. */
export function sequenceFrame(sequence: ShotSequence, time: number) {
  const t = Math.max(0, time);
  let index = 0,
    swishes = 0,
    misses = 0,
    released = 0;
  for (let i = 0; i < sequence.shots.length; i++) {
    const s = sequence.shots[i];
    if (t >= s.start) {
      index = i;
      released++;
    }
    if (t >= s.start + s.decision) {
      if (s.success) swishes++;
      else misses++;
    }
  }
  const active = sequence.shots[index];
  const localTime = Math.max(0, Math.min(active.end, t - active.start));
  let clean = 0,
    rim = 0,
    board = 0,
    physicalMisses = 0,
    unresolved = 0;
  for (const s of sequence.shots) {
    if (!s.physical) continue;
    const when = s.start + (s.physical.scoreTime ?? s.end);
    if (t < when) continue;
    switch (s.physical.outcome) {
      case "Clean swish":
        clean++;
        break;
      case "Rim-assisted":
        rim++;
        break;
      case "Backboard-assisted":
        board++;
        break;
      case "Miss":
        physicalMisses++;
        break;
      case "Unresolved":
        unresolved++;
        break;
    }
  }
  const physicalBaskets = clean + rim + board;
  const physicalResolved = physicalBaskets + physicalMisses;
  return {
    index,
    localTime,
    released,
    swishes,
    misses,
    completed: swishes + misses,
    visible: t >= active.start && t < active.start + active.end,
    decided: t >= active.start + active.decision,
    physicalBaskets,
    physicalResolved,
    physicalMisses,
    clean,
    rim,
    board,
    unresolved,
    physicalDecided:
      Boolean(active.physical) &&
      t >= active.start + (active.physical?.scoreTime ?? active.end),
    done: t >= sequence.duration,
  };
}
export type SequenceFrame = ReturnType<typeof sequenceFrame>;
