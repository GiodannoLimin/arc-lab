import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Orbit,
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleHelp,
  Expand,
  FlaskConical,
  Focus,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Target,
  X,
} from "lucide-react";
import Court from "./components/Court";
import ProbabilityChart from "./components/ProbabilityChart";
import {
  at,
  cleanShot,
  COURTS,
  G,
  integrate,
  minimumSpeed,
  requiredSpeed,
  WIRE,
  type League,
  type Shot,
} from "./science/physics";
import { PlaybackClock } from "./visualization/view";
import {
  buildSequence,
  type SequenceFrame,
  type SequenceStrategy,
} from "./visualization/sequence";
import { simulateRebounds } from "./science/rebounds";
import {
  releaseSpin,
  surfaceSpinSpeed,
  canTargetForward,
  MAX_LAUNCH_SPEED,
} from "./science/spin";
import type { Errors, Result } from "./science/statistics";
const ScienceGuide = lazy(() => import("./components/ScienceGuide"));
const initialShot: Shot = {
  angle: 52,
  speed: requiredSpeed(6.75, 2, 52),
  height: 2,
  distance: 6.75,
  bearing: 0,
  aim: 0,
};
const percent = (v: number) => (100 * v).toFixed(1) + "%";
const workspaceTools = ["Shot", "Sequence", "Errors", "Results", "View"];
function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  hint,
  numeric = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  hint?: string;
  numeric?: boolean;
}) {
  return (
    <div className="slider-control" role="group" aria-label={label}>
      <span>
        <span>{label}</span>
        <output>
          {value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)}
          <small>{unit}</small>
        </output>
      </span>
      {numeric && (
        <span className="precise-value">
          <input
            type="number"
            aria-label={label + " exact value"}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              if (e.target.value === "") return;
              const v = e.target.valueAsNumber;
              if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
            }}
          />
          <small>{unit}</small>
        </span>
      )}
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
      <span className="range-labels">
        <span>
          {min}
          {unit}
        </span>
        <span>{hint ?? `${max}${unit}`}</span>
      </span>
    </div>
  );
}
export default function App() {
  const [shot, setShot] = useState(initialShot),
    [league, setLeague] = useState<League>("FIBA"),
    [tab, setTab] = useState("Simulator"),
    [camera, setCamera] = useState("Shot view"),
    [playing, setPlaying] = useState(false),
    [playId, setPlayId] = useState(0),
    [rate, setRate] = useState(0.5),
    [trails, setTrails] = useState(false),
    [format, setFormat] = useState("off"),
    [help, setHelp] = useState(false),
    [controlTab, setControlTab] = useState("Release"),
    [panel, setPanel] = useState("Shot"),
    [guided, setGuided] = useState(true),
    [guideStep, setGuideStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({
      angle: 1.5,
      speed: 0.12,
      aim: 0.6,
      correlation: 0,
    }),
    [samples, setSamples] = useState(10000),
    [seed, setSeed] = useState(42),
    [result, setResult] = useState<Result | null>(null),
    [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState(""),
    [fired, setFired] = useState(0);
  const [backspin, setBackspin] = useState(0),
    [spinAzimuth, setSpinAzimuth] = useState(0),
    [spinTilt, setSpinTilt] = useState(0),
    [reference, setReference] = useState(false);
  const angularVelocity = useMemo(
    () => releaseSpin(backspin, shot.bearing, spinAzimuth, spinTilt),
    [backspin, shot.bearing, spinAzimuth, spinTilt],
  );
  const physical = useMemo(
    () => simulateRebounds(shot, league, { angularVelocity }),
    [shot, league, angularVelocity],
  );
  const [visibleCount, setVisibleCount] = useState(4),
    [highlight, setHighlight] = useState(0),
    [animateSubset, setAnimateSubset] = useState(false),
    [showPaths, setShowPaths] = useState(true),
    [annotations, setAnnotations] = useState(false),
    [animatedTrail, setAnimatedTrail] = useState(true),
    [fullPath, setFullPath] = useState(false),
    [compareEnabled, setCompareEnabled] = useState(false);
  const clock = useMemo(() => new PlaybackClock(), []);
  const [sequenceMode, setSequenceMode] = useState(false),
    [sequenceStrategy, setSequenceStrategy] =
      useState<SequenceStrategy>("best"),
    [sequenceCount, setSequenceCount] = useState(25),
    [sequenceGap, setSequenceGap] = useState(0.35),
    [reboundReplay, setReboundReplay] = useState(true),
    [sequenceStatus, setSequenceStatus] = useState<SequenceFrame | null>(null);
  const pendingSequence = useRef(false);
  const replayAngularVelocity = useMemo(
    () =>
      releaseSpin(
        backspin,
        result?.config.shot.bearing ?? shot.bearing,
        spinAzimuth,
        spinTilt,
      ),
    [backspin, result, shot.bearing, spinAzimuth, spinTilt],
  );
  const sequence = useMemo(
    () =>
      sequenceMode && result
        ? buildSequence(result, sequenceStrategy, sequenceCount, sequenceGap, {
            rebounds: reboundReplay,
            settings: { angularVelocity: replayAngularVelocity },
          })
        : null,
    [
      sequenceMode,
      result,
      sequenceStrategy,
      sequenceCount,
      sequenceGap,
      reboundReplay,
      replayAngularVelocity,
    ],
  );
  const compare = compareEnabled && result !== null && !sequenceMode;
  const baselineShot = useMemo(
    () =>
      result
        ? {
            ...result.config.shot,
            angle: result.baseline.angle,
            speed: result.baseline.speed,
            aim: result.baseline.aim,
          }
        : shot,
    [result, shot],
  );
  const bestShot = useMemo(
    () =>
      result
        ? {
            ...result.config.shot,
            angle: result.best.angle,
            speed: result.best.speed,
            aim: result.best.aim,
          }
        : shot,
    [result, shot],
  );
  const baselineSim = useMemo(
    () =>
      compare
        ? simulateRebounds(baselineShot, result!.config.league)
        : physical,
    [compare, baselineShot, result, physical],
  );
  const bestSim = useMemo(
    () =>
      compare ? simulateRebounds(bestShot, result!.config.league) : physical,
    [compare, bestShot, result, physical],
  );
  const viewShot = sequence ? sequence.intended : compare ? baselineShot : shot,
    viewSim = compare ? baselineSim : physical,
    viewLeague = sequence
      ? sequence.league
      : compare
        ? result!.config.league
        : league;
  const duration = sequence
    ? sequence.duration
    : compare
      ? Math.max(baselineSim.final.time, bestSim.final.time)
      : animateSubset && trails
        ? Math.max(40, physical.final.time)
        : physical.final.time;
  useEffect(() => {
    clock.reset(performance.now());
  }, [clock, playId, physical]);
  useEffect(() => {
    clock.reset(performance.now());
    setSequenceStatus(null);
  }, [clock, sequence, playId]);
  useEffect(() => {
    setSequenceMode(false);
    setCompareEnabled(false);
  }, [shot, league]);
  useEffect(() => {
    clock.setRunning(playing, performance.now());
  }, [clock, playing]);
  useEffect(() => {
    clock.setRate(rate, performance.now());
  }, [clock, rate]);
  const estimateFor = (candidate: Shot) => {
    if (
      !result ||
      result.config.league !== viewLeague ||
      ["distance", "height", "bearing"].some(
        (k) =>
          Math.abs(
            candidate[k as keyof Shot] - result.config.shot[k as keyof Shot],
          ) > 1e-8,
      )
    )
      return null;
    return (
      [result.baseline, result.best].find(
        (c) =>
          Math.abs(c.angle - candidate.angle) < 1e-8 &&
          Math.abs(c.speed - candidate.speed) < 1e-8 &&
          Math.abs(c.aim - candidate.aim) < 1e-8,
      ) ?? null
    );
  };
  const viewEstimate = sequence
    ? result![sequenceStrategy]
    : compare
      ? result!.baseline
      : estimateFor(viewShot);
  const replay = () => {
    setPlayId((i) => i + 1);
    setPlaying(true);
    setFired((i) => i + 1);
  };
  const playPause = () => {
    if (playing) setPlaying(false);
    else {
      if (fired === 0 || clock.time(performance.now()) >= duration) {
        setPlayId((i) => i + 1);
        setFired((i) => i + 1);
      }
      setPlaying(true);
    }
  };
  const startSequence = () => {
    setPanel("Sequence");
    setGuideStep(2);
    if (!result) {
      pendingSequence.current = true;
      run();
    } else {
      setCompareEnabled(false);
      setSequenceMode(true);
      replay();
    }
  };
  const visualProps = {
    camera,
    playing,
    playId,
    clock,
    duration,
    visibleCount,
    highlight,
    animateSubset,
    showPaths,
    annotations,
    animatedTrail,
    fullPath,
    reference,
    trails,
    sequence,
  };
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const ideal = minimumSpeed(
      shot.distance,
      shot.height,
      COURTS[league].height - WIRE,
    ),
    integration = integrate(shot, 1),
    exact = at(shot, 1),
    validationError = Math.hypot(
      integration.x - exact.x,
      integration.y - exact.y,
      integration.z - exact.z,
    );
  const targetSpeed = canTargetForward(shot.angle)
    ? requiredSpeed(
        shot.distance,
        shot.height,
        shot.angle,
        COURTS[league].height - WIRE,
      )
    : NaN;
  const canAim =
    Number.isFinite(targetSpeed) && targetSpeed <= MAX_LAUNCH_SPEED;
  const shownIdeal = result ? result.baseline : ideal;
  const stale =
    result &&
    (result.config.league !== league ||
      result.config.samples !== samples ||
      result.config.seed !== seed ||
      JSON.stringify(result.config.errors) !== JSON.stringify(errors) ||
      ["distance", "height", "bearing"].some(
        (key) =>
          result.config.shot[key as keyof Shot] !== shot[key as keyof Shot],
      ));
  const change = (key: keyof Shot, value: number) => {
    setPlaying(false);
    setShot((s) => ({ ...s, [key]: value }));
  };
  function run() {
    worker.current?.terminate();
    setPlaying(false);
    setError("");
    setProgress(0);
    const w = new Worker(
      new URL("./science/experiment.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data.type === "progress") setProgress(e.data.done / e.data.total);
      if (e.data.type === "result") {
        setResult(e.data.result);
        setProgress(null);
        setTrails(false);
        if (!pendingSequence.current) setPanel("Results");
        setGuideStep(2);
        if (pendingSequence.current) {
          pendingSequence.current = false;
          setCompareEnabled(false);
          setSequenceMode(true);
          replay();
        }
        w.terminate();
      }
      if (e.data.type === "error") {
        pendingSequence.current = false;
        setError(e.data.message);
        setProgress(null);
        w.terminate();
      }
    };
    w.onerror = (e) => {
      pendingSequence.current = false;
      setError(e.message);
      setProgress(null);
      w.terminate();
    };
    w.postMessage({ shot, league, errors, samples, seed });
  }
  function exportData() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `arc-lab-seed-${result.config.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function setPosition(bearing: number) {
    const c = COURTS[league];
    setShot((s) => ({
      ...s,
      bearing,
      distance:
        Math.abs(bearing) > 70
          ? c.corner / Math.abs(Math.sin((bearing * Math.PI) / 180)) + 0.1
          : c.arc + 0.1,
    }));
    setPlaying(false);
  }
  const shotPanel = (
    <aside className="control-panel">
      <div className="panel-heading">
        <h2>
          <SlidersHorizontal size={17} />
          Shot setup
        </h2>
        <button
          aria-label="Reset shot"
          onClick={() => {
            setShot(initialShot);
            setBackspin(0);
            setLeague("FIBA");
            setPlaying(false);
          }}
        >
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="segmented">
        {["Release", "Position"].map((t) => (
          <button
            className={controlTab === t ? "active" : ""}
            onClick={() => setControlTab(t)}
            key={t}
          >
            {t}
          </button>
        ))}
      </div>
      {controlTab === "Release" ? (
        <>
          <Slider
            label="Launch angle"
            value={shot.angle}
            min={0}
            max={360}
            numeric
            step={0.1}
            unit="°"
            onChange={(v) => change("angle", v)}
          />
          <Slider
            label="Initial speed"
            value={shot.speed}
            min={0}
            max={MAX_LAUNCH_SPEED}
            numeric
            step={0.01}
            unit=" m/s"
            onChange={(v) => change("speed", v)}
          />
          <Slider
            label="Release height"
            value={shot.height}
            min={1}
            max={2.8}
            step={0.01}
            unit=" m"
            onChange={(v) => change("height", v)}
          />
          <Slider
            label="Horizontal aim"
            value={shot.aim}
            min={-5}
            max={5}
            step={0.1}
            unit="°"
            onChange={(v) => change("aim", v)}
          />
        </>
      ) : (
        <>
          <label className="select-label">
            Court standard
            <select
              value={league}
              onChange={(e) => {
                const l = e.target.value as League;
                setLeague(l);
                change("distance", COURTS[l].arc);
              }}
            >
              <option>FIBA</option>
              <option>NBA</option>
            </select>
          </label>
          <div className="positions">
            {[
              ["Left corner", -90],
              ["Left wing", -45],
              ["Top", 0],
              ["Right wing", 45],
              ["Right corner", 90],
            ].map(([label, b]) => (
              <button key={label} onClick={() => setPosition(+b)}>
                {label}
              </button>
            ))}
          </div>
          <Slider
            label="Distance from hoop"
            value={shot.distance}
            min={3}
            max={10}
            step={0.01}
            unit=" m"
            onChange={(v) => change("distance", v)}
          />
          <Slider
            label="Position bearing"
            value={shot.bearing}
            min={-90}
            max={90}
            step={1}
            unit="°"
            onChange={(v) => change("bearing", v)}
          />
        </>
      )}
      <button
        className="match-button"
        disabled={!canAim}
        title={
          !canAim
            ? "This direction cannot target the hoop within the 0–40 m/s range."
            : undefined
        }
        onClick={() => {
          setShot((s) => ({
            ...s,
            speed: targetSpeed,
            aim: 0,
          }));
          setPlaying(false);
        }}
      >
        <Target size={15} /> Aim trajectory at hoop center{" "}
        <ArrowRight size={14} />
      </button>
      <p className="angle-convention">
        0° / 360° = horizontal toward the hoop · 90° = up · 180° = backward ·
        270° = down. Extended controls are a physics sandbox; the probability
        search remains 38–68°.
      </p>
      <div className="rebound-presets">
        <span>TRY A REBOUND</span>
        {[
          ["Rim-assisted", 35, 9.5],
          ["Backboard-assisted", 35, 9.6],
        ].map(([name, a, v]) => (
          <button
            key={name}
            onClick={() => {
              setShot({ ...initialShot, angle: Number(a), speed: Number(v) });
              setLeague("FIBA");
              setBackspin(0);
              setPlaying(false);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <details className="collision-settings">
        <summary>Spin & collision physics</summary>
        <Slider
          label="Spin speed"
          value={backspin}
          min={0}
          max={20}
          numeric
          step={0.1}
          unit=" rev/s"
          onChange={(v) => {
            setBackspin(v);
            setPlaying(false);
          }}
        />
        <label className="select-label">
          Spin axis
          <select
            aria-label="Spin axis preset"
            value={
              spinTilt === 90
                ? "side"
                : spinTilt === 0 && spinAzimuth === 0
                  ? "back"
                  : spinTilt === 0 && spinAzimuth === 180
                    ? "top"
                    : "custom"
            }
            onChange={(e) => {
              setPlaying(false);
              if (e.target.value === "back") {
                setSpinAzimuth(0);
                setSpinTilt(0);
              } else if (e.target.value === "top") {
                setSpinAzimuth(180);
                setSpinTilt(0);
              } else if (e.target.value === "side") {
                setSpinTilt(90);
              } else {
                setSpinAzimuth(45);
                setSpinTilt(30);
              }
            }}
          >
            <option value="back">Backspin</option>
            <option value="top">Topspin</option>
            <option value="side">Sidespin (vertical axis)</option>
            <option value="custom">Custom axis</option>
          </select>
        </label>
        <Slider
          label="Spin axis azimuth"
          value={spinAzimuth}
          min={-180}
          max={180}
          step={1}
          unit="°"
          onChange={(v) => {
            setSpinAzimuth(v);
            setPlaying(false);
          }}
        />
        <Slider
          label="Spin axis tilt"
          value={spinTilt}
          min={-90}
          max={90}
          step={1}
          unit="°"
          onChange={(v) => {
            setSpinTilt(v);
            setPlaying(false);
          }}
        />
        <div className="spin-readout">
          Angular speed: {(backspin * 2 * Math.PI).toFixed(2)} rad/s
          <br />
          Equatorial surface speed: {surfaceSpinSpeed(backspin).toFixed(2)} m/s
        </div>
        <p>
          Spin rotates the ball about an axis through its center. Surface speed
          = angular speed × radius. It changes frictional rebounds, but adds no
          launch velocity and no aerodynamic curve in this gravity-only model.
        </p>
        <p>
          Restitution: rim 0.65 · board 0.75 · floor 0.82. Friction: 0.35 / 0.30
          / 0.60. Unmeasured rigid-body assumptions; not experimentally
          validated.
        </p>
        <a
          href="https://www.cs.cmu.edu/~baraff/sigcourse/"
          target="_blank"
          rel="noreferrer"
        >
          Impulse model background
        </a>
      </details>
      <div className="toggles">
        <label>
          <input
            type="checkbox"
            checked={reference}
            onChange={(e) => setReference(e.target.checked)}
          />
          Analytical reference <span>Gravity only</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={trails}
            onChange={(e) => setTrails(e.target.checked)}
          />
          Experiment trajectories{" "}
          <span>{result ? result.previews.length : "Run first"}</span>
        </label>
      </div>
    </aside>
  );
  const sequencePanel = (
    <section
      className="sequence-controls"
      aria-label="Consecutive shot animation"
    >
      <div>
        <span className="eyebrow">CONSECUTIVE SHOTS</span>
        <h2>Consecutive shots</h2>
        <p>
          Original seeded trial order. Rebound replay keeps up to four moving
          balls.
        </p>
      </div>
      <label className="replay-model">
        Replay physics
        <select
          aria-label="Replay physics"
          value={reboundReplay ? "rebounds" : "baseline"}
          onChange={(e) => {
            setReboundReplay(e.target.value === "rebounds");
            setPlaying(false);
          }}
        >
          <option value="rebounds">Physical rebounds (up to 4 balls)</option>
          <option value="baseline">Original clean-shot baseline</option>
        </select>
      </label>
      <div className="sequence-options">
        <label>
          Strategy
          <select
            aria-label="Sequence strategy"
            value={sequenceStrategy}
            onChange={(e) => {
              setSequenceStrategy(e.target.value as SequenceStrategy);
              setPlaying(false);
            }}
          >
            <option value="best">Best found</option>
            <option value="baseline">Minimum speed</option>
          </select>
        </label>
        <label>
          Shots
          <select
            aria-label="Sequence shot count"
            value={sequenceCount}
            onChange={(e) => {
              setSequenceCount(+e.target.value);
              setPlaying(false);
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Pause between shots
          <select
            aria-label="Gap between shots"
            value={sequenceGap}
            onChange={(e) => {
              setSequenceGap(+e.target.value);
              setPlaying(false);
            }}
          >
            <option value={0.15}>Quick · 0.15 s</option>
            <option value={0.35}>Normal · 0.35 s</option>
            <option value={1}>Relaxed · 1 s</option>
          </select>
        </label>
        <button
          className="shoot-button"
          disabled={progress !== null}
          onClick={startSequence}
        >
          <Play size={15} />
          {progress !== null
            ? "Calculating…"
            : !result
              ? "Run experiment & play sequence"
              : sequence
                ? "Replay sequence"
                : "Play shot sequence"}
        </button>
        {sequence && (
          <>
            <button className="outline-button" onClick={playPause}>
              {playing ? "Pause sequence" : "Continue sequence"}
            </button>
            <button
              className="outline-button"
              onClick={() => {
                setSequenceMode(false);
                setPlaying(false);
              }}
            >
              Return to single shot
            </button>
          </>
        )}
      </div>
      <p className="sequence-explanation">
        Uses the first {sequenceCount} held-out trials for the saved strategy,
        without selecting outcomes. The small replay’s running rate can differ
        from the full experiment estimate. Physical replay includes rebounds and
        uses the current spin setting. Its basket counters are separate from the
        full experiment’s unchanged swish-only probability. The original
        baseline replay stops at first contact.
      </p>
    </section>
  );
  const viewPanel = (
    <section className="visual-settings">
      <div>
        <span className="eyebrow">VISUAL DIRECTION</span>
        <h2>Scene settings</h2>
        <p>
          Blue solid = scores · orange dashed examples = misses · gold dotted =
          analytical reference.
        </p>
      </div>
      <div className="visual-options">
        <label>
          <input
            type="checkbox"
            checked={showPaths}
            onChange={(e) => setShowPaths(e.target.checked)}
          />
          Shot paths
        </label>
        <label>
          <input
            type="checkbox"
            checked={annotations}
            onChange={(e) => setAnnotations(e.target.checked)}
          />
          Scientific annotations
        </label>
        <label>
          <input
            type="checkbox"
            checked={animatedTrail}
            onChange={(e) => setAnimatedTrail(e.target.checked)}
          />
          Moving ball trail
        </label>
        <label>
          <input
            type="checkbox"
            checked={fullPath}
            onChange={(e) => setFullPath(e.target.checked)}
          />
          Full rebound path
        </label>
        <label>
          <input
            type="checkbox"
            checked={compareEnabled}
            disabled={!result}
            onChange={(e) => {
              setSequenceMode(false);
              setPlaying(false);
              setCompareEnabled(e.target.checked);
            }}
          />
          Compare strategies {result ? "" : "(run experiment first)"}
        </label>
        <label>
          <input
            type="checkbox"
            checked={animateSubset}
            disabled={!result}
            onChange={(e) => {
              if (e.target.checked) setSequenceMode(false);
              setAnimateSubset(e.target.checked);
              if (e.target.checked) setTrails(true);
            }}
          />
          Animate examples with rebounds (max 4)
        </label>
        <label>
          Example path limit
          <select
            aria-label="Visible trajectories"
            value={visibleCount}
            onChange={(e) => setVisibleCount(+e.target.value)}
          >
            {[1, 2, 4, 8, 12, 24].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Highlight example
          <select
            aria-label="Highlighted trajectory"
            value={highlight}
            onChange={(e) => setHighlight(+e.target.value)}
          >
            {Array.from(
              {
                length: Math.min(visibleCount, result?.previews.length ?? 0),
              },
              (_, i) => (
                <option key={i} value={i}>
                  #{i + 1} ·{" "}
                  {cleanShot(result!.previews[i], result!.config.league)
                    ? "Swish"
                    : "Miss"}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      {result && (
        <div className="subset-counts">
          <strong>Selected saved examples</strong>
          <span>{Math.min(visibleCount, result.previews.length)} paths</span>
          <span>
            {
              result.previews
                .slice(0, visibleCount)
                .filter((s) => cleanShot(s, result.config.league)).length
            }{" "}
            swishes
          </span>
          <span>
            {
              result.previews
                .slice(0, visibleCount)
                .filter((s) => !cleanShot(s, result.config.league)).length
            }{" "}
            misses
          </span>
        </div>
      )}
      {result && (
        <p className="subset-note">
          Saved best-found validation: {result.best.hits.toLocaleString()}{" "}
          swishes / {result.best.n.toLocaleString()} shots (
          {percent(result.best.p)}). Examples are a deliberately selected
          subset, not frequency-weighted. Reference paths show swish-only
          outcomes. Animated examples continue through the separate rebound
          model; their rebounds do not change these probabilities.
        </p>
      )}
    </section>
  );
  const experimentPanel = (
    <section className="experiment-panel" id="experiment-controls">
      <div className="experiment-header">
        <div>
          <div className="card-kicker">ILLUSTRATIVE RELEASE ERRORS</div>
          <h2>Release errors</h2>
          <p>
            Normal release errors · illustrative assumptions, not measured
            player data.
          </p>
        </div>
        <div className="seed-controls">
          <label>
            SHOTS / CANDIDATE
            <select
              value={samples}
              onChange={(e) => setSamples(+e.target.value)}
            >
              <option value={10000}>10,000</option>
              <option value={25000}>25,000</option>
              <option value={50000}>50,000</option>
              <option value={100000}>100,000</option>
            </select>
          </label>
          <label>
            RANDOM SEED
            <input
              type="number"
              min={0}
              max={4294967295}
              value={seed}
              onChange={(e) =>
                setSeed(
                  Math.max(
                    0,
                    Math.min(4294967295, Math.trunc(+e.target.value)),
                  ),
                )
              }
            />
          </label>
        </div>
      </div>
      <div className="error-controls">
        <Slider
          label="Angle error σ"
          value={errors.angle}
          min={0}
          max={5}
          step={0.1}
          unit="°"
          onChange={(v) => setErrors((e) => ({ ...e, angle: v }))}
        />
        <Slider
          label="Speed error σ"
          value={errors.speed}
          min={0}
          max={0.5}
          step={0.01}
          unit=" m/s"
          onChange={(v) => setErrors((e) => ({ ...e, speed: v }))}
        />
        <Slider
          label="Direction error σ"
          value={errors.aim}
          min={0}
          max={3}
          step={0.1}
          unit="°"
          onChange={(v) => setErrors((e) => ({ ...e, aim: v }))}
        />
        <Slider
          label="Angle–speed correlation ρ"
          value={errors.correlation}
          min={-0.9}
          max={0.9}
          step={0.05}
          unit=""
          onChange={(v) => setErrors((e) => ({ ...e, correlation: v }))}
        />
      </div>
    </section>
  );
  const resultsPanel = (
    <>
      {/* Saved results, unchanged numerical values. */}
      <section className="research-grid">
        <article className="research-card comparison">
          <div className="card-kicker">01 / THE RESEARCH QUESTION</div>
          <h2>Compare the strategies</h2>
          <p className="baseline-label">
            CLEAN-SHOT PROBABILITIES · excludes rebound baskets
          </p>
          <p>
            Compare minimum launch speed with the best strategy found under
            release uncertainty.
          </p>
          <div className="strategy-grid">
            <div>
              <span className="strategy-label">
                <span className="dot tan" />
                MINIMUM SPEED
              </span>
              <div className="big-value">
                {shownIdeal.angle.toFixed(1)}
                <small>°</small>
              </div>
              <div className="strategy-speed">
                {shownIdeal.speed.toFixed(2)} m/s · 0.0° aim
              </div>
              <div className="strategy-prob">
                {result ? percent(result.baseline.p) : "—"}{" "}
                <span>clean-shot probability</span>
              </div>
              {result && (
                <small className="ci">
                  95% CI {percent(result.baseline.lo)}–
                  {percent(result.baseline.hi)}
                </small>
              )}
              <button
                onClick={() => {
                  setShot({
                    ...(result?.config.shot ?? shot),
                    angle: shownIdeal.angle,
                    speed: shownIdeal.speed,
                    aim: 0,
                  });
                  if (result) setLeague(result.config.league);
                  setPlaying(false);
                }}
              >
                Try this shot <ArrowRight size={13} />
              </button>
            </div>
            <div>
              <span className="strategy-label">
                <span className="dot green" />
                BEST FOUND IN SEARCH
              </span>
              <div className="big-value">
                {result ? result.best.angle.toFixed(1) : "—"}
                <small>{result ? "°" : ""}</small>
              </div>
              <div className="strategy-speed">
                {result
                  ? `${result.best.speed.toFixed(2)} m/s · ${result.best.aim.toFixed(2)}° aim`
                  : "Run an experiment"}
              </div>
              <div className="strategy-prob">
                {result ? percent(result.best.p) : "—"}{" "}
                <span>clean-shot probability</span>
              </div>
              {result && (
                <small className="ci">
                  95% CI {percent(result.best.lo)}–{percent(result.best.hi)}
                </small>
              )}
              <button
                disabled={!result}
                onClick={() => {
                  if (result) {
                    setShot({
                      ...result.config.shot,
                      angle: result.best.angle,
                      speed: result.best.speed,
                      aim: result.best.aim,
                    });
                    setLeague(result.config.league);
                    setPlaying(false);
                  }
                }}
              >
                Try this shot <ArrowRight size={13} />
              </button>
            </div>
          </div>
          <details className="result-detail">
            <summary>Why can the strategies differ?</summary>
            <p className="mechanism-note">
              Faint swish-only baseline paths end at first contact and use up to
              12 successes (blue) and 12 misses (orange); their balance does not
              represent probability. A steeper entry can increase ball
              clearance, while changing speed and flight time changes
              sensitivity to release errors. The experiment measures their
              combined effect.
            </p>
          </details>
          <details className="result-detail">
            <summary>How do the results compare?</summary>
            <div className="finding">
              <FlaskConical size={16} />
              <p>
                {result
                  ? result.difference.lo > 0
                    ? `The selected strategy improved clean-shot probability by ${(100 * result.difference.value).toFixed(1)} percentage points on independent validation.`
                    : result.difference.hi < 0
                      ? "The selected strategy performed worse on validation. Selection noise can change which candidate appears best."
                      : "This experiment does not resolve a probability difference at the approximate 95% paired interval."
                  : "Let the experiment decide. The two solutions may coincide or differ."}
                {result && (
                  <span>
                    {" "}
                    Paired difference interval:{" "}
                    {(100 * result.difference.lo).toFixed(1)} to{" "}
                    {(100 * result.difference.hi).toFixed(1)} pp.
                  </span>
                )}
              </p>
            </div>
          </details>
          {stale && (
            <p className="stale-note">
              Controls changed. Probability results retain the saved
              experiment’s settings; rerun to update.
            </p>
          )}
        </article>
        <article className="research-card graph-card">
          <div className="card-kicker">02 / EXPLORE THE TRADE-OFF</div>
          <div className="card-title-row">
            <h2>Probability vs. angle</h2>
            <span className="mini-tag">MONTE CARLO</span>
          </div>
          <div className="chart-legend">
            <span>
              <span className="dot green" />
              Scoring probability
            </span>
            <span>
              <span className="dot pale" />
              95% pointwise CI
            </span>
            <span>
              <span className="dot tan" />
              Min. speed angle
            </span>
          </div>
          <ProbabilityChart
            compact
            data={result?.profile ?? []}
            baseline={
              result
                ? minimumSpeed(
                    result.config.shot.distance,
                    result.config.shot.height,
                    COURTS[result.config.league].height - WIRE,
                  ).angle
                : ideal.angle
            }
          />
          <p className="chart-footnote">
            {result
              ? `Exploratory search · ${result.config.samples.toLocaleString()} shots per candidate · speed and aim tuned at each angle. Search intervals are descriptive, not adjusted for selection.`
              : "No outcomes are prefilled. Run an experiment to generate the probability curve."}
          </p>
        </article>
      </section>
      <details className="result-detail">
        <summary>Sensitivity analysis</summary>
        {result && (
          <div className="sensitivity">
            <h3>How sensitive is this comparison to release error?</h3>
            <p>
              Both strategies stay fixed while all standard deviations scale
              together. These are model scenarios, not player skill levels.
            </p>
            <div className="sensitivity-grid">
              {result.sensitivity.map((s) => (
                <div key={s.scale}>
                  <span>{s.scale}× release error</span>
                  <strong>{percent(s.best.p)}</strong>
                  <small>
                    Best found · CI {percent(s.best.lo)}–{percent(s.best.hi)}
                  </small>
                  <span>Minimum speed: {percent(s.baseline.p)}</span>
                  <small>
                    CI {percent(s.baseline.lo)}–{percent(s.baseline.hi)}
                  </small>
                </div>
              ))}
            </div>
          </div>
        )}
      </details>
    </>
  );
  const guidedPanel = (
    <div className="guide-card">
      <div className="guide-step">EXPERIMENT / 0{guideStep + 1}</div>
      {guideStep === 0 && (
        <>
          <h2>
            Start with
            <br /> <em>a single shot.</em>
          </h2>
          <p>
            Press play. Watch how angle and speed shape the flight. No shooting
            errors yet.
          </p>
          <button
            className="watch-shot"
            onClick={() => {
              if (sequence || compare) {
                setSequenceMode(false);
                setCompareEnabled(false);
                replay();
              } else playPause();
            }}
          >
            <Play size={16} fill="currentColor" />
            {playing ? "Pause the shot" : "Watch this shot"}
            <span>{rate}× playback</span>
          </button>
          <div className="guide-sliders">
            <Slider
              label="Launch angle"
              value={shot.angle}
              min={0}
              max={360}
              numeric
              step={0.1}
              unit="°"
              onChange={(v) => change("angle", v)}
            />
            <Slider
              label="Launch speed"
              value={shot.speed}
              min={0}
              max={MAX_LAUNCH_SPEED}
              numeric
              step={0.01}
              unit=" m/s"
              onChange={(v) => change("speed", v)}
            />
          </div>
          <div className="guide-tip">
            <span>TRY THIS</span>
            <p>
              Change the angle, then let the model calculate a speed aimed at
              the hoop center.
            </p>
            <button
              onClick={() => {
                change("speed", targetSpeed);
                setShot((s) => ({ ...s, aim: 0 }));
              }}
              disabled={!canAim}
            >
              Aim at the hoop <ArrowRight size={13} />
            </button>
          </div>
        </>
      )}
      {guideStep === 1 && (
        <>
          <h2>
            Real releases
            <br /> <em>aren’t identical.</em>
          </h2>
          <p>
            Add variation to angle, speed, and aim. The experiment tests which
            intended shot is most reliable under these assumptions.
          </p>
          <div className="assumption-tag">
            ILLUSTRATIVE ERRORS / NOT PLAYER DATA
          </div>
          <div className="guide-error-sliders">
            <Slider
              label="Angle error"
              value={errors.angle}
              min={0}
              max={5}
              step={0.1}
              unit="°"
              onChange={(v) => setErrors((e) => ({ ...e, angle: v }))}
            />
            <Slider
              label="Speed error"
              value={errors.speed}
              min={0}
              max={0.5}
              step={0.01}
              unit=" m/s"
              onChange={(v) => setErrors((e) => ({ ...e, speed: v }))}
            />
            <Slider
              label="Aiming error"
              value={errors.aim}
              min={0}
              max={3}
              step={0.1}
              unit="°"
              onChange={(v) => setErrors((e) => ({ ...e, aim: v }))}
            />
          </div>
          <p className="guide-micro">
            Each value is a standard deviation: a larger value means a less
            consistent release. Defaults use normal distributions.
          </p>
          <button
            className="text-link"
            onClick={() => {
              setGuided(false);
              setPanel("Errors");
            }}
          >
            Seed, sample size & correlation <ArrowRight size={12} />
          </button>
        </>
      )}
      {guideStep === 2 && !result && (
        <>
          <h2>
            Let the
            <br /> <em>experiment decide.</em>
          </h2>
          <p>
            Run the experiment to compare the minimum-speed shot with the best
            strategy found under the configured errors.
          </p>
          <div className="experiment-recipe">
            <span>01</span>
            <p>Find the analytical minimum speed.</p>
            <span>02</span>
            <p>Search candidate angles, speeds, and aims.</p>
            <span>03</span>
            <p>
              Validate with {samples.toLocaleString()} fresh shots per strategy.
            </p>
          </div>
          <p className="guide-micro">
            Nothing is prefilled. Every probability is calculated from simulated
            shots.
          </p>
        </>
      )}
      {guideStep === 2 && result && (
        <>
          <h2>
            The result.
            <br /> <em>With room for doubt.</em>
          </h2>
          <p className="guide-result-caption">
            Clean-shot probability · {result.config.samples.toLocaleString()}{" "}
            held-out trials per strategy.
          </p>
          <div className="guide-results">
            {[
              { label: "MINIMUM SPEED", c: result.baseline },
              { label: "BEST FOUND", c: result.best },
            ].map(({ label, c }) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{percent(c.p)}</strong>
                <small>
                  {c.angle.toFixed(1)}° · {c.speed.toFixed(2)} m/s
                </small>
                <small>
                  95% CI {percent(c.lo)}–{percent(c.hi)}
                </small>
              </div>
            ))}
          </div>
          <div className="guide-finding">
            <span>WHAT THE DATA SAYS</span>
            <p>
              {result.difference.lo > 0
                ? `The best-found strategy scored ${(100 * result.difference.value).toFixed(1)} percentage points more often in held-out validation.`
                : result.difference.hi < 0
                  ? "The selected strategy did worse in validation. Search noise can change which candidate appears best."
                  : "This experiment does not resolve a clear probability difference at the approximate 95% paired interval."}
            </p>
          </div>
          <button
            className="compare-action"
            onClick={() => {
              setSequenceMode(false);
              setCompareEnabled(!compareEnabled);
              setPlaying(false);
            }}
          >
            {compare ? "Return to one view" : "Compare the shots in 3D"}
            <ArrowRight size={14} />
          </button>
          <button
            className="text-link"
            onClick={() => {
              setGuided(false);
              setPanel("Results");
            }}
          >
            Probability chart & full analysis <ArrowRight size={12} />
          </button>
          {stale && (
            <p className="stale-note">
              Settings have changed.{" "}
              <button onClick={run}>Rerun the experiment</button> to update
              these saved results.
            </p>
          )}
          <p className="guide-micro">
            Rebound baskets are excluded. These are model estimates, not
            measured player percentages.
          </p>
        </>
      )}
    </div>
  );
  return (
    <div
      className={`app ${tab === "The physics" ? "science-page" : "studio-page"} ${format !== "off" ? `presentation ${format}` : ""} ${compare ? "compare-layout" : ""}`}
    >
      <header>
        <a className="brand" href="#">
          <span className="brand-icon">
            <Orbit size={24} />
          </span>
          arc<span className="brand-light">lab</span>
          <span className="brand-divider" />
          <span className="brand-tag">A STUDY IN POSSIBILITY</span>
        </a>
        <nav aria-label="Main navigation">
          {["Simulator", "The physics"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                setPlaying(false);
              }}
            >
              {t === "Simulator" ? "The experiment" : "The science"}
            </button>
          ))}
        </nav>
        <button
          className="help-button"
          aria-label="How it works"
          onClick={() => setHelp(true)}
        >
          <CircleHelp size={16} />
          <span>How it works</span>
        </button>
      </header>
      <div className="presentation-tools">
        <strong>RECORDING STUDIO</strong>
        <select
          aria-label="Presentation format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="off">Standard layout</option>
          <option value="portrait">9:16 portrait</option>
          <option value="landscape">16:9 landscape</option>
        </select>
        <button onClick={playPause}>{playing ? "Pause" : "Play"}</button>
        <button onClick={replay}>Replay</button>
        <select
          aria-label="Recording playback speed"
          value={rate}
          onChange={(e) => setRate(+e.target.value)}
        >
          {[0.1, 0.25, 0.5, 1, 2].map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
        <select
          aria-label="Recording camera"
          value={camera}
          onChange={(e) => setCamera(e.target.value)}
        >
          {[
            "Shot view",
            "Side",
            "Overhead",
            "Ball follow",
            "Hoop close-up",
            "Full court",
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button onClick={() => setAnnotations((v) => !v)}>
          Labels {annotations ? "on" : "off"}
        </button>
        <button onClick={() => setShowPaths((v) => !v)}>
          Paths {showPaths ? "on" : "off"}
        </button>
        <button
          disabled={!result}
          onClick={() => {
            setSequenceMode(false);
            setPlaying(false);
            setCompareEnabled((v) => !v);
          }}
        >
          Compare
        </button>
        <button disabled={!result} onClick={startSequence}>
          Shot sequence
        </button>
        {sequence && (
          <button
            onClick={() => {
              setSequenceMode(false);
              setPlaying(false);
            }}
          >
            Single shot
          </button>
        )}
        <button onClick={() => setFormat("off")}>Exit</button>
      </div>
      <main>
        <div className="page-title">
          <div>
            <span className="edition-label">
              BASKETBALL / PHYSICS / PROBABILITY
            </span>
            <h1>
              {tab === "The physics" ? (
                <>
                  A little theory. <em>A clearer picture.</em>
                </>
              ) : (
                <>
                  Find the margin <em>for error.</em>
                </>
              )}
            </h1>
            <p>
              {tab === "The physics"
                ? "The equations, the assumptions, and what they can tell us."
                : "Does the minimum-speed shot stay optimal when human error enters?"}
            </p>
          </div>
          <button
            className={"outline-button " + (format !== "off" ? "selected" : "")}
            onClick={() => setFormat(format === "off" ? "portrait" : "off")}
          >
            <Expand size={15} />
            {format !== "off" ? "Exit presentation" : "Presentation mode"}
          </button>
        </div>
        {tab !== "The physics" && (
          <nav className="journey" aria-label="Experiment steps">
            {["Watch a shot", "Add human error", "Compare results"].map(
              (name, i) => (
                <button
                  key={name}
                  aria-current={guideStep === i ? "step" : undefined}
                  onClick={() => {
                    setGuided(true);
                    setGuideStep(i);
                    if (i === 0) {
                      setSequenceMode(false);
                      setCompareEnabled(false);
                      setPlaying(false);
                    }
                  }}
                >
                  <span>
                    {guideStep > i || (i === 2 && result) ? (
                      <Check size={13} />
                    ) : (
                      `0${i + 1}`
                    )}
                  </span>
                  <strong>{name}</strong>
                  <small>
                    {
                      [
                        "Build intuition",
                        "Introduce variation",
                        "Let the data decide",
                      ][i]
                    }
                  </small>
                </button>
              ),
            )}
          </nav>
        )}
        {tab === "The physics" ? (
          <Suspense
            fallback={
              <p className="science-loading" role="status">
                Preparing the field notes…
              </p>
            }
          >
            <ScienceGuide
              shot={shot}
              league={league}
              validationError={validationError}
              onBack={() => setTab("Simulator")}
              onTryIdeal={() => {
                setShot({ ...shot, ...ideal, aim: 0 });
                setPlaying(false);
                setTab("Simulator");
                setGuided(true);
                setGuideStep(0);
              }}
            />
          </Suspense>
        ) : (
          <div className="studio-shell">
            <div className="scene-column">
              <div className="workspace">
                <section className="stage">
                  <div className="stage-top">
                    <div className="stage-tag">
                      <span className="live-dot" />{" "}
                      {sequence ? "SHOT SEQUENCE" : "LIVE SIMULATION"}{" "}
                      {!sequence && <span className="tag-divider">/</span>}
                      {!sequence && (
                        <span>
                          {compare
                            ? "MINIMUM SPEED"
                            : camera === "Full court"
                              ? "FULL COURT"
                              : "SHOT STUDIO"}
                        </span>
                      )}
                    </div>
                    <div className="outcome-badge">
                      {sequence
                        ? sequenceStatus?.done
                          ? "Sequence complete"
                          : sequenceStatus &&
                              (sequence.rebounds
                                ? sequenceStatus.physicalDecided
                                : sequenceStatus.decided)
                            ? sequence.rebounds
                              ? sequence.shots[sequenceStatus.index].physical!
                                  .outcome
                              : sequence.shots[sequenceStatus.index].success
                                ? "Clean swish"
                                : `Miss · ${sequence.shots[sequenceStatus.index].contact}`
                            : `Shot ${(sequenceStatus?.index ?? 0) + 1} / ${sequence.shots.length}`
                        : viewSim.outcome}
                    </div>
                  </div>
                  <div className="canvas-wrap">
                    <Court
                      {...visualProps}
                      shot={viewShot}
                      simulation={viewSim}
                      league={viewLeague}
                      comparison={compare}
                      onSequenceFrame={setSequenceStatus}
                      previews={
                        !compare &&
                        result &&
                        result.config.league === league &&
                        result.config.shot.distance === shot.distance &&
                        result.config.shot.bearing === shot.bearing &&
                        result.config.shot.height === shot.height
                          ? result.previews
                          : []
                      }
                      onEnd={() => setPlaying(false)}
                    />
                  </div>
                  <div className="camera-controls">
                    {[
                      "Shot view",
                      "Side",
                      "Overhead",
                      "Ball follow",
                      "Hoop close-up",
                      "Full court",
                    ].map((c) => (
                      <button
                        key={c}
                        onClick={() => setCamera(c)}
                        className={camera === c ? "active" : ""}
                      >
                        {c === "Shot view" && <Focus size={13} />} {c}
                      </button>
                    ))}
                  </div>
                  <button className="record-launch" onClick={replay}>
                    <RotateCcw size={13} />
                    Replay
                  </button>
                  <div className="stage-hint">
                    Drag to orbit <span>·</span> Scroll to zoom
                  </div>
                  {!sequence && physical.limited && (
                    <div className="solver-notice">
                      Solver time/iteration limit reached; settling unresolved.
                    </div>
                  )}
                  {sequence ? (
                    <div
                      className="stage-bottom sequence-metrics"
                      aria-label="Shot sequence counters"
                    >
                      <div>
                        <span className="metric-label">
                          RELEASED / {sequence.shots.length}
                        </span>
                        <strong>{sequenceStatus?.released ?? 0}</strong>
                      </div>
                      <div>
                        <span className="metric-label">
                          {sequence.rebounds ? "ALL BASKETS" : "CLEAN SWISHES"}
                        </span>
                        <strong className="swish-count">
                          {sequence.rebounds
                            ? (sequenceStatus?.physicalBaskets ?? 0)
                            : (sequenceStatus?.swishes ?? 0)}
                        </strong>
                      </div>
                      <div>
                        <span className="metric-label">MISSES</span>
                        <strong className="miss-count">
                          {sequence.rebounds
                            ? (sequenceStatus?.physicalMisses ?? 0)
                            : (sequenceStatus?.misses ?? 0)}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="stage-bottom">
                      <div>
                        <span className="metric-label">LAUNCH ANGLE</span>
                        <strong>
                          {viewShot.angle.toFixed(1)} <small>°</small>
                        </strong>
                      </div>
                      <div>
                        <span className="metric-label">INITIAL SPEED</span>
                        <strong>
                          {viewShot.speed.toFixed(2)} <small>m/s</small>
                        </strong>
                      </div>
                      <div>
                        <span className="metric-label">PHYSICAL APEX</span>
                        <strong>
                          {viewSim.maxHeight.toFixed(2)} <small>m</small>
                        </strong>
                      </div>
                    </div>
                  )}
                  {sequence && (
                    <div className="sequence-caption">
                      <span>
                        {sequenceStrategy === "best"
                          ? "Best found"
                          : "Minimum speed"}{" "}
                        · Seed {result!.config.seed}
                      </span>
                      <span>
                        {sequence.rebounds
                          ? `${sequenceStatus?.physicalResolved ?? 0} physically resolved`
                          : `${sequenceStatus?.completed ?? 0} clean-shot outcomes resolved`}
                      </span>
                      {sequence.rebounds ? (
                        <small>
                          Swish {sequenceStatus?.clean ?? 0} · Rim{" "}
                          {sequenceStatus?.rim ?? 0} · Board{" "}
                          {sequenceStatus?.board ?? 0} · Miss{" "}
                          {sequenceStatus?.physicalMisses ?? 0} · Unresolved{" "}
                          {sequenceStatus?.unresolved ?? 0}. Full probability
                          below remains swish-only.
                        </small>
                      ) : (
                        <small>
                          Original swish-only baseline · balls end at first
                          contact
                        </small>
                      )}
                    </div>
                  )}
                  {annotations && (
                    <div className="annotation-strip">
                      <span>Distance {viewShot.distance.toFixed(2)} m</span>
                      <span>Release {viewShot.height.toFixed(2)} m</span>
                      <span>Rim {COURTS[viewLeague].height.toFixed(3)} m</span>
                    </div>
                  )}
                  <div className="probability-readout">
                    {viewEstimate
                      ? `${sequence ? `Full ${viewEstimate.n.toLocaleString()}-shot estimate` : "Swish-only"}: ${percent(viewEstimate.p)} · 95% CI ${percent(viewEstimate.lo)}–${percent(viewEstimate.hi)}`
                      : "Rebound-inclusive probability not estimated"}
                  </div>
                </section>
                {compare && result && (
                  <section className="stage comparison-stage">
                    <div className="stage-top">
                      <div className="stage-tag">
                        <span className="live-dot" /> BEST FOUND · SWISH SEARCH
                      </div>
                      <div className="outcome-badge">{bestSim.outcome}</div>
                    </div>
                    <div className="canvas-wrap">
                      <Court
                        {...visualProps}
                        shot={bestShot}
                        simulation={bestSim}
                        league={result.config.league}
                        comparison
                        previews={[]}
                        onEnd={() => {}}
                      />
                    </div>
                    <div className="stage-bottom">
                      <div>
                        <span className="metric-label">LAUNCH ANGLE</span>
                        <strong>
                          {bestShot.angle.toFixed(1)} <small>°</small>
                        </strong>
                      </div>
                      <div>
                        <span className="metric-label">INITIAL SPEED</span>
                        <strong>
                          {bestShot.speed.toFixed(2)} <small>m/s</small>
                        </strong>
                      </div>
                      <div>
                        <span className="metric-label">PHYSICAL APEX</span>
                        <strong>
                          {bestSim.maxHeight.toFixed(2)} <small>m</small>
                        </strong>
                      </div>
                    </div>
                    {annotations && (
                      <div className="annotation-strip">
                        <span>Distance {bestShot.distance.toFixed(2)} m</span>
                        <span>Release {bestShot.height.toFixed(2)} m</span>
                        <span>
                          Rim {COURTS[result.config.league].height.toFixed(3)} m
                        </span>
                      </div>
                    )}
                    <div className="probability-readout">
                      Swish-only: {percent(result.best.p)} · 95% CI{" "}
                      {percent(result.best.lo)}–{percent(result.best.hi)}
                    </div>
                  </section>
                )}
              </div>
              <div className="studio-transport" aria-label="Animation controls">
                <button className="transport-play" onClick={playPause}>
                  <Play size={15} fill="currentColor" />
                  {playing ? "Pause" : fired ? "Play / resume" : "Play shot"}
                </button>
                <button className="transport-replay" onClick={replay}>
                  <RotateCcw size={14} />
                  Replay
                </button>
                <label>
                  Speed
                  <select
                    aria-label="Playback speed"
                    value={rate}
                    onChange={(e) => setRate(+e.target.value)}
                  >
                    {[0.1, 0.25, 0.5, 1, 2].map((r) => (
                      <option key={r} value={r}>
                        {r}×
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Camera
                  <select
                    aria-label="Camera view"
                    value={camera}
                    onChange={(e) => setCamera(e.target.value)}
                  >
                    {[
                      "Shot view",
                      "Side",
                      "Overhead",
                      "Ball follow",
                      "Hoop close-up",
                      "Full court",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <span className="transport-mode">
                  {sequence
                    ? `${sequenceCount} consecutive shots`
                    : compare
                      ? "Strategy comparison"
                      : "Single shot · rebounds"}
                </span>
              </div>
            </div>
            <aside className="studio-panel" aria-label="Experiment workspace">
              <div className="tools-heading">
                <span>{guided ? "YOUR NEXT MOVE" : "PRECISION CONTROLS"}</span>
                <button
                  aria-expanded={!guided}
                  onClick={() => {
                    if (guided)
                      setPanel(["Shot", "Errors", "Results"][guideStep]);
                    setGuided(!guided);
                  }}
                >
                  <SlidersHorizontal size={13} />
                  {guided ? "Advanced controls" : "Back to guide"}
                </button>
              </div>
              {!guided && (
                <div
                  className="studio-tabs"
                  role="tablist"
                  aria-label="Workspace tools"
                >
                  {workspaceTools.map((name) => (
                    <button
                      key={name}
                      role="tab"
                      id={`tool-${name}`}
                      aria-selected={panel === name}
                      aria-controls="workspace-panel"
                      tabIndex={panel === name ? 0 : -1}
                      onClick={() => setPanel(name)}
                      onKeyDown={(e) => {
                        const index = workspaceTools.indexOf(name);
                        const next =
                          e.key === "ArrowRight"
                            ? (index + 1) % workspaceTools.length
                            : e.key === "ArrowLeft"
                              ? (index + workspaceTools.length - 1) %
                                workspaceTools.length
                              : e.key === "Home"
                                ? 0
                                : e.key === "End"
                                  ? workspaceTools.length - 1
                                  : null;
                        if (next !== null) {
                          e.preventDefault();
                          setPanel(workspaceTools[next]);
                          document
                            .getElementById(`tool-${workspaceTools[next]}`)
                            ?.focus();
                        }
                      }}
                    >
                      {name}
                      {name === "Results" && result && (
                        <span className="result-dot" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div
                className={"studio-panel-body " + (guided ? "guided-body" : "")}
                role="tabpanel"
                id="workspace-panel"
                aria-label={guided ? "Guided experiment" : undefined}
                aria-labelledby={guided ? undefined : `tool-${panel}`}
                key={guided ? `guide-${guideStep}` : panel}
              >
                {guided && guidedPanel}
                {!guided && panel === "Shot" && (
                  <>
                    {(sequence || compare) && (
                      <div className="saved-mode-notice">
                        You’re watching a saved experiment.
                        <button
                          onClick={() => {
                            setSequenceMode(false);
                            setCompareEnabled(false);
                            setPlaying(false);
                          }}
                        >
                          Edit a single shot
                        </button>
                      </div>
                    )}
                    {shotPanel}
                  </>
                )}
                {!guided && panel === "Sequence" && sequencePanel}
                {!guided && panel === "Errors" && (
                  <>
                    <div className="experiment-position">
                      <span>Current shooting position</span>
                      <strong>
                        {league} · {shot.distance.toFixed(2)} m ·{" "}
                        {shot.height.toFixed(2)} m release
                      </strong>
                      <button
                        onClick={() => {
                          setPanel("Shot");
                          setControlTab("Position");
                        }}
                      >
                        Change position
                      </button>
                    </div>
                    {experimentPanel}
                  </>
                )}
                {!guided && panel === "Results" && (
                  <>
                    {!result && (
                      <div className="results-empty">
                        <FlaskConical size={25} />
                        <h2>Let the experiment decide.</h2>
                        <p>
                          Calculate probabilities to compare the minimum-speed
                          shot with the best strategy found under shooting
                          errors.
                        </p>
                        <button
                          className="outline-button"
                          onClick={() => setPanel("Errors")}
                        >
                          Adjust shooting errors
                        </button>
                      </div>
                    )}
                    {result && (
                      <div className="result-quick-actions">
                        <button onClick={startSequence}>
                          <Play size={13} />
                          Watch shots
                        </button>
                        <button
                          onClick={() => {
                            setSequenceMode(false);
                            setCompareEnabled(true);
                            setPlaying(false);
                          }}
                        >
                          Compare in 3D
                        </button>
                        <button
                          aria-label="Export experiment JSON"
                          onClick={exportData}
                        >
                          <ArrowDownToLine size={14} />
                        </button>
                      </div>
                    )}
                    {result && resultsPanel}
                  </>
                )}
                {!guided && panel === "View" && viewPanel}
              </div>
              <div className="studio-panel-action">
                {error && <p role="alert">{error}</p>}
                {progress !== null ? (
                  <>
                    <div className="panel-progress" role="status">
                      Calculating probabilities ·{" "}
                      {Math.min(99, Math.round(progress * 100))}%
                    </div>
                    <div className="progress-track">
                      <div style={{ width: `${progress * 100}%` }} />
                    </div>
                    <button
                      className="outline-button"
                      onClick={() => {
                        worker.current?.terminate();
                        pendingSequence.current = false;
                        setProgress(null);
                      }}
                    >
                      Cancel experiment
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="run-button"
                      onClick={() =>
                        guided && guideStep === 0
                          ? setGuideStep(1)
                          : guided && guideStep === 2 && result
                            ? startSequence()
                            : run()
                      }
                    >
                      {guided && guideStep === 2 && result ? (
                        <Play size={15} />
                      ) : (
                        <ArrowRight size={15} />
                      )}
                      {guided
                        ? guideStep === 0
                          ? "Next: add human error"
                          : guideStep === 2 && result
                            ? `Watch ${sequenceCount} sampled shots`
                            : "Run the experiment"
                        : result
                          ? "Update probabilities"
                          : "Calculate probabilities"}
                    </button>
                    <small>
                      {guided && guideStep === 0
                        ? "Start here. No setup required."
                        : result
                          ? `Saved: ${result.config.samples.toLocaleString()} shots / strategy · seed ${result.config.seed}`
                          : "10,000+ shots per strategy · seeded & reproducible"}
                    </small>
                    <span className="panel-model-label">
                      {guided && guideStep === 0
                        ? "Physics first. Probability next."
                        : "Clean-shot model · illustrative human errors"}
                    </span>
                  </>
                )}
              </div>
            </aside>
          </div>
        )}
        <footer>
          <span className="footer-brand">
            arc lab <span>/</span> Physics. Mathematics. Statistics.
          </span>
          <span>Built for curiosity. Grounded in mechanics.</span>
        </footer>
      </main>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="How Arc Lab works"
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setHelp(false)}
              aria-label="Close"
            >
              <X />
            </button>
            <div className="eyebrow">WELCOME TO ARC LAB</div>
            <h2>What makes a better shot?</h2>
            <p>
              Arc Lab tests whether the shot requiring the least launch speed
              also gives the best chance of scoring when a player’s release
              varies.
            </p>
            <ol>
              <li>
                Start at “Watch a shot” and press “Watch this shot.” Playback,
                replay, speed, and camera controls stay below the court.
              </li>
              <li>
                Choose “Add human error.” Keep the illustrative defaults or
                adjust the three error values, then run the experiment.
              </li>
              <li>
                “Compare results” shows the calculated probabilities. Compare
                the shots in 3D or watch sampled shots one at a time.
              </li>
              <li>
                Use Advanced controls for more settings, Presentation mode for
                recording, and The science for equations and limitations.
              </li>
            </ol>
            <p>
              The search covers 38–68° in 3° steps, center-target speeds ±0.18
              m/s, and aim ±0.35°, with local refinement. It includes the
              analytical baseline. “Best found” is not a proof of a global
              maximum.
            </p>
            <button className="run-button" onClick={() => setHelp(false)}>
              Explore the lab <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
