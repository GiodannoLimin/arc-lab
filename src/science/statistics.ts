import {
  cleanShot,
  COURTS,
  WIRE,
  minimumSpeed,
  requiredSpeed,
  type League,
  type Shot,
} from "./physics";
export type Errors = {
  angle: number;
  speed: number;
  aim: number;
  correlation: number;
};
export type Config = {
  shot: Shot;
  league: League;
  errors: Errors;
  samples: number;
  seed: number;
};
export type Estimate = {
  hits: number;
  n: number;
  p: number;
  lo: number;
  hi: number;
};
export type Candidate = Estimate & {
  angle: number;
  speed: number;
  aim: number;
};
export type Result = {
  config: Config;
  baseline: Candidate;
  best: Candidate;
  profile: Candidate[];
  sensitivity: { scale: number; baseline: Estimate; best: Estimate }[];
  difference: { value: number; lo: number; hi: number };
  shots: number;
  previews: Shot[];
  elapsed: number;
  searchCandidates: number;
};
export function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normals(n: number, seed: number) {
  const rng = random(seed),
    out = new Float64Array(n * 3);
  for (let i = 0; i < out.length; i += 2) {
    const radius = Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-15))),
      a = 2 * Math.PI * rng();
    out[i] = radius * Math.cos(a);
    if (i + 1 < out.length) out[i + 1] = radius * Math.sin(a);
  }
  return out;
}
export function wilson(hits: number, n: number): Estimate {
  const p = hits / n,
    z = 1.959963984540054,
    den = 1 + (z * z) / n,
    center = (p + (z * z) / (2 * n)) / den,
    half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return {
    hits,
    n,
    p,
    lo: Math.max(0, center - half),
    hi: Math.min(1, center + half),
  };
}
export function perturb(
  s: Shot,
  e: Errors,
  z: Float64Array,
  i: number,
  scale = 1,
): Shot {
  return {
    ...s,
    angle: s.angle + scale * e.angle * z[3 * i],
    speed:
      s.speed +
      scale *
        e.speed *
        (e.correlation * z[3 * i] +
          Math.sqrt(1 - e.correlation ** 2) * z[3 * i + 1]),
    aim: s.aim + scale * e.aim * z[3 * i + 2],
  };
}
export function estimate(
  s: Shot,
  c: Config,
  z: Float64Array,
  scale = 1,
): Candidate {
  let hits = 0;
  for (let i = 0; i < c.samples; i++)
    if (cleanShot(perturb(s, c.errors, z, i, scale), c.league)) hits++;
  return {
    ...wilson(hits, c.samples),
    angle: s.angle,
    speed: s.speed,
    aim: s.aim,
  };
}
export function experiment(
  c: Config,
  progress: (done: number, total: number) => void = () => {},
): Result {
  if (!Number.isInteger(c.samples) || c.samples < 10000 || c.samples > 100000)
    throw new Error("Sample size must be 10,000–100,000.");
  if (
    !Number.isFinite(c.errors.correlation) ||
    !Number.isInteger(c.seed) ||
    c.seed < 0 ||
    c.seed > 4294967295 ||
    Math.abs(c.errors.correlation) > 1 ||
    [c.errors.angle, c.errors.speed, c.errors.aim].some(
      (x) => !Number.isFinite(x) || x < 0,
    )
  )
    throw new Error("Invalid error distribution.");
  const start = performance.now(),
    z = normals(c.samples, c.seed),
    ideal = minimumSpeed(
      c.shot.distance,
      c.shot.height,
      COURTS[c.league].height - WIRE,
    ),
    baselineShot = { ...c.shot, ...ideal, aim: 0 };
  let selected = estimate(baselineShot, c, z),
    count = 1;
  const profile: Candidate[] = [];
  const total = 1 + 11 * 5 * 3 + 27;
  for (let angle = 38; angle <= 68; angle += 3) {
    let winner: Candidate | undefined;
    for (const offset of [-0.18, -0.09, 0, 0.09, 0.18])
      for (const aim of [-0.35, 0, 0.35]) {
        const speed =
          requiredSpeed(
            c.shot.distance,
            c.shot.height,
            angle,
            COURTS[c.league].height - WIRE,
          ) + offset;
        const r = estimate({ ...c.shot, angle, speed, aim }, c, z);
        count++;
        if (!winner || r.p > winner.p) winner = r;
        if (r.p > selected.p) selected = r;
        progress(count, total);
      }
    profile.push(winner!);
  }
  const center = { ...selected };
  for (const da of [-1, 0, 1])
    for (const dv of [-0.04, 0, 0.04])
      for (const dd of [-0.15, 0, 0.15]) {
        const r = estimate(
          {
            ...c.shot,
            angle: center.angle + da,
            speed: center.speed + dv,
            aim: center.aim + dd,
          },
          c,
          z,
        );
        count++;
        if (r.p > selected.p) selected = r;
        progress(count, total);
      }
  // Fresh stream: never report the selection estimate as held-out performance.
  const validation = normals(c.samples, c.seed ^ 0x9e3779b9),
    bestShot = {
      ...c.shot,
      angle: selected.angle,
      speed: selected.speed,
      aim: selected.aim,
    };
  const baseline = estimate(baselineShot, c, validation),
    best = estimate(bestShot, c, validation);
  const successfulPreviews: Shot[] = [],
    missedPreviews: Shot[] = [];
  let sum = 0,
    sumSq = 0;
  for (let i = 0; i < c.samples; i++) {
    const actual = perturb(bestShot, c.errors, validation, i);
    const hit = cleanShot(actual, c.league);
    const pool = hit ? successfulPreviews : missedPreviews;
    if (pool.length < 12) pool.push(actual);
    const d =
      Number(hit) -
      Number(
        cleanShot(perturb(baselineShot, c.errors, validation, i), c.league),
      );
    sum += d;
    sumSq += d * d;
  }
  const difference = sum / c.samples,
    se = Math.sqrt(
      Math.max(
        0,
        (sumSq - c.samples * difference * difference) / (c.samples - 1),
      ) / c.samples,
    );
  const sensitivity = [0.5, 1, 1.5, 2].map((scale, j) => {
    const noise = normals(c.samples, (c.seed + 12345 + j * 777) >>> 0);
    return {
      scale,
      baseline: estimate(baselineShot, c, noise, scale),
      best: estimate(bestShot, c, noise, scale),
    };
  });
  return {
    config: c,
    baseline,
    best,
    profile,
    sensitivity,
    difference: {
      value: difference,
      lo: difference - 1.96 * se,
      hi: difference + 1.96 * se,
    },
    shots: (count + 2 + 2 + 8) * c.samples,
    // Deliberately balanced representatives, never a frequency sample.
    previews: successfulPreviews
      .flatMap((s, i) => (missedPreviews[i] ? [s, missedPreviews[i]] : [s]))
      .concat(missedPreviews.slice(successfulPreviews.length)),
    elapsed: performance.now() - start,
    searchCandidates: count,
  };
}
