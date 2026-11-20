import {
  requiredSpeed,
  type Shot,
  at,
  integrate,
  minimumSpeed,
  COURTS,
  WIRE,
  G,
} from "./physics";
/** Golden-section optimization, independent of the differentiated closed form. */
export function numericalMinimum(
  distance: number,
  height: number,
  target: number,
) {
  let lo =
      Math.max(0, (Math.atan2(target - height, distance) * 180) / Math.PI) +
      1e-5,
    hi = 89.999;
  const q = (Math.sqrt(5) - 1) / 2;
  let a = hi - q * (hi - lo),
    b = lo + q * (hi - lo),
    fa = requiredSpeed(distance, height, a, target),
    fb = requiredSpeed(distance, height, b, target);
  for (let i = 0; i < 100; i++) {
    if (fa < fb) {
      hi = b;
      b = a;
      fb = fa;
      a = hi - q * (hi - lo);
      fa = requiredSpeed(distance, height, a, target);
    } else {
      lo = a;
      a = b;
      fa = fb;
      b = lo + q * (hi - lo);
      fb = requiredSpeed(distance, height, b, target);
    }
  }
  const angle = (lo + hi) / 2;
  return { angle, speed: requiredSpeed(distance, height, angle, target) };
}
export function validateNumerically() {
  const rows = [];
  for (const league of ["FIBA", "NBA"] as const)
    for (const distance of [3, 4, 5, 6, 6.75, 7.239, 8, 9])
      for (const height of [1.5, 2, 2.5]) {
        const target = COURTS[league].height - WIRE,
          ideal = minimumSpeed(distance, height, target),
          numeric = numericalMinimum(distance, height, target);
        let maxPositionError = 0,
          maxRelativePositionError = 0,
          maxTargetError = 0;
        for (const angle of [35, 45, 55, 65, 75])
          for (const step of [0.1, 0.01, 0.001]) {
            const speed = requiredSpeed(distance, height, angle, target);
            if (!Number.isFinite(speed)) continue;
            const shot: Shot = {
              angle,
              speed,
              height,
              distance,
              bearing: 37,
              aim: 0,
            };
            const time = distance / (speed * Math.cos((angle * Math.PI) / 180)),
              exact = at(shot, time),
              actual = integrate(shot, time, step);
            const error = Math.hypot(
              exact.x - actual.x,
              exact.y - actual.y,
              exact.z - actual.z,
            );
            maxPositionError = Math.max(maxPositionError, error);
            maxRelativePositionError = Math.max(
              maxRelativePositionError,
              error / Math.max(1, Math.hypot(exact.x, exact.y, exact.z)),
            );
            maxTargetError = Math.max(
              maxTargetError,
              Math.hypot(actual.x, actual.y - target, actual.z),
            );
          }
        rows.push({
          league,
          distance,
          height,
          angle: ideal.angle,
          speed: ideal.speed,
          angleAbsoluteError: Math.abs(ideal.angle - numeric.angle),
          angleRelativeError:
            Math.abs(ideal.angle - numeric.angle) / ideal.angle,
          speedAbsoluteError: Math.abs(ideal.speed - numeric.speed),
          speedRelativeError:
            Math.abs(ideal.speed - numeric.speed) / ideal.speed,
          maxPositionError,
          maxRelativePositionError,
          maxTargetError,
        });
      }
  return {
    gravity: G,
    coordinateSystem: "y up; user z-height equations map to internal y",
    cases: rows.length,
    trajectoryChecks: rows.length * 5 * 3,
    rows,
  };
}
