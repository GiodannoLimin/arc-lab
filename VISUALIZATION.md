# Shooting studio and recording layouts

The analytical and statistical core equations, gravity, distributions, optimizer, confidence intervals, and swish-only scoring are preserved. The separate rebound solver now accepts an explicit angular velocity vector for release-axis controls.

## Scene and cameras

The default Shot view fits the actual release-to-hoop geometry before first floor contact. Only the near half-court is rendered; regulation dimensions and ball/rim scale remain unchanged. Side, Overhead, Ball follow, Hoop close-up, and Full court are available. Full court adds the far half and hoop back into the scene. View changes ease toward a fitted camera pose using a time-based exponential transition. Orbiting remains available outside active Ball follow. Tight close-ups intentionally omit the distant release; follow can leave the initial half-court when tracking floor rebounds.

Camera frustum fitting uses actual simulated points, plus backboard extents. Portrait framing uses an oblique angle to make better use of the narrow format. Ordinary perspective depth with a bounded near/far range (extended for the 40 m/s sandbox) and non-overlapping floor patches avoids coplanar floor flicker, including overhead views. Anti-aliasing, capped pixel density, shadows, and a cool rim light improve readability. No object is enlarged relative to regulation dimensions.

## Paths, color, and examples

- Blue (`#56b4e9`): a scoring physical shot or successful swish-only example.
- Orange (`#e69f00`): a physical miss or failed swish-only example; example misses are also dashed.
- Gold (`#f0e442`), dotted: collision-free analytical reference.

Color is reinforced by outcome text, line pattern for baseline misses, and selected-example labels. Widths are in screen pixels; paths consist of dense samples of existing physics segments or exact analytical evaluations. There is no Catmull–Rom/Bezier smoothing or invented arc that could cut through collisions.

The primary shot line stops at the first floor contact by default, avoiding the dense sequence of subsequent floor bounces. Full rebound path restores the complete recorded path. The actual ball always continues through the full rebound simulation and its quaternion supplies rotation. The optional moving trail samples the previous 0.45 simulation seconds. Turning off Shot paths hides static lines; the moving trail has its own switch.

Monte Carlo still runs its complete configured sample in the worker. It does not render thousands of balls. Saved `result.previews` supply deterministic, deliberately selected success/miss examples. The path limit is configurable from 1 to 24, one example can be highlighted, and at most four representative balls animate. Each uses the separate rebound solver, including its quaternion, and remains at rest after settling. Faint reference lines and their success/miss labels still describe the original swish-only baseline. Physical rebound outcomes must not be read as those reference labels. Subset counts are labeled as selected examples, never frequency-weighted probability evidence.

## Playback and presentation

One shared clock supports 0.1×, 0.25×, 0.5×, 1×, and 2×. Pause freezes simulation time; resume continues it; Replay resets to release. Changing speed rebases elapsed time instead of jumping. All views sample precomputed physical states; none advances the solver. Comparison views read the same clock.

Presentation mode hides the setup panels, charts, and site navigation. Its toolbar is outside the capture frame. Choose 9:16 portrait or 16:9 landscape. The frame scales to the viewport; a larger browser window provides a larger recording resolution. Angle, speed, physical apex, and predicted outcome are readable HUD labels. Optional distance, release-height, and rim-height chips stay in screen space rather than overlapping in world space. Scientific geometry guides remain at their real coordinates.

After running an experiment, Compare strategies shows the saved analytical minimum-speed strategy and saved statistical best-found strategy. Landscape uses adjacent scenes; portrait stacks them within one 9:16 capture frame. Both use the saved experiment geometry, zero release backspin, and the unchanged interactive rebound solver. Displayed probabilities are explicitly **swish-only** validation estimates. The main arbitrary shot shows a probability only if its intended parameters and geometry match a saved strategy; otherwise the UI says it has not estimated rebound-inclusive probability.

## Verification and limits

`pnpm test` includes all prior scientific tests plus presentation tests for clock pause/resume/replay, rate independence, shared-clock comparison, and non-mutating camera fitting over desktop and portrait aspect ratios. `pnpm build` checks TypeScript and builds the static app. Seed reproducibility is verified by the existing full experiment tests.

The new rendering remains an approximation at screen-pixel resolution; trajectory line segments have finite sampling density. In a very small landscape comparison frame, optional annotation chips are hidden to protect the primary metrics. Camera transitions can temporarily crop distant geometry as they move into a tight view. Performance depends on GPU, pixel density, and the number of enabled examples; comparison renders two scenes with a lower pixel-density cap. No claim of a device-independent frame rate is made. Underlying rebound and swish-only model limitations remain documented in REBOUND_MODEL.md and README.md.

Manual checks: play, pause and resume; change rate mid-shot; switch cameras; replay a rim or board assisted shot; run seed 42, choose 4 examples and toggle animation; highlight an actual failed example; compare the saved strategies; enter each recording format and toggle annotations/paths; inspect Full court. The scientific results should not change with these controls.

## Consecutive shot replay

The **Sequence** tab beside the court launches 10, 25, 50, or 100 balls, one after another. Select Best found or Minimum speed, choose the pause between shots, and click **Play shot sequence**. If no experiment exists, **Run experiment & play sequence** calculates it first. Existing playback speed, pause/resume, replay, cameras, and presentation formats apply. **Return to single shot** restores the physical rebound animation.

This replay regenerates the first N trials of the saved held-out validation stream using the same seed XOR, normal generator, and perturbation function as the original experiment. It preserves trial order and does not balance or cherry-pick outcomes. Physical rebounds is the default: every trial is also run through the separate rigid-body solver using the selected spin. Balls continue after rim, board, and floor impacts. The next launch follows first floor contact plus the selected pause, with at most four moving balls and slots reused after settling or a disclosed limit. Clean, rim-assisted, board-assisted, miss, and unresolved counters describe only this physical subset. Original clean-shot baseline is still selectable: it ends balls at first contact, counts full-sphere swishes, and spaces launches by the whole baseline flight plus pause. A progressive path changes from neutral to blue/orange only when its outcome resolves.

The HUD distinguishes released shots, resolved swishes/misses, the small replay's running rate, and the full validation estimate with its confidence interval. A short sequence can differ substantially from that estimate. Release-error assumptions, scoring, and optimization remain unchanged. The older balanced example overlay remains separately available.

Automated sequence tests compare regenerated shots with the original 10,000-shot validation prefix for both strategies, verify outcome timing and non-overlapping launches, and check completion, pause/replay, rate independence, and non-mutation of saved results.

## Compact workspace

The normal app now fills the available viewport. The court and bottom playback bar stay visible while tools switch between **Shot**, **Sequence**, **Errors**, **Results**, and **View**. Desktop tools sit beside the court; phone-sized layouts place a bounded panel underneath it. Only long tool content scrolls internally, so you do not need to scroll the page between setup and animation. Arrow keys, Home, and End switch the tool tabs from the keyboard.

**Calculate probabilities** is always accessible at the bottom of the tools panel. Calculation automatically opens Results unless it was requested by the sequence play action. Results offers **Watch shots**, **Compare in 3D**, shot-loading buttons, export, the probability chart, confidence intervals, and expandable scientific interpretation/sensitivity. The full equations and limitations remain on **The science**, which can scroll independently as a reading page. Presentation mode retains its existing 9:16 and 16:9 frames with the tools hidden.

Quick start: adjust Shot → Play shot; or configure Errors → Calculate probabilities → Results → Watch shots. The persistent playback bar controls pause/resume, replay, rate, and camera for any active animation. Opening another tool does not change its clock or sampled outcomes.

## Guided editorial interface

The default experiment follows three visible steps: **Watch a shot → Add human error → Compare results**. Each step has a contextual primary action. The original five tools are available through **Advanced controls**, so the first screen no longer requires discovering which tabs to use. The live court and persistent playback bar remain in place; longer optional panels can still scroll internally on small screens.

The science page is now a four-chapter reader: flight, minimum speed, scoring, and human error. Fixed TeX expressions are rendered with [KaTeX](https://katex.org/docs/api.html), including accessible MathML. KaTeX and its fonts are bundled locally; the chapter reader loads on demand. Rendered equations describe the existing model; they do not perform or replace numerical calculations. A test typesets every displayed expression with strict parsing.

The visual identity uses charcoal, warm paper, serif editorial headings, copper accents, and subtle concentric linework. Court background and border materials were recolored; court geometry, trajectories, collision responses, statistical distributions, and scoring remain unchanged. Blue/orange trajectory coding is preserved.
