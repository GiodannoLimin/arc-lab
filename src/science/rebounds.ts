/** One spherical rigid body vs static exact torus, box, and plane. SI units.
 * Unmeasured material parameters are assumptions, not fitted player/equipment data. */
import {
  BALL_RADIUS as R,
  COURTS,
  G,
  WIRE,
  initial,
  type League,
  type Shot,
  type Vec,
} from "./physics";
export type Surface = "rim" | "backboard" | "floor";
export type Outcome =
  "Clean swish" | "Rim-assisted" | "Backboard-assisted" | "Miss" | "Unresolved";
export type Quaternion = [number, number, number, number];
export type State = { time: number; p: Vec; v: Vec; w: Vec; q: Quaternion };
export type Material = { restitution: number; friction: number };
export type Options = {
  step: number;
  maxTime: number;
  mass: number;
  inertiaFactor: number;
  backspin: number;
  /** Optional world-space angular velocity in rad/s; overrides legacy backspin. */
  angularVelocity?: Vec;
  rollingDrag: number;
  spinDrag: number;
  bounceThreshold: number;
  materials: Record<Surface, Material>;
};
export const DEFAULT_REBOUNDS: Options = {
  step: 1 / 240,
  maxTime: 40,
  mass: 0.624,
  inertiaFactor: 2 / 3,
  backspin: 0,
  rollingDrag: 0.7,
  spinDrag: 0.7,
  bounceThreshold: 0.15,
  materials: {
    rim: { restitution: 0.65, friction: 0.35 },
    backboard: { restitution: 0.75, friction: 0.3 },
    floor: { restitution: 0.82, friction: 0.6 },
  },
};
const add = (a: Vec, b: Vec): Vec => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});
const mul = (a: Vec, k: number): Vec => ({
  x: a.x * k,
  y: a.y * k,
  z: a.z * k,
});
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec, b: Vec): Vec => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (v: Vec) => Math.hypot(v.x, v.y, v.z);
const zero: Vec = { x: 0, y: 0, z: 0 };
function unit(v: Vec): Vec {
  const n = norm(v);
  return n > 1e-14 ? mul(v, 1 / n) : { x: 0, y: 1, z: 0 };
}
export function contactGeometry(
  p: Vec,
  league: League,
  surface: Surface,
): { gap: number; n: Vec } {
  const c = COURTS[league];
  if (surface === "floor") return { gap: p.y - R, n: { x: 0, y: 1, z: 0 } };
  if (surface === "rim") {
    const rho = Math.hypot(p.x, p.z),
      radius = c.inner + WIRE;
    const nearest = {
      x: rho ? (radius * p.x) / rho : radius,
      y: c.height - WIRE,
      z: rho ? (radius * p.z) / rho : 0,
    };
    const delta = add(p, mul(nearest, -1));
    return { gap: norm(delta) - R - WIRE, n: unit(delta) };
  }
  const lo = {
      x: -c.boardWidth / 2,
      y: c.boardBottom,
      z: -c.boardOffset - 0.05,
    },
    hi = {
      x: c.boardWidth / 2,
      y: c.boardBottom + c.boardHeight,
      z: -c.boardOffset,
    };
  const closest = {
    x: Math.max(lo.x, Math.min(hi.x, p.x)),
    y: Math.max(lo.y, Math.min(hi.y, p.y)),
    z: Math.max(lo.z, Math.min(hi.z, p.z)),
  };
  const delta = add(p, mul(closest, -1));
  if (norm(delta) > 1e-14) return { gap: norm(delta) - R, n: unit(delta) };
  // Recovery for a caller supplying an initially embedded center.
  const faces = [
    { d: p.x - lo.x, n: { x: -1, y: 0, z: 0 } },
    { d: hi.x - p.x, n: { x: 1, y: 0, z: 0 } },
    { d: p.y - lo.y, n: { x: 0, y: -1, z: 0 } },
    { d: hi.y - p.y, n: { x: 0, y: 1, z: 0 } },
    { d: p.z - lo.z, n: { x: 0, y: 0, z: -1 } },
    { d: hi.z - p.z, n: { x: 0, y: 0, z: 1 } },
  ].sort((a, b) => a.d - b.d);
  return { gap: -faces[0].d - R, n: faces[0].n };
}
export function kinetic(s: State, o = DEFAULT_REBOUNDS) {
  return (
    0.5 * o.mass * dot(s.v, s.v) +
    0.5 * o.inertiaFactor * o.mass * R * R * dot(s.w, s.w)
  );
}
/** Impulse at the sphere surface. Static obstacle absorbs equal/opposite momentum.
 * Normal torque is zero. Tangential effective mass includes shell inertia. */
export function impact(
  s: State,
  n: Vec,
  m: Material,
  o = DEFAULT_REBOUNDS,
): State {
  const vn = dot(s.v, n);
  if (vn >= 0) return s;
  const restitution = -vn < o.bounceThreshold ? 0 : m.restitution;
  const jn = -(1 + restitution) * vn * o.mass;
  return friction(
    { ...s, v: add(s.v, mul(n, jn / o.mass)) },
    n,
    jn,
    m.friction,
    o,
  );
}
function friction(
  s: State,
  n: Vec,
  normalImpulse: number,
  mu: number,
  o: Options,
): State {
  const lever = mul(n, -R),
    velocity = add(s.v, cross(s.w, lever));
  const tangent = add(velocity, mul(n, -dot(velocity, n))),
    speed = norm(tangent);
  if (speed < 1e-14) return s;
  const inertia = o.inertiaFactor * o.mass * R * R;
  const jt = Math.min(
    speed / (1 / o.mass + (R * R) / inertia),
    mu * normalImpulse,
  );
  const j = mul(tangent, -jt / speed);
  return {
    ...s,
    v: add(s.v, mul(j, 1 / o.mass)),
    w: add(s.w, mul(cross(lever, j), 1 / inertia)),
  };
}
function rotate(q: Quaternion, w: Vec, t: number): Quaternion {
  const speed = norm(w);
  if (speed === 0) return q;
  const f = Math.sin((speed * t) / 2) / speed,
    x = w.x * f,
    y = w.y * f,
    z = w.z * f,
    c = Math.cos((speed * t) / 2);
  const next: Quaternion = [
    c * q[0] + x * q[3] + y * q[2] - z * q[1],
    c * q[1] - x * q[2] + y * q[3] + z * q[0],
    c * q[2] + x * q[1] - y * q[0] + z * q[3],
    c * q[3] - x * q[0] - y * q[1] - z * q[2],
  ];
  const length = Math.hypot(...next);
  return next.map((v) => v / length) as Quaternion;
}
export function freeFlight(
  s: State,
  t: number,
  a: Vec = { x: 0, y: -G, z: 0 },
): State {
  return {
    ...s,
    time: s.time + t,
    p: add(add(s.p, mul(s.v, t)), mul(a, (t * t) / 2)),
    v: add(s.v, mul(a, t)),
    q: rotate(s.q, s.w, t),
  };
}
export type Segment = { start: State; end: number; acceleration: Vec };
export type ReboundResult = {
  segments: Segment[];
  final: State;
  outcome: Outcome;
  scoreTime: number | null;
  contacts: { surface: Surface; time: number; position: Vec }[];
  settled: boolean;
  limited: boolean;
  options: Options;
  maxHeight: number;
};
/** Track top-to-bottom finite-sphere passage, not center-height alone. */
export class BasketTracker {
  armed = false;
  pending = false;
  scored = false;
  floor = false;
  rim = false;
  board = false;
  scoreTime: number | null = null;
  outcome: Outcome = "Miss";
  constructor(readonly league: League) {}
  contact(surface: Surface) {
    if (surface === "floor") this.floor = true;
    if (surface === "rim") this.rim = true;
    if (surface === "backboard") this.board = true;
  }
  advance(s: State, dt: number, a: Vec) {
    if (this.scored || this.floor) return;
    const h = COURTS[this.league].height - WIRE,
      exit = h - R - WIRE,
      upper = h + R + WIRE;
    const end = freeFlight(s, dt, a);
    const apex = a.y < 0 ? Math.max(0, Math.min(dt, -s.v.y / a.y)) : 0;
    if (Math.max(s.p.y, end.p.y, freeFlight(s, apex, a).p.y) >= upper)
      this.armed = true;
    const events: { t: number; level: number; down: boolean }[] = [];
    for (const level of [h, exit]) {
      if (Math.abs(a.y) < 1e-14) {
        if (s.v.y !== 0) {
          const t = (level - s.p.y) / s.v.y;
          if (t > 1e-12 && t <= dt + 1e-12)
            events.push({ t, level, down: s.v.y < 0 });
        }
      } else {
        const disc = s.v.y * s.v.y + 2 * a.y * (level - s.p.y);
        if (disc < 0) continue;
        for (const t of [
          (-s.v.y + Math.sqrt(disc)) / a.y,
          (-s.v.y - Math.sqrt(disc)) / a.y,
        ])
          if (t > 1e-12 && t <= dt + 1e-12)
            events.push({ t, level, down: s.v.y + a.y * t < 0 });
      }
    }
    for (const e of events.sort((a, b) => a.t - b.t)) {
      const p = freeFlight(s, e.t, a).p;
      if (e.level === h) {
        this.pending =
          e.down &&
          this.armed &&
          Math.hypot(p.x, p.z) <= COURTS[this.league].inner - R + 1e-7;
      } else if (e.down && this.pending) {
        this.scored = true;
        this.scoreTime = s.time + e.t;
        this.outcome = this.board
          ? "Backboard-assisted"
          : this.rim
            ? "Rim-assisted"
            : "Clean swish";
        return;
      }
    }
  }
}
/** Fixed outer steps; conservative advancement subdivides at time of impact.
 * Signed distance is 1-Lipschitz. speed+|a|*remaining bounds motion on each arc.
 * A step's unused time is always simulated after response. */
export function simulateRebounds(
  shot: Shot,
  league: League,
  settings: Partial<Options> = {},
): ReboundResult {
  const o: Options = { ...DEFAULT_REBOUNDS, ...settings };
  if (
    Object.values(shot).some((v) => !Number.isFinite(v)) ||
    shot.speed < 0 ||
    shot.height < R ||
    !Number.isFinite(o.step) ||
    o.step < 1 / 2000 ||
    o.step > 1 / 30 ||
    !Number.isFinite(o.maxTime) ||
    o.maxTime <= 0 ||
    o.maxTime > 60 ||
    [
      o.mass,
      o.inertiaFactor,
      o.backspin,
      o.rollingDrag,
      o.spinDrag,
      o.bounceThreshold,
    ].some((v) => !Number.isFinite(v)) ||
    o.mass <= 0 ||
    o.inertiaFactor <= 0 ||
    o.rollingDrag < 0 ||
    o.spinDrag < 0 ||
    o.bounceThreshold < 0
  )
    throw new Error("Invalid rigid-body configuration");
  for (const m of Object.values(o.materials))
    if (
      !Number.isFinite(m.restitution) ||
      m.restitution < 0 ||
      m.restitution > 1 ||
      !Number.isFinite(m.friction) ||
      m.friction < 0
    )
      throw new Error("Invalid material");
  if (
    o.angularVelocity &&
    ![o.angularVelocity.x, o.angularVelocity.y, o.angularVelocity.z].every(
      Number.isFinite,
    )
  )
    throw new Error("Invalid angular velocity");
  const iv = initial(shot),
    b = (shot.bearing * Math.PI) / 180;
  let s: State = {
    time: 0,
    ...iv,
    w: o.angularVelocity
      ? { ...o.angularVelocity }
      : {
          x: o.backspin * 2 * Math.PI * Math.cos(b),
          y: 0,
          z: -o.backspin * 2 * Math.PI * Math.sin(b),
        },
    q: [0, 0, 0, 1],
  };
  const segments: Segment[] = [],
    contacts: ReboundResult["contacts"] = [],
    tracker = new BasketTracker(league);
  let settled = false,
    limited = false,
    maxHeight = s.p.y;
  const advance = (dt: number, a: Vec) => {
    if (dt <= 0) return;
    segments.push({ start: s, end: s.time + dt, acceleration: a });
    tracker.advance(s, dt, a);
    maxHeight = Math.max(maxHeight, s.p.y, freeFlight(s, dt, a).p.y);
    s = freeFlight(s, dt, a);
  };
  for (let tick = 0; tick < Math.ceil(o.maxTime / o.step); tick++) {
    const end = Math.min(o.maxTime, (tick + 1) * o.step);
    let grounded = s.p.y <= R + 3e-6 && Math.abs(s.v.y) < 0.02;
    if (grounded) {
      s = { ...s, p: { ...s.p, y: R + 1e-6 }, v: { ...s.v, y: 0 } };
      s = friction(
        s,
        { x: 0, y: 1, z: 0 },
        o.mass * G * o.step,
        o.materials.floor.friction,
        o,
      );
      const decay = Math.exp(-o.rollingDrag * o.step);
      s = {
        ...s,
        v: mul(s.v, decay),
        w: {
          x: s.w.x * decay,
          y: s.w.y * Math.exp(-o.spinDrag * o.step),
          z: s.w.z * decay,
        },
      };
      if (norm(s.v) < 0.025 && norm(s.w) < 0.25) {
        s = { ...s, v: zero, w: zero };
        settled = true;
        break;
      }
    }
    let acceleration = grounded ? zero : { x: 0, y: -G, z: 0 };
    let iterations = 0;
    while (s.time < end - 1e-12) {
      if (++iterations > 512) {
        limited = true;
        break;
      }
      const remaining = end - s.time;
      const surfaces: Surface[] = grounded
        ? ["rim", "backboard"]
        : ["rim", "backboard", "floor"];
      const nearest = surfaces
        .map((surface) => ({
          surface,
          ...contactGeometry(s.p, league, surface),
        }))
        .sort((a, b) => a.gap - b.gap)[0];
      if (nearest.gap <= 1e-7) {
        const vn = dot(s.v, nearest.n);
        // Geometric contact (including a grazing touch) affects scoring even
        // when no approaching normal impulse is required.
        contacts.push({
          surface: nearest.surface,
          time: s.time,
          position: s.p,
        });
        tracker.contact(nearest.surface);
        if (vn < 0) {
          s = impact(s, nearest.n, o.materials[nearest.surface], o);
          if (nearest.surface === "floor" && Math.abs(s.v.y) < 0.02) {
            grounded = true;
            acceleration = zero;
            s = { ...s, p: { ...s.p, y: R + 1e-6 }, v: { ...s.v, y: 0 } };
          }
        }
        s = {
          ...s,
          p: add(s.p, mul(nearest.n, Math.max(0, 2e-6 - nearest.gap))),
        };
        continue;
      }
      const speedBound = norm(s.v) + norm(acceleration) * remaining;
      let dt = remaining;
      for (const surface of surfaces) {
        if (surface === "floor") {
          const disc = s.v.y * s.v.y + 2 * G * (s.p.y - R);
          const t = (s.v.y + Math.sqrt(Math.max(0, disc))) / G;
          if (t > 0) dt = Math.min(dt, t);
        } else if (speedBound > 0)
          dt = Math.min(
            dt,
            (0.9 * contactGeometry(s.p, league, surface).gap) / speedBound,
          );
      }
      advance(dt, acceleration);
    }
    if (limited) break;
  }
  if (!settled && s.time >= o.maxTime - 1e-8) limited = true;
  return {
    segments,
    final: s,
    outcome: tracker.scored ? tracker.outcome : limited ? "Unresolved" : "Miss",
    scoreTime: tracker.scoreTime,
    contacts,
    settled,
    limited,
    options: o,
    maxHeight,
  };
}
export function sampleRebounds(r: ReboundResult, time: number): State {
  if (time >= r.final.time || r.segments.length === 0) return r.final;
  let lo = 0,
    hi = r.segments.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (r.segments[mid].start.time <= time) lo = mid;
    else hi = mid - 1;
  }
  const segment = r.segments[lo];
  return freeFlight(
    segment.start,
    Math.max(
      0,
      Math.min(segment.end - segment.start.time, time - segment.start.time),
    ),
    segment.acceleration,
  );
}
