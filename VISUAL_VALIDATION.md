# Visualization validation

Executed checks for the shooting-studio redesign:

- All **39 automated tests pass**, including the 35 existing scientific tests and four new presentation tests.
- TypeScript and the production Vite build pass. The build still warns about the size of the Three.js bundle.
- SHA-256 comparisons confirm physics.ts, statistics.ts, rebounds.ts and numerics.ts are unchanged. Digests are saved in artifacts/visualization-science-integrity.json.
- Clock tests verify pause/resume/replay, changing speed without a time jump, identical physical states at equal simulation times for 0.1×–2× playback, and two comparison views reading one clock.
- Camera-fitting tests project 42 actual source points across five aspect ratios and three view directions (630 point/frustum checks); fitting does not mutate source coordinates.
- Existing seeded Monte Carlo tests rerun the full search twice and compare estimates, selected strategies, profiles and sensitivity results; the independent validation stream remains verified.

Browser inspection exercised desktop and narrow phone-sized viewport overrides, focused shot view, hoop close-up, full court, overhead, pause/replay, four selected baseline example balls, and portrait/landscape strategy comparison. The portrait frame fits its metrics inside 9:16. Annotation values use fixed chips outside the world-space labels, avoiding overlap during camera changes.

An overhead inspection exposed coplanar floor flicker. The court, border and arena floor now use non-overlapping patches at the same physical floor elevation; the overhead view was inspected again successfully.

A browser run with default seed 42 returned the same saved statistical values: 817/10,000 minimum-speed swishes and 1,615/10,000 best-found swishes. Recording views show these as swish-only confidence estimates, not rebound-inclusive probability.

## Limits

The preview was inspected in the connected browser, not on a fleet of physical phones. Pixel density is capped and no more than four Monte Carlo example balls animate, but no device-independent FPS or GPU benchmark is claimed. The browser inspection interface did not expose requestAnimationFrame timing for an attempted frame-cadence measurement. Dense path polylines approximate the recorded physical segments at rendering resolution. Small landscape comparisons hide optional annotation chips; primary angle/speed/apex and swish estimates remain. Tight camera transitions can momentarily crop distant geometry.

Baseline example balls disappear at contact by design, because their saved model is swish-only; the primary ball uses the validated rebound trajectory and continues bouncing. Selected examples are not probability-weighted. All existing scientific-model limitations remain.

See VISUALIZATION.md for usage, controls and the data-to-visual relationship.
# Consecutive replay follow-up

Executed `pnpm test`: **42 passed, 0 failed**. The three added sequence tests verify the original held-out trial prefix for both strategies (including shot parameters and scoring labels), launch/decision timing and completion, and playback-rate/pause/replay invariance. All original scientific tests remain included.

Executed `pnpm build`: TypeScript and Vite passed. The existing large-JavaScript-chunk warning remains. SHA-256 checks confirmed `physics.ts`, `statistics.ts`, `rebounds.ts`, and `numerics.ts` are unchanged by this addition.

Browser checks: the one-click experiment-and-play action calculated seed 42, then launched consecutive shots; pause stopped the counters; camera and rate changes while paused preserved them; resuming at 2× completed the 10-shot sequence and stopped automatically. Its true ordered prefix contained **0 swishes and 10 misses**, while the full saved best-found validation remained **1,615 / 10,000**. This short-run variation was preserved. Phone-sized 390×844 portrait and 1440×1000 landscape views were visually inspected; sequence counters, baseline limitation, and full-sample confidence interval were readable. These viewport checks are not device-fleet or fixed-FPS benchmarks.


## Compact workspace follow-up

Executed `pnpm test`: **42 passed, 0 failed**, including all numerical, statistical, collision, and sequence tests. Executed the TypeScript/Vite production build successfully; the existing large-bundle warning remains. SHA-256 checks confirm no edits to the four core science modules.

Browser verification exercised the five tool tabs, probability calculation and automatic Results selection, 3D strategy comparison, ordered sequence launch and pause, loading a saved strategy, keyboard End navigation, the separate science page, and both recording formats. The default seed-42 experiment again displayed the unchanged 8.2% / 16.2% rounded validation estimates. Switching tool tabs preserved the paused sequence counters. A recording-frame width regression introduced by the wrapper was found and fixed; the restored frames were checked visually and by their dimensions.

At 390×844 and 1366×768, the normal document's measured scroll width and height matched the viewport, with court, playback bar, and tools contained on screen. Longer tool content scrolls inside its panel. Main probabilities are placed before detailed explanations. Mobile controls use the same data and state as desktop. These are browser viewport checks, not physical-device or frame-rate benchmarks.

## Guided editorial redesign

Executed all **43 automated tests**, including strict rendering of every displayed TeX equation into HTML and semantic MathML. The TypeScript/Vite production build passed, including the separate on-demand science/KaTeX chunk and local math fonts. The existing main-bundle size warning remains. Checksums confirm every existing file in `src/science/` is unchanged.

Browser checks exercised the three-step guide from a fresh page, the default seed-42 experiment (unchanged rounded 8.2% and 16.2% held-out clean-shot estimates), 3D comparison, ordered replay launch/pause, advanced-tool access, and the chapter reader. Desktop 1440×1000 and phone-sized 390×844 layouts were checked. The mobile normal page measured exactly 390×844 with no page overflow. All three error sliders fit together. Minimum-speed equations rendered with zero KaTeX error nodes and no horizontal overflow outside their formula containers. These are viewport checks, not a physical-device fleet or FPS benchmark.

The theme changes scene background/border materials only. It retains regulation geometry, actual sampled paths, separate rebound and swish-only models, and all numerical definitions. A few long optional control/readout panels still scroll internally on small screens. The science reader is a reading page and can scroll vertically. Body-font fallback and hardware-dependent WebGL performance remain possible; no fixed rendering-rate guarantee is made.
