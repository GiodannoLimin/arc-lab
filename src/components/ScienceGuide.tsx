import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, BookOpen } from "lucide-react";
import {
  COURTS,
  WIRE,
  minimumSpeed,
  type League,
  type Shot,
} from "../science/physics";
import { equations } from "../visualization/equations";
import MathFormula from "./MathFormula";

const chapters = [
  {
    name: "The flight",
    title: "A shot, described by gravity.",
    intro:
      "Two equations describe where the ball is at any instant before a collision.",
  },
  {
    name: "Minimum speed",
    title: "Find the least launch speed.",
    intro:
      "Aiming at the hoop’s center gives an analytical optimum. Clearing the rim is a separate question.",
  },
  {
    name: "What counts?",
    title: "The whole ball must fit.",
    intro:
      "Crossing hoop height is only part of the story. A basketball has a radius, and the rim has thickness.",
  },
  {
    name: "Human error",
    title: "A good shot has room for error.",
    intro:
      "Release angle, speed, and direction vary. Repeated trials let us estimate how often a strategy clears the hoop.",
  },
];
export default function ScienceGuide({
  shot,
  league,
  validationError,
  onBack,
  onTryIdeal,
}: {
  shot: Shot;
  league: League;
  validationError: number;
  onBack: () => void;
  onTryIdeal: () => void;
}) {
  const [chapter, setChapter] = useState(0);
  const ideal = minimumSpeed(
    shot.distance,
    shot.height,
    COURTS[league].height - WIRE,
  );
  const current = chapters[chapter];
  return (
    <section className="science-guide">
      <aside className="science-index">
        <span className="edition-label">
          <BookOpen size={14} /> FIELD NOTES / 01
        </span>
        <h2>
          The science
          <br />
          behind the arc.
        </h2>
        <p>
          Read one idea at a time.
          <br />
          Then try it in the experiment.
        </p>
        <nav aria-label="Science chapters">
          {chapters.map((c, i) => (
            <button
              key={c.name}
              aria-current={i === chapter ? "step" : undefined}
              onClick={() => setChapter(i)}
            >
              <span>0{i + 1}</span>
              {c.name}
              <ArrowRight size={13} />
            </button>
          ))}
        </nav>
        <button className="science-back" onClick={onBack}>
          <ArrowLeft size={14} />
          Back to experiment
        </button>
      </aside>
      <article className="science-paper" key={chapter}>
        <div className="paper-topline">
          <span>CLASSICAL MECHANICS / STATISTICS</span>
          <span>0{chapter + 1} — 04</span>
        </div>
        <h1>{current.title}</h1>
        <p className="science-intro">{current.intro}</p>
        {chapter === 0 && (
          <>
            <div className="equation-card">
              <span>01 / HORIZONTAL MOTION</span>
              <MathFormula
                tex={equations.horizontal}
                label="Horizontal projectile motion"
              />
            </div>
            <div className="equation-card">
              <span>02 / VERTICAL MOTION</span>
              <MathFormula
                tex={equations.vertical}
                label="Vertical projectile motion under gravity"
              />
            </div>
            <dl className="symbol-key">
              <div>
                <dt>d(t)</dt>
                <dd>Horizontal travel</dd>
              </div>
              <div>
                <dt>h₀</dt>
                <dd>Release height</dd>
              </div>
              <div>
                <dt>v₀, θ</dt>
                <dd>Launch speed & angle</dd>
              </div>
              <div>
                <dt>g = 9.81 m/s²</dt>
                <dd>Gravitational acceleration</dd>
              </div>
            </dl>
            <p className="science-note">
              SI units throughout. The simulator uses y as the vertical axis.
              These equations apply until contact; the interactive rebound
              solver handles motion after a collision.
            </p>
          </>
        )}
        {chapter === 1 && (
          <>
            <div className="equation-card">
              <span>REQUIRED SPEED AT A CHOSEN ANGLE</span>
              <MathFormula
                tex={equations.required}
                label="Required launch speed to reach the specified target"
              />
            </div>
            <div className="equation-card">
              <span>ANALYTICAL MINIMUM</span>
              <MathFormula
                tex={equations.angle}
                label="Angle minimizing initial launch speed"
              />
              <MathFormula
                tex={equations.minimum}
                label="Minimum initial launch speed"
              />
            </div>
            <p className="science-note">
              Here, Δh is target height minus release height. The denominator in
              the required-speed equation must be positive. The target is the
              ring tube’s center plane, 9 mm below its top edge. Minimum speed
              is a physical criterion, not a measurement of human effort or
              scoring probability.
            </p>
            <div className="science-calculation">
              <div>
                <small>YOUR CURRENT GEOMETRY</small>
                <strong>
                  {shot.distance.toFixed(2)} m distance ·{" "}
                  {shot.height.toFixed(2)} m release
                </strong>
                <span>
                  {ideal.angle.toFixed(2)}° · {ideal.speed.toFixed(3)} m/s
                  minimum-speed solution
                </span>
              </div>
              <button onClick={onTryIdeal}>
                Try this shot <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
        {chapter === 2 && (
          <>
            <div className="equation-card">
              <span>NECESSARY CENTER-PLANE CLEARANCE</span>
              <MathFormula
                tex={equations.sphere}
                label="Necessary radial clearance for a sphere at the hoop center plane"
              />
            </div>
            <p className="science-note">
              This inequality is necessary, but it is not the complete scoring
              rule. The clean-shot model also certifies clearance from the rim
              tube and backboard over the approach and descending exit.
              Unresolved grazing is counted as a miss.
            </p>
            <div className="science-facts">
              <div>
                <strong>0.120 m</strong>
                <span>Basketball radius</span>
              </div>
              <div>
                <strong>{COURTS[league].inner.toFixed(4)} m</strong>
                <span>{league} inner rim radius</span>
              </div>
              <div>
                <strong>{COURTS[league].height.toFixed(3)} m</strong>
                <span>Regulation top edge</span>
              </div>
            </div>
            <div className="science-callout">
              <strong>Two scoring models, clearly separated.</strong>
              <p>
                The interactive shot can score after physical rebounds.
                Probability experiments and ordered shot replays use the
                swish-only baseline: rim-assisted and backboard-assisted baskets
                are excluded.
              </p>
            </div>
          </>
        )}
        {chapter === 3 && (
          <>
            <div className="equation-card">
              <span>ACTUAL RELEASE = INTENTION + ERROR</span>
              <MathFormula
                tex={equations.error}
                label="Release errors added to intended parameters"
              />
            </div>
            <div className="equation-pair">
              <div className="equation-card">
                <span>ASSUMED ERRORS</span>
                <MathFormula
                  tex={equations.normal}
                  label="Illustrative zero-mean normal release errors"
                />
              </div>
              <div className="equation-card">
                <span>MONTE CARLO ESTIMATE</span>
                <MathFormula
                  tex={equations.probability}
                  label="Estimated clean-shot probability"
                />
              </div>
            </div>
            <p className="science-note">
              Standard deviations are configurable assumptions, not measured
              player data. Angle–speed correlation is optional; direction errors
              are independent. A seeded search selects a candidate and a
              separate held-out stream estimates its performance. “Best found”
              is not a proof of the global maximum.
            </p>
            <div className="science-callout">
              <strong>What does the 95% interval mean?</strong>
              <p>
                The Wilson confidence interval describes Monte Carlo sampling
                uncertainty. It does not measure how accurately the model
                represents a real player. The strategies may coincide or differ;
                the experiment does not force an improvement.
              </p>
            </div>
          </>
        )}
        <div className="paper-footer">
          <span>
            <Check size={13} /> RK4 vs. analytical at 1 s:{" "}
            {validationError.toExponential(2)} m
          </span>
          <button
            onClick={() => (chapter < 3 ? setChapter(chapter + 1) : onBack())}
          >
            {chapter < 3 ? "Next idea" : "Try the experiment"}
            <ArrowRight size={14} />
          </button>
        </div>
        <details className="science-limitations">
          <summary>Model limitations & geometry sources</summary>
          <p>
            The rebound model uses an ideal sphere with restitution, friction,
            and spin impulses. Contact parameters are unmeasured assumptions.
            Net forces, hoop supports, air drag, and aerodynamic spin forces are
            excluded. Rebounds have not been experimentally validated.
          </p>
          <p>
            Geometry presets:{" "}
            <a
              href="https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-official-basketball-rules-and-basketball-equipment.pdf"
              target="_blank"
              rel="noreferrer"
            >
              FIBA equipment rules
            </a>{" "}
            ·{" "}
            <a
              href="https://official.nba.com/rule-no-1-court-dimensions-equipment"
              target="_blank"
              rel="noreferrer"
            >
              NBA court and equipment
            </a>
            .
          </p>
        </details>
      </article>
    </section>
  );
}
