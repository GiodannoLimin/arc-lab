/** Spin is angular velocity about the sphere's center, not extra launch velocity. */
import { BALL_RADIUS, rad, type Vec } from "./physics";
export function releaseSpin(
  rate: number,
  bearing: number,
  axisAzimuth = 0,
  axisTilt = 0,
): Vec {
  if (![rate, bearing, axisAzimuth, axisTilt].every(Number.isFinite))
    throw new Error("Invalid spin parameters");
  const b = rad(bearing),
    a = rad(axisAzimuth),
    t = rad(axisTilt);
  const w = rate * 2 * Math.PI;
  return {
    x:
      w * Math.cos(t) * (Math.cos(a) * Math.cos(b) - Math.sin(a) * Math.sin(b)),
    y: w * Math.sin(t),
    z:
      w *
      Math.cos(t) *
      (-Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b)),
  };
}
export function surfaceSpinSpeed(rate: number) {
  return 2 * Math.PI * Math.abs(rate) * BALL_RADIUS;
}
/** Launch controls may explore backward/downward angles; center targeting needs forward travel. */
export function canTargetForward(angle: number) {
  return Number.isFinite(angle) && Math.cos(rad(angle)) > 1e-8;
}
export const MAX_LAUNCH_SPEED = 40;
