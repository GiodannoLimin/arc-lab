# Extended release and rebound replay validation

Executed checks for the 0–360° / 0–40 m/s release controls, spin-axis controls, and physical subset replay:

- `pnpm test`: 47 tests passed, zero failed. Includes all existing mathematical/statistical/collision tests and new release/spin/replay checks.
- `pnpm validate`: Phase 2 gate passed (48 optimization cases, 720 independent RK4 target checks); seed-42 swish-only results reproduced exactly.
- `pnpm validate:rebounds`: passed; four swish/rim/board/miss fixtures settled, with the numerical errors recorded in COLLISION_VALIDATION.md.
- `pnpm build`: TypeScript and production build passed. Vite reports a large main bundle; it is a performance limitation rather than a build failure.
- `BASE_PATH=/arc-lab/ pnpm build`: passed; generated HTML asset paths and the worker URL use `/arc-lab/`.
- SHA-256 checks confirmed `physics.ts`, `statistics.ts`, and `numerics.ts` are unchanged from before these controls were added.

New numerical tests cover 0, 30, 90, 120, 180, 225, 270, 300, and 360° at 0, 10, and 40 m/s. The solver matches analytical positions before contact within 1e-10 m, remains finite, and preserves unit quaternions within 1e-12. Axis transforms preserve angular speed within 1e-12 rad/s; a quarter-turn orientation test verifies rotation independently of translation. The explicit spin vector matches the legacy backspin path exactly. Replay tests preserve original sampled releases and baseline labels while allowing real post-contact motion with at most four moving balls.

Browser checks executed on the local app:

- Exact angle and speed inputs accepted both endpoints (0 / 360°, 0 / 40 m/s).
- Spin at 2 rev/s with the vertical axis displayed 12.57 rad/s and 1.51 m/s equatorial surface speed.
- Rim-assisted and backboard-assisted buttons loaded their actual solver categories.
- The 10-trial seed-42 physical replay completed with 1 backboard-assisted basket, 9 misses, and zero unresolved runs. These are only the ordered replay subset, not an estimate replacing the 10,000-trial baseline.
- The full displayed clean-shot estimate remained 16.2% (rounded), 95% CI 15.4–16.9%.
- Desktop layout and 390×844 phone layout rendered; phone page width equaled viewport width (390 px), with controls in an internally scrolling panel.

The full default seed-42 experiment remains 817/10,000 swishes at 49.383605° / 8.787068 m/s, and 1,615/10,000 at the best-found 59° / 9.091496 m/s. No rebound-inclusive probability optimization was performed.

Collision parameters and rotational inertia are assumptions, not experimentally calibrated measurements. Spin affects contact friction and rendered orientation; there is no aerodynamic spin force or fingertip-release model. Extreme sandbox launches can hit the 40 s solver limit. Limited runs are disclosed and the ball is hidden at the limit rather than held at an airborne endpoint. Physical outcome categories, including Unresolved, remain separate from swish-only probability estimates. Balls do not collide with one another.

For a manual check, open Advanced controls → Shot, try the angle/speed bounds, expand Spin & collision physics, then load a rebound preset and play. In Sequence, compare Physical rebounds with Original clean-shot baseline. Use pause, replay, and playback speed to inspect the same saved paths.
