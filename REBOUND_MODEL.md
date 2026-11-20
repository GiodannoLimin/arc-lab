# Interactive rigid-body rebounds

Interactive shots now use `src/science/rebounds.ts`. The existing analytical model, `cleanShot`, `firstContact`, mathematical validation, Monte Carlo optimizer, and saved swish-only results remain separate. `firstContact` is retained for baseline reference paths; it no longer stops the animated ball.

## Geometry and integration

One finite-radius sphere interacts with static, immovable solids: the exact circular rim tube (torus), the rectangular backboard box, and an infinite horizontal floor. Geometry and units come from the existing physics module. The visible arena floor extends outside the court; net, mounting bracket, and supports are decorative and do not collide. Rendering samples the solver's position and quaternion, including after impacts. The gold dotted reference is the collision-free analytical parabola and is explicitly optional.

The fixed outer step is 1/240 s. Each step is divided at impacts using conservative advancement: distance to a static solid is 1-Lipschitz, so 90% of clearance divided by a speed bound is a certified safe advance. The speed bound includes acceleration over the remaining interval. Floor time of impact is solved quadratically. Remaining step time continues after the impulse, rather than being discarded. Between contact events, constant-gravity position and velocity and constant-angular-velocity quaternion evolution are evaluated analytically. Supported floor contact balances gravity with a normal reaction.

The renderer uses recorded ballistic segments, not a visual bounce curve or frame-by-frame physics integration. It samples exact segment positions, including fractional times across a rebound; camera easing is cosmetic. Path lines approximate those segments with vertices. Simulation results are independent of rendering frame rate.

## Assumed parameters (not measured or experimentally validated)

| Parameter | Value | Interpretation |
|---|---:|---|
| Mass | 0.624 kg | Assumed size-7 ball mass |
| Radius | 0.120 m | Existing finite-sphere geometry |
| Moment of inertia | (2/3)mr² | Ideal uniform thin spherical shell |
| Rim restitution / Coulomb friction | 0.65 / 0.35 | Assumed effective contact coefficients |
| Board restitution / Coulomb friction | 0.75 / 0.30 | Assumed effective contact coefficients |
| Floor restitution / Coulomb friction | 0.82 / 0.60 | Assumed effective contact coefficients |
| Release spin | 0 rev/s by default; UI 0–20 | Adjustable axis through the center; presets for backspin, topspin, sidespin |
| Low-speed restitution threshold | 0.15 m/s | Below this normal approach speed, impact is inelastic |
| Supported rolling/spin decay | 0.7 s⁻¹ | Phenomenological energy loss, only on the floor |
| Sleep thresholds | speed <0.025 m/s, angular speed <0.25 rad/s | Only while supported on the floor |

Restitution e is the ratio of separating to approaching normal speed. Friction uses a contact impulse opposing surface slip, capped by μ times the normal impulse; it can generate or reduce spin. These dimensionless coefficients are plausible passive values, not estimates for a particular ball, rim or backboard. Material compliance, pressure, surface variability, and net losses are not modeled. No claim of real-world calibration is made.

The normal impulse is Jn=−m(1+e)(v·n). The tangential contact velocity is vt = tangent(v + ω×r), with r=−Rn. Its impulse magnitude is min(|vt|/(1/m+R²/I), μJn). Linear velocity changes by J/m; angular velocity changes by (r×J)/I. The static obstacle supplies the opposite impulse. Ball momentum alone is therefore not conserved; elastic frictionless contact conserves kinetic energy, while restitution below one and Coulomb friction dissipate it. Rolling/spin decay and sleeping are additional dissipative approximations for settling, not a measured rolling model.

The impulse approach follows standard rigid-body mechanics, e.g. [Baraff's rigid-body course notes](https://www.cs.cmu.edu/~baraff/sigcourse/) and the [Box2D simulation discussion of restitution, friction, low-speed contacts and CCD](https://box2d.org/documentation/md_simulation.html). This implementation is a small purpose-specific **3D** sphere solver, not Box2D or a general multi-body engine.

## Tolerances and numerical limits

A contact is processed at clearance ≤1e−7 m and separated to 2e−6 m clearance. Floor support uses a 3e−6 m neighborhood and |vy|<0.02 m/s. Positional correction introduces a small geometric/energy error (micrometer scale), so there is no claim of exact global conservation through projected contacts. Sleep explicitly removes residual kinetic energy. The fixed step, sequential impacts, and tolerances can alter highly sensitive multi-rim trajectories.

A step allows 512 advancement/contact iterations; the default duration limit is 40 s. Exhaustion is disclosed as a solver limit. If scoring has not completed, the result is **Unresolved**, not an asserted miss. A basket already completed remains scored even if later settling hits a limit. These safeguards do not advance through an unresolved solid. Arbitrary initial embedding and persistent simultaneous multi-contact equilibria are not general-purpose supported use cases.

## Basket detection and categories

A basket must enter from above, cross the ring center plane descending with the entire sphere cross-section inside the opening, and continue until the sphere is fully below the ring tube. Plane crossings are solved within ballistic segments, rather than inferred from rendering frames. A reversal above the center plane cancels the pending passage; later entry can be considered again. Rim and board contacts before complete exit determine the category:

- **Clean swish:** no prior rim or board contact.
- **Rim-assisted:** rim contact, with no prior board contact.
- **Backboard-assisted:** board contact, including cases with both board and rim contact. Full contact history preserves both.
- **Miss:** simulation settles without completing a basket.
- **Unresolved:** numerical/time limit without a completed basket.

Floor contact before a basket invalidates later scoring (this model excludes ground-bounce trick shots). Floor contacts after full passage do not retroactively alter the basket. There is no player, foot position, clock, interference, or full basketball rules engine.

## Statistics and reproducibility

The Monte Carlo experiment still evaluates **swishes only**, including its original finite-sphere/no-contact requirement. Its faint green/orange representative lines still end at first contact. Neither restitution nor backspin enters this baseline optimizer, and the UI labels that distinction. No rebound-inclusive probability or optimum has been estimated. The same rebound solver also powers the default ordered subset replay and optional animated examples. Their physical counters are separate from baseline probabilities; no rebound-inclusive optimization has been run.

Run `pnpm test`, `pnpm validate`, `pnpm validate:rebounds`, and `pnpm build`. Rebound tests include frictionless elastic conservation, restitution losses, friction/angular-momentum exchange, gravity-only energy conservation, restitution-squared drop height, high-speed CCD, contact distances/normals, repeated floor bounces and settling, full-sphere scoring and all outcome categories, fixed-step refinement, frame-independent sampling, reproducibility, 3D spin stability, nonpenetration stress paths, and invalid configuration rejection. `COLLISION_VALIDATION.md` and `artifacts/rebound-validation.json` record executed checks. Tests verify this mathematical implementation, not experimental realism.

Try at FIBA distance 6.75 m, release height 2 m, zero aim/backspin: 52° with Aim trajectory for a swish; 35° at 9.50 m/s for a rim-assisted basket; 35° at 9.60 m/s for a board-assisted basket; 30° at 12 m/s for a board rebound that misses. Use normal speed and Follow to observe subsequent bounces and settling. These examples are solver-specific, not recommendations for real shooting.


## Release-axis controls

`releaseSpin` converts frequency in rev/s to an angular velocity vector in rad/s. Axis azimuth rotates from the local shot lateral axis toward the forward axis; tilt rotates toward world up. The zero azimuth/tilt preset matches the original backspin implementation. Surface speed ωR is shown separately from launch speed. Statistical comparisons continue to use the original zero-spin swish-only model. Synchronized strategy comparison scenes also retain zero release spin.
