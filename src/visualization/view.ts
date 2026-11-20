/** Presentation helpers only. Never integrate, perturb, optimize, or rescore shots. */
import type { Vec } from "../science/physics";
export const COLORS = {
  success: "#56b4e9",
  miss: "#e69f00",
  reference: "#f0e442",
  highlight: "#ffffff",
};
export type CameraMode =
  | "Shot view"
  | "Side"
  | "Overhead"
  | "Ball follow"
  | "Hoop close-up"
  | "Full court";
export class PlaybackClock {
  private elapsed = 0;
  private anchor = 0;
  private running = false;
  private rate = 1;
  time(now: number) {
    return (
      this.elapsed +
      (this.running ? (Math.max(0, now - this.anchor) * this.rate) / 1000 : 0)
    );
  }
  setRunning(running: boolean, now: number) {
    this.elapsed = this.time(now);
    this.anchor = now;
    this.running = running;
  }
  setRate(rate: number, now: number) {
    if (!Number.isFinite(rate) || rate <= 0)
      throw new Error("Invalid playback rate");
    this.elapsed = this.time(now);
    this.anchor = now;
    this.rate = rate;
  }
  reset(now: number) {
    this.elapsed = 0;
    this.anchor = now;
  }
}
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const unit = (p: Vec) => {
  const n = Math.hypot(p.x, p.y, p.z);
  return { x: p.x / n, y: p.y / n, z: p.z / n };
};
const cross = (a: Vec, b: Vec): Vec => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
/** Fit actual coordinates within a perspective frustum, with annotation margin. */
export function fitCamera(
  points: Vec[],
  outward: Vec,
  aspect: number,
  fov = 38,
) {
  const n = unit(outward),
    right = unit(cross({ x: 0, y: 1, z: 0 }, n)),
    up = cross(n, right);
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    zs = points.map((p) => p.z);
  const target = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
    z: (Math.min(...zs) + Math.max(...zs)) / 2,
  };
  const tan = Math.tan((fov * Math.PI) / 360);
  let distance = 3;
  for (const p of points) {
    const q = { x: p.x - target.x, y: p.y - target.y, z: p.z - target.z };
    distance = Math.max(
      distance,
      dot(q, n) +
        (1.28 * Math.abs(dot(q, right))) / (tan * Math.max(0.2, aspect)),
      dot(q, n) + (1.28 * Math.abs(dot(q, up))) / tan,
    );
  }
  return {
    target,
    position: {
      x: target.x + n.x * distance,
      y: target.y + n.y * distance,
      z: target.z + n.z * distance,
    },
    fov,
  };
}
