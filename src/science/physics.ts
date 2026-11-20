/** SI units. Hoop center = (0,H,0), y up, release on positive z side. */
export const G = 9.81;
export const H = 3.05 - 0.009; // FIBA ring centerline; top edge is 3.050 m
export const BALL_RADIUS = 0.12; // size 7, 753.98 mm circumference
export const WIRE = 0.009; // 18 mm diameter ring stock
export const COURTS = {
  FIBA: {
    length: 28,
    width: 15,
    arc: 6.75,
    corner: 6.6,
    inset: 1.575,
    height: 3.05,
    inner: 0.225,
    boardWidth: 1.8,
    boardOffset: 0.375,
    boardBottom: 2.9,
    lane: 4.9,
    freeThrow: 4.225,
    restricted: 1.25,
    boardHeight: 1.05,
  },
  NBA: {
    length: 28.6512,
    width: 15.24,
    arc: 7.239,
    corner: 6.7056,
    inset: 1.5748,
    height: 3.048,
    inner: 0.2286,
    boardWidth: 1.8288,
    boardOffset: 0.381,
    boardBottom: 2.8956,
    lane: 4.8768,
    freeThrow: 4.2164,
    restricted: 1.2192,
    boardHeight: 1.0668,
  },
} as const;
export type League = keyof typeof COURTS;
export type Vec = { x: number; y: number; z: number };
export type Shot = {
  angle: number;
  speed: number;
  height: number;
  distance: number;
  bearing: number;
  aim: number;
};
export const rad = (d: number) => (d * Math.PI) / 180;
export function initial(s: Shot): { p: Vec; v: Vec } {
  const b = rad(s.bearing),
    a = rad(s.angle),
    d = b + rad(s.aim);
  return {
    p: {
      x: s.distance * Math.sin(b),
      y: s.height,
      z: s.distance * Math.cos(b),
    },
    v: {
      x: -s.speed * Math.cos(a) * Math.sin(d),
      y: s.speed * Math.sin(a),
      z: -s.speed * Math.cos(a) * Math.cos(d),
    },
  };
}
export function at(s: Shot, t: number): Vec {
  const { p, v } = initial(s);
  return {
    x: p.x + v.x * t,
    y: p.y + v.y * t - (G * t * t) / 2,
    z: p.z + v.z * t,
  };
}
export function crossing(s: Shot, height = H): number | null {
  const vy = s.speed * Math.sin(rad(s.angle));
  const disc = vy * vy + 2 * G * (s.height - height);
  if (disc <= 0) return null;
  const t = (vy + Math.sqrt(disc)) / G;
  return t > 0 ? t : null;
}
export function flightTime(s: Shot) {
  return crossing(s, BALL_RADIUS) ?? 0;
}
export function requiredSpeed(
  distance: number,
  height: number,
  angle: number,
  targetHeight = H,
) {
  const a = rad(angle),
    denominator =
      2 * Math.cos(a) ** 2 * (distance * Math.tan(a) - (targetHeight - height));
  return denominator > 0 ? Math.sqrt((G * distance ** 2) / denominator) : NaN;
}
export function minimumSpeed(
  distance: number,
  height: number,
  targetHeight = H,
) {
  const dy = targetHeight - height,
    hyp = Math.hypot(distance, dy);
  return {
    angle: (Math.atan2(dy + hyp, distance) * 180) / Math.PI,
    speed: Math.sqrt(G * (dy + hyp)),
  };
}
// Conservative continuous collision certification, not frame samples. The distance
// to a fixed solid is 1-Lipschitz. Bound center motion by max speed * half interval.
// Unresolved grazing within tolerance is a miss (never a false clean basket).
function clearInterval(
  s: Shot,
  lo: number,
  hi: number,
  clearance: (p: Vec) => number,
  depth = 0,
): boolean {
  const mid = (lo + hi) / 2,
    d = clearance(at(s, mid));
  if (d <= 0) return false;
  const { v } = initial(s);
  const vmax = Math.hypot(
    v.x,
    v.z,
    Math.max(Math.abs(v.y - G * lo), Math.abs(v.y - G * hi)),
  );
  if (d > (vmax * (hi - lo)) / 2) return true;
  if (depth >= 20 || hi - lo < 1e-7) return false;
  return (
    clearInterval(s, lo, mid, clearance, depth + 1) &&
    clearInterval(s, mid, hi, clearance, depth + 1)
  );
}
export function cleanShot(s: Shot, league: League): boolean {
  if (
    Object.values(s).some((value) => !Number.isFinite(value)) ||
    s.speed <= 0 ||
    s.angle <= 0 ||
    s.angle >= 90 ||
    s.distance <= 0 ||
    s.height < BALL_RADIUS
  )
    return false;
  const hoopHeight = COURTS[league].height - WIRE;
  const t = crossing(s, hoopHeight),
    upper = crossing(s, hoopHeight + BALL_RADIUS + WIRE),
    lower = crossing(s, hoopHeight - BALL_RADIUS - WIRE);
  if (t === null || upper === null || lower === null) return false;
  const p = at(s, t),
    c = COURTS[league];
  if (Math.hypot(p.x, p.z) >= c.inner - BALL_RADIUS) return false;
  if (!clearInterval(s, 0, lower, (p) => rimClearance(p, league))) return false;
  return clearInterval(s, 0, lower, (p) => boardClearance(p, league));
}
/** Independent fourth-order numerical integrator for validation. */
export function integrate(s: Shot, duration: number, step = 0.001): Vec {
  if (
    !Number.isFinite(duration) ||
    duration < 0 ||
    !Number.isFinite(step) ||
    step <= 0
  )
    throw new Error("Invalid integration duration or step");
  let { p, v } = initial(s);
  let t = 0;
  while (t < duration) {
    const dt = Math.min(step, duration - t);
    // RK4 on p'=v, v'=(0,-g,0); all four acceleration stages equal.
    const k1 = v,
      k2 = { ...v, y: v.y - (G * dt) / 2 },
      k3 = k2,
      k4 = { ...v, y: v.y - G * dt };
    p = {
      x: p.x + (dt * (k1.x + 2 * k2.x + 2 * k3.x + k4.x)) / 6,
      y: p.y + (dt * (k1.y + 2 * k2.y + 2 * k3.y + k4.y)) / 6,
      z: p.z + (dt * (k1.z + 2 * k2.z + 2 * k3.z + k4.z)) / 6,
    };
    v = k4;
    t += dt;
  }
  return p;
}

/** Signed sphere clearance: positive means no contact. */
export function rimClearance(p: Vec, league: League): number {
  const c = COURTS[league];
  return (
    Math.hypot(
      Math.hypot(p.x, p.z) - (c.inner + WIRE),
      p.y - (c.height - WIRE),
    ) -
    BALL_RADIUS -
    WIRE
  );
}
export function boardClearance(p: Vec, league: League): number {
  const c = COURTS[league];
  return (
    Math.hypot(
      Math.max(Math.abs(p.x) - c.boardWidth / 2, 0),
      Math.max(c.boardBottom - p.y, p.y - c.boardBottom - c.boardHeight, 0),
      Math.max(Math.abs(p.z + c.boardOffset + 0.025) - 0.025, 0),
    ) - BALL_RADIUS
  );
}
export type Contact = { time: number; kind: "rim" | "backboard" | "floor" };
/** Absorbing contacts: stop before penetration, with no speculative rebound model.
 * Prefix clearance is certified continuously, then bisected to 1e-8 seconds.
 * This is only needed for representative rendered paths, not every MC shot. */
export function firstContact(s: Shot, league: League): Contact {
  const end = flightTime(s);
  let earliest: Contact = { time: end, kind: "floor" };
  for (const kind of ["rim", "backboard"] as const) {
    const distance = kind === "rim" ? rimClearance : boardClearance;
    const clearance = (p: Vec) => distance(p, league);
    if (clearInterval(s, 0, earliest.time, clearance)) continue;
    let lo = 0,
      hi = earliest.time;
    for (let j = 0; j < 40 && hi - lo > 1e-8; j++) {
      const mid = (lo + hi) / 2;
      if (clearInterval(s, 0, mid, clearance)) lo = mid;
      else hi = mid;
    }
    earliest = { time: lo, kind };
  }
  return earliest;
}
export function playbackTime(
  time: number,
  delta: number,
  slow: boolean,
): number {
  return time + Math.max(0, delta) * (slow ? 0.25 : 1);
}
