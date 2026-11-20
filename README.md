# Arc Lab

An interactive 3D laboratory for asking whether the minimum-speed three-point shot also maximizes clean-shot probability under illustrative release errors.

## Run locally

Requires Node.js 22.12+ (or a current supported version), pnpm, and a WebGL-capable browser.

```sh
pnpm install
pnpm dev
```

Open the printed localhost URL. `pnpm test` runs scientific validation; `pnpm build` produces a static `dist/` folder. Deploy that folder to any static host. No backend, API key, account, or database is required. The included lockfile pins dependencies. `pnpm-workspace.yaml` permits the esbuild installation script.

## Interactive rebounds and preserved baseline

Interactive shots and the default consecutive replay rebound from rim, board, and floor with friction, restitution and spin. Launch controls cover 0–360° and 0–40 m/s, with exact numeric entry. Spin supports 0–20 rev/s and an adjustable axis through the ball center. Read [REBOUND_MODEL.md](REBOUND_MODEL.md) for the current collision model, assumed parameters, scoring categories and limits. The analytical model and Monte Carlo experiments below remain the **swish-only baseline**; their probabilities do not include rebound baskets. Historical absorbing-stop descriptions below apply only to the retained baseline reference paths, not the animated ball. Run `pnpm validate:rebounds` for the executed collision report.

## Architecture

- `src/science/rebounds.ts`: interactive 3D sphere rigid-body simulation, continuous impacts, spin, floor settling and rebound-inclusive single-shot scoring.
- `src/science/physics.ts`: pure SI geometry, trajectories, collision certification, analytical optimum, independent RK4 integration.
- `src/science/statistics.ts`: deterministic random generation, correlated normal errors, confidence intervals, bounded optimization and independent validation.
- `src/science/experiment.worker.ts`: experiments off the main thread; progress and cancellation.
- `src/components/Court.tsx`: Three.js / React Three Fiber rendering; evaluates the analytical trajectory each frame.
- `src/App.tsx`: experiment configuration, saved-result comparisons, sensitivity, JSON export, and educational explanations.

The app implements the five phases described in `IMPLEMENTATION_PLAN.md`. The physics tests were established and passed before adding the statistics module. The browser worker and Node tests execute the same scientific code.

## Coordinates and physical model

All lengths are meters, time seconds, angles degrees at the public interface. The hoop axis is x=z=0; y points up. Bearing 0 puts the release on +z. A positive horizontal aim error rotates the intended horizontal velocity relative to the hoop direction. Release height refers to the **ball center**. The ball is a sphere of radius 0.120 m (circumference 0.754 m, size 7). Gravity is constant at 9.81 m/s². Mass cancels from gravity-only motion.

For release position p₀ and initial velocity v₀:

```
x(t) = x₀ + vx t
z(t) = z₀ + vz t
y(t) = h₀ + vy t − g t²/2
```

For horizontal distance d, target center-plane height hT, Δh=hT−h₀, and elevation θ, eliminate t=d/(v cos θ):

```
v² = g d² / [2 cos²θ (d tanθ − Δh)]
```

The denominator must be positive. Differentiation with respect to tan θ gives:

```
tan θ* = (Δh + sqrt(d²+Δh²))/d
v* = sqrt(g (Δh + sqrt(d²+Δh²)))
```

This solves minimum speed to a point, not finite-ball scoring or maximum probability. The descending target-plane crossing uses the positive quadratic root and requires negative vertical velocity. RK4 independently integrates position and velocity, with a final partial step, and is compared with closed form in tests. The animation uses exact positions; frame rates do not change its trajectory. Slow motion changes playback time only.

## Geometry presets

| Quantity | FIBA preset | NBA preset |
|---|---:|---:|
| Court length × width | 28 × 15 m | 28.6512 × 15.24 m |
| Three-point arc radius | 6.75 m | 7.239 m |
| Corner distance from hoop axis | 6.60 m | 6.7056 m |
| Rim top edge above floor | 3.050 m | 3.048 m |
| Rim inside diameter | 0.450 m | 0.4572 m |
| Backboard width × height | 1.80 × 1.05 m | 1.8288 × 1.0668 m |

FIBA presets use the linked **2024** rules/equipment edition; they do not claim certification against later editions. NBA dimensions convert feet/inches exactly. FIBA allows an inside diameter range; this model selects the smaller 450 mm diameter. Both presets choose an 18 mm circular rim tube (a modeling choice within FIBA's equipment range). The ring tube center is 9 mm below its regulation top edge. Analytical targets and scoring crossings use this center plane consistently. The backboard is modeled as a 50 mm thick rectangular solid extending behind its regulation front face. Supports, net, mounting bracket, boundary line widths, and decorative court details are visual approximations, not collision surfaces. Court markings are drawn at nominal reference positions; there is no foot/three-point eligibility model. Custom release distances can represent two-point positions as well.

Sources:

- [FIBA 2024 rules and basketball equipment](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-official-basketball-rules-and-basketball-equipment.pdf)
- [NBA Rule 1: Court Dimensions and Equipment](https://official.nba.com/rule-no-1-court-dimensions-equipment)

## A successful clean shot

The center crossing the target plane is **not** sufficient. We require:

1. A descending passage that starts fully above the rim tube and finishes fully below it.
2. At the ring center plane, the ball's horizontal center offset is strictly less than the rim's inside radius minus the ball radius.
3. No sphere/ring contact during the entire flight through full exit. Distance from a center (x,y,z) to the circular tube centerline is `sqrt((sqrt(x²+z²)−R)²+(y−hT)²)`, where R is inner rim radius plus wire radius. It must exceed ball radius plus wire radius.
4. No sphere/backboard contact before full exit, using distance to the board's axis-aligned box.

Clearance is certified **continuously** by adaptive subdivision and a Lipschitz bound, not sparse frames. Distance to a fixed solid is 1-Lipschitz; maximum projectile speed on each interval bounds center movement from its midpoint. An interval with insufficient clearance is subdivided. At depth 20 or interval duration below 1e−7 s, unresolved cases conservatively count as misses. This can reject a vanishingly close clean shot; it does not certify an unresolved collision as clear. In the retained original baseline replay, reference paths stop at first rim, board, or floor contact. The default physical replay continues through actual collision responses. The classifier rejects any rim or board contact before full passage.

## Statistical experiment

Default standard deviations (angle 1.5°, speed 0.12 m/s, direction 0.6°) are **illustrative assumptions**, not empirical estimates. A configurable angle–speed correlation uses a bivariate normal transform; direction error is independent. Errors are additive. Nonphysical sampled angles or speeds count as misses, without truncation or resampling. Height and position are held fixed within an experiment. A reproducible 32-bit seeded generator and Box–Muller transform supply normal variates. UI seeds are clamped to unsigned 32-bit integers.

Each candidate uses 10,000–100,000 shots. Common random numbers reduce noise in comparisons. The declared bounded search is:

- Angles 38–68° in 3° steps.
- At each angle, point-target speed plus −0.18, −0.09, 0, +0.09, +0.18 m/s.
- Intended direction −0.35°, 0°, +0.35°.
- The analytical minimum-speed baseline is included independently of this grid.
- A 3×3×3 refinement around the selected candidate explores angle ±1°, speed ±0.04 m/s, and direction ±0.15°.

“Best found” means the best sampled candidate under this bounded procedure. It is **not** a proof of global optimality or an optimum for other error models. Ties preserve the earlier candidate, including the analytical baseline.

A fresh stream seeded with `seed XOR 0x9e3779b9` independently validates both the selected strategy and minimum-speed baseline. Their displayed probabilities use only validation shots, with 95% Wilson binomial confidence intervals. A paired approximate 95% interval for the probability difference accounts for their shared validation noise. At extreme probabilities or very rare discordance, that normal approximation may be unreliable; the separate Wilson intervals remain visible. The exploratory angle plot uses the search sample, choosing speed and aim at each angle. Its pointwise Wilson intervals are **descriptive and not adjusted for selection or simultaneous comparisons**.

Sensitivity evaluates fixed selected and baseline strategies at 0.5×, 1×, 1.5×, 2× all configured standard deviations, preserving correlation. These are scenarios, not re-optimized strategies or measured player skill levels. Each scenario has its own stream, shared by the two strategies. JSON export preserves all configuration, estimates, intervals, previews, and evaluation counts; elapsed runtime is naturally nondeterministic. Changing controls does not rewrite a saved experiment, and the interface marks saved results as stale.

## Limits and interpretation

The gravity-only statistical baseline omits drag, spin, Magnus effects, deformation, release biomechanics, and variation in height or position. In that baseline, rim/board contacts count as misses. The separate interactive solver includes contact-generated spin and rebound baskets, without aerodynamic spin forces. The decorative net is static and exerts no force. No empirical probability claim or player model is implied. Monte Carlo intervals quantify finite-sample noise **conditional on this model**; they say nothing about the uncertainty of representing real players and real equipment.

## Validation

`pnpm test` covers target-plane equations, dense minimum-speed angle comparisons, RK4 agreement across steps/bearings/aims, finite-sphere shallow-shot rejection, a dense independent clearance sweep for certified passes, NBA target-height consistency, invalid/unreachable inputs, seeded reproducibility and normal moments, correlation, zero-error outcomes over 10,000 shots, and Wilson boundary intervals.

The local browser preview additionally exercises WebGL rendering, launch/camera controls, the worker experiment, comparison cards, probability graph, sensitivity, and responsive/recording layouts. A production build is generated with TypeScript checks.

## Phase 2 validation and Statistics Mode

Open **Shot → Position** to choose a position, then **Errors** (or the top **Experiment** button) to configure release errors. Blue/orange reference paths are balanced representatives (up to 12 of each class), not a frequency sample. Reference lines stop at first solid contact; optional balls continue through physical rebounds. Sequence instead uses trials in their original order.

Run `pnpm validate` to execute the Phase 2 gate and regenerate [the numerical validation report](VALIDATION_REPORT.md), `artifacts/phase2-validation.json`, and the actual seed-42 experiment `artifacts/phase3-seed-42.json`. The report includes absolute/relative errors, limitations, and manual QA steps. The internal vertical axis is y, equivalent to the requested z-up equations under axis renaming.

## Cinematic shooting studio

The default scene is now a focused half-court view, with Side, Overhead, Ball follow, Hoop close-up, and Full court cameras. Playback supports pause/resume, replay, and 0.1×–2× speed. Presentation mode offers 9:16 / 16:9 frames and synchronized strategy comparison after an experiment. Visual direction controls manage example count, highlighting, animated examples, annotations, and trails. See [VISUALIZATION.md](VISUALIZATION.md) for the data-to-visual relationship and recording instructions. The analytical and statistical baseline scoring definitions are preserved.

## Compact workspace

The simulator stays visible while you use the Shot, Sequence, Errors, Results, and View tabs. Play/replay, speed, and camera controls remain below the court. Calculate probabilities from the fixed panel footer; Results opens automatically. Use Watch shots for consecutive playback, Compare in 3D for strategy comparison, or The science for the detailed explanation. Longer panel content scrolls within the panel; the normal page stays in place.


## Extended release controls and replay

Open **Advanced controls → Shot** for the full controls and **Spin & collision physics**. Elevation uses the simulator's vertical launch plane: 0° is horizontal toward the hoop, 90° straight up, 180° horizontally away, 270° straight down, and 360° equivalent to 0°. Speeds 0–40 m/s are a sandbox range, not recommended human shooting speeds. Aim trajectory is disabled when a forward point-target shot is impossible or requires more than 40 m/s. The statistical search remains its documented 38–68° range.

Spin is independent of center-of-mass launch speed: angular speed ω=2πf and equatorial surface speed is ωR. Backspin, topspin, sidespin, and custom axes are available. It affects contact friction and rendered orientation; no Magnus force or fingertip-release biomechanics is modeled. Try **Rim-assisted** or **Backboard-assisted** for reproducible zero-spin examples.

In **Sequence**, Physical rebounds is the default. It regenerates the saved held-out release errors, then runs the separate rigid-body solver with the current spin. A new shot follows the preceding first floor contact and selected gap; at most four balls remain moving. A slot is reused only after its previous run settles or reaches its disclosed solver limit. Physical basket counters are descriptive for this replay subset. They do not replace the full experiment's swish-only probability or optimize rebounds. Original clean-shot baseline remains selectable.

## Publishing

The project is prepared for a static host. `pnpm build` uses `/` by default; `BASE_PATH=/arc-lab/ pnpm build` prepares a GitHub project Pages deployment. The worker and bundled equation fonts use the same base path.

GitHub Pages uses the compiled static files on the separate `gh-pages` branch, with a `.nojekyll` file. Set Pages to Deploy from a branch → gh-pages → /(root). After source changes, run tests, rebuild with the project base path, then publish the new `dist/` contents to that branch. This does not require an OAuth workflow permission. GitHub Pages is available for public repositories on GitHub Free; a private source repository requires an eligible paid plan. Do not commit credentials or `.env` files.
