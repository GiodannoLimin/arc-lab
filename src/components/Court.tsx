import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import {
  at,
  BALL_RADIUS,
  cleanShot,
  COURTS,
  flightTime,
  firstContact,
  initial,
  type League,
  type Shot,
} from "../science/physics";
import {
  sampleRebounds,
  simulateRebounds,
  type ReboundResult,
} from "../science/rebounds";
import { COLORS, fitCamera, type PlaybackClock } from "../visualization/view";
import {
  sequenceFrame,
  type ShotSequence,
  type SequenceFrame,
} from "../visualization/sequence";
type Props = {
  shot: Shot;
  simulation: ReboundResult;
  reference: boolean;
  league: League;
  camera: string;
  playing: boolean;
  playId: number;
  clock: PlaybackClock;
  duration: number;
  trails: boolean;
  previews: Shot[];
  visibleCount: number;
  highlight: number;
  animateSubset: boolean;
  showPaths: boolean;
  annotations: boolean;
  animatedTrail: boolean;
  fullPath: boolean;
  comparison?: boolean;
  sequence?: ShotSequence | null;
  onSequenceFrame?: (frame: SequenceFrame) => void;
  onEnd: () => void;
};
function Mark({
  points,
  color = "#f6eedc",
  width = 1.5,
}: {
  points: [number, number, number][];
  color?: string;
  width?: number;
}) {
  return <Line points={points} color={color} lineWidth={width} />;
}
function arc(
  r: number,
  start: number,
  end: number,
  z = 0,
): [number, number, number][] {
  return Array.from({ length: 121 }, (_, i) => {
    const a = start + ((end - start) * i) / 120;
    return [r * Math.sin(a), 0.014, z + r * Math.cos(a)];
  });
}
function Basketball({
  position = [0, 0, 0],
}: {
  position?: [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 24]} />
        <meshStandardMaterial color="#d56c2b" roughness={0.92} />
      </mesh>
      {[
        [0, 0, 0],
        [Math.PI / 2, 0, 0],
        [0, Math.PI / 2, 0],
      ].map((r, i) => (
        <mesh key={i} rotation={r as [number, number, number]}>
          <torusGeometry args={[BALL_RADIUS + 0.0003, 0.0018, 5, 80]} />
          <meshStandardMaterial color="#39291d" />
        </mesh>
      ))}
    </group>
  );
}
function Hoop({ league }: { league: League }) {
  const c = COURTS[league],
    H = c.height;
  return (
    <group>
      <mesh
        position={[0, H - 0.009, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <torusGeometry args={[c.inner + 0.009, 0.009, 12, 80]} />
        <meshStandardMaterial color="#f16b36" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh
        position={[
          0,
          c.boardBottom + c.boardHeight / 2,
          -c.boardOffset - 0.025,
        ]}
        castShadow
      >
        <boxGeometry args={[c.boardWidth, c.boardHeight, 0.05]} />
        <meshPhysicalMaterial
          color="#d7e5e0"
          transparent
          opacity={0.32}
          roughness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Mark
        points={[
          [-c.boardWidth / 2, c.boardBottom, -c.boardOffset + 0.01],
          [
            -c.boardWidth / 2,
            c.boardBottom + c.boardHeight,
            -c.boardOffset + 0.01,
          ],
          [
            c.boardWidth / 2,
            c.boardBottom + c.boardHeight,
            -c.boardOffset + 0.01,
          ],
          [c.boardWidth / 2, c.boardBottom, -c.boardOffset + 0.01],
          [-c.boardWidth / 2, c.boardBottom, -c.boardOffset + 0.01],
        ]}
        width={2.5}
      />
      <Mark
        points={[
          [-0.305, H, -c.boardOffset + 0.01],
          [-0.305, H + 0.457, -c.boardOffset + 0.01],
          [0.305, H + 0.457, -c.boardOffset + 0.01],
          [0.305, H, -c.boardOffset + 0.01],
          [-0.305, H, -c.boardOffset + 0.01],
        ]}
        width={2}
      />
      <mesh position={[0, 1.8, -1.2]} castShadow>
        <boxGeometry args={[0.15, 3.6, 0.15]} />
        <meshStandardMaterial color="#65756c" />
      </mesh>
      <mesh position={[0, 0.45, -1.2]}>
        <boxGeometry args={[0.7, 0.9, 0.7]} />
        <meshStandardMaterial color="#353b3b" />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6,
          b = a + 0.12;
        return (
          <Mark
            key={i}
            points={[
              [c.inner * Math.cos(a), H - 0.015, c.inner * Math.sin(a)],
              [0.15 * Math.cos(b), H - 0.22, 0.15 * Math.sin(b)],
              [0.13 * Math.cos(a), H - 0.43, 0.13 * Math.sin(a)],
            ]}
            color="#c6d3c9"
            width={0.8}
          />
        );
      })}
    </group>
  );
}
function Floor({ league, full }: { league: League; full: boolean }) {
  const c = COURTS[league],
    far = c.length - 2 * c.inset,
    length = full ? c.length : c.length / 2;
  const floorRings = useMemo(() => {
    const ring = (ow: number, ol: number, iw: number, il: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(-ow / 2, -ol / 2);
      shape.lineTo(ow / 2, -ol / 2);
      shape.lineTo(ow / 2, ol / 2);
      shape.lineTo(-ow / 2, ol / 2);
      shape.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-iw / 2, -il / 2);
      hole.lineTo(-iw / 2, il / 2);
      hole.lineTo(iw / 2, il / 2);
      hole.lineTo(iw / 2, -il / 2);
      hole.closePath();
      shape.holes.push(hole);
      return new THREE.ShapeGeometry(shape);
    };
    return [
      ring(c.width + 2.4, length + 2.4, c.width, length),
      ring(200, 200, c.width + 2.4, length + 2.4),
    ];
  }, [c.width, length]);
  useEffect(() => () => floorRings.forEach((g) => g.dispose()), [floorRings]);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    for (let row = 0; row < 32; row++)
      for (let col = -1; col < 9; col++) {
        const n = ((row * 17 + col * 31 + 67) % 19) / 19;
        ctx.fillStyle = `hsl(34, ${27 + n * 8}%, ${57 + n * 7}%)`;
        ctx.fillRect(col * 128 + (row % 2) * 64, row * 32, 127, 31);
        ctx.strokeStyle = "rgba(70,45,25,.07)";
        for (let j = 0; j < 5; j++) {
          ctx.beginPath();
          ctx.moveTo(col * 128 + (row % 2) * 64, row * 32 + j * 6);
          ctx.lineTo(col * 128 + (row % 2) * 64 + 127, row * 32 + j * 6 + 1);
          ctx.stroke();
        }
      }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 4);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const markings = (
    <>
      <Mark
        points={arc(
          c.arc,
          -Math.asin(c.corner / c.arc),
          Math.asin(c.corner / c.arc),
        )}
      />
      {[-1, 1].map((sign) => (
        <Mark
          key={sign}
          points={[
            [sign * c.corner, 0.014, -c.inset],
            [
              sign * c.corner,
              0.014,
              Math.sqrt(c.arc * c.arc - c.corner * c.corner),
            ],
          ]}
        />
      ))}
      <Mark
        points={[
          [-c.lane / 2, 0.014, -c.inset],
          [-c.lane / 2, 0.014, c.freeThrow],
          [c.lane / 2, 0.014, c.freeThrow],
          [c.lane / 2, 0.014, -c.inset],
        ]}
      />
      <Mark points={arc(1.8, -Math.PI / 2, Math.PI / 2, c.freeThrow)} />
      <Mark points={arc(c.restricted, -Math.PI / 2, Math.PI / 2)} />
    </>
  );
  return (
    <>
      <mesh
        geometry={floorRings[1]}
        dispose={null}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, length / 2 - c.inset]}
        receiveShadow
      >
        <meshStandardMaterial color="#171c20" roughness={0.92} />
      </mesh>
      <mesh
        geometry={floorRings[0]}
        dispose={null}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, length / 2 - c.inset]}
        receiveShadow
      >
        <meshStandardMaterial color="#3c4341" roughness={0.95} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, length / 2 - c.inset]}
        receiveShadow
      >
        <planeGeometry args={[c.width, length]} />
        <meshStandardMaterial map={texture} roughness={0.72} />
      </mesh>
      <Mark
        points={[
          [-c.width / 2, 0.014, -c.inset],
          [c.width / 2, 0.014, -c.inset],
          [c.width / 2, 0.014, length - c.inset],
          [-c.width / 2, 0.014, length - c.inset],
          [-c.width / 2, 0.014, -c.inset],
        ]}
      />
      {markings}
      {full && (
        <group position={[0, 0, far]} rotation={[0, Math.PI, 0]}>
          {markings}
          <Hoop league={league} />
        </group>
      )}
      <Hoop league={league} />
      <Mark
        points={[
          [-c.width / 2, 0.014, c.length / 2 - c.inset],
          [c.width / 2, 0.014, c.length / 2 - c.inset],
        ]}
      />
      <Mark points={arc(1.8, 0, Math.PI * 2, c.length / 2 - c.inset)} />
    </>
  );
}
function Camera(p: Props) {
  const { camera, size } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null),
    moving = useRef(true);
  const goal = useMemo(() => {
    const b = (p.shot.bearing * Math.PI) / 180,
      side = { x: Math.cos(b), y: 0, z: -Math.sin(b) },
      forward = { x: Math.sin(b), y: 0, z: Math.cos(b) };
    let points = p.simulation.segments
      .filter((_, i) => i % 12 === 0)
      .filter(
        (s) =>
          s.start.time <=
          (p.simulation.contacts.find((c) => c.surface === "floor")?.time ?? 4),
      )
      .map((s) => s.start.p);
    const c = COURTS[p.league];
    if (p.sequence)
      points = p.sequence.shots.flatMap((s) =>
        Array.from({ length: 24 }, (_, i) =>
          s.physical
            ? sampleRebounds(
                s.physical,
                ((s.physical.contacts.find((c) => c.surface === "floor")
                  ?.time ?? s.end) *
                  i) /
                  23,
              ).p
            : at(s.shot, (s.end * i) / 23),
        ),
      );
    points.push(
      { x: -c.boardWidth / 2, y: 2.9, z: -c.boardOffset },
      { x: c.boardWidth / 2, y: 2.9 + c.boardHeight, z: -c.boardOffset },
    );
    let outward = {
      x: side.x + 0.38 * forward.x,
      y: 0.33,
      z: side.z + 0.38 * forward.z,
    };
    if (size.width / size.height < 0.8)
      outward = {
        x: 0.75 * side.x + 1.05 * forward.x,
        y: 0.5,
        z: 0.75 * side.z + 1.05 * forward.z,
      };
    if (p.camera === "Side") outward = { ...side, y: 0.08 };
    if (p.camera === "Overhead") outward = { x: 0.001, y: 1, z: 0.001 };
    if (p.camera === "Hoop close-up") {
      points = [
        { x: -1, y: 2.45, z: -0.5 },
        { x: 1, y: 4.3, z: 1 },
      ];
      outward = { x: 1, y: 0.35, z: 1.5 };
    }
    if (p.camera === "Full court") {
      points = [-c.width / 2, c.width / 2].flatMap((x) =>
        [-c.inset, c.length - c.inset].flatMap((z) =>
          [0, 4.2].map((y) => ({ x, y, z })),
        ),
      );
      outward = { x: 1, y: 1.2, z: 1 };
    }

    return fitCamera(
      points,
      outward,
      size.width / size.height,
      p.camera === "Hoop close-up" ? 32 : 38,
    );
  }, [
    p.camera,
    p.shot,
    p.simulation,
    p.sequence,
    p.league,
    size.width,
    size.height,
  ]);
  useEffect(() => {
    moving.current = true;
  }, [goal]);
  useFrame((_, dt) => {
    if (!controls.current) return;
    const follow = p.camera === "Ball follow" && p.playing;
    const alpha = 1 - Math.exp(-5 * dt);
    let target = new THREE.Vector3(goal.target.x, goal.target.y, goal.target.z),
      position = new THREE.Vector3(
        goal.position.x,
        goal.position.y,
        goal.position.z,
      );
    if (follow) {
      const t = p.clock.time(performance.now());
      const frame = p.sequence ? sequenceFrame(p.sequence, t) : null;
      const pos =
        frame && p.sequence
          ? p.sequence.shots[frame.index].physical
            ? sampleRebounds(
                p.sequence.shots[frame.index].physical!,
                frame.localTime,
              ).p
            : at(p.sequence.shots[frame.index].shot, frame.localTime)
          : sampleRebounds(p.simulation, t).p;
      target.set(pos.x, pos.y, pos.z);
      position.set(pos.x + 2.6, pos.y + 1.4, pos.z + 3.5);
    }
    if (moving.current || follow) {
      camera.position.lerp(position, alpha);
      controls.current.target.lerp(target, alpha);
      const perspective = camera as THREE.PerspectiveCamera;
      perspective.fov = THREE.MathUtils.lerp(perspective.fov, goal.fov, alpha);
      perspective.updateProjectionMatrix();
      controls.current.update();
      if (
        camera.position.distanceTo(position) < 0.005 &&
        controls.current.target.distanceTo(target) < 0.005
      )
        moving.current = false;
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      minDistance={1.2}
      maxDistance={2500}
      maxPolarAngle={Math.PI / 2 - 0.015}
      enableDamping
      enabled={!(p.camera === "Ball follow" && p.playing)}
      onStart={() => {
        moving.current = false;
      }}
    />
  );
}
function AnimatedBall(p: Props) {
  const ref = useRef<THREE.Group>(null),
    ended = useRef(false),
    trail = useRef<ComponentRef<typeof Line>>(null);
  const { size } = useThree();
  useEffect(() => {
    ended.current = false;
  }, [p.playId, p.simulation]);
  const trailPoints = useMemo(() => new Float32Array(50 * 3), []);
  useFrame(() => {
    const time = p.clock.time(performance.now()),
      state = sampleRebounds(
        p.simulation,
        Math.min(time, p.simulation.final.time),
      );
    ref.current?.position.set(state.p.x, state.p.y, state.p.z);
    ref.current?.quaternion.set(...state.q);
    // A disclosed solver limit is not a resting state; never pin an airborne ball.
    if (ref.current)
      ref.current.visible = !(
        p.simulation.limited && time >= p.simulation.final.time
      );
    if (p.animatedTrail && trail.current) {
      for (let i = 0; i < 50; i++) {
        const pos = sampleRebounds(
          p.simulation,
          Math.max(0, time - 0.45 + (0.45 * i) / 49),
        ).p;
        trailPoints.set([pos.x, pos.y, pos.z], i * 3);
      }
      trail.current.geometry.setPositions(trailPoints);
      trail.current.computeLineDistances();
    }
    if (p.playing && time >= p.duration && !ended.current) {
      ended.current = true;
      p.onEnd();
    }
  });
  return (
    <>
      <group ref={ref}>
        <Basketball />
      </group>
      {p.animatedTrail && (
        <Line
          ref={trail}
          points={Array.from(
            { length: 50 },
            () => [0, 0, 0] as [number, number, number],
          )}
          color="#fff3cc"
          lineWidth={6}
          transparent
          opacity={0.75}
          depthWrite={false}
        />
      )}
    </>
  );
}
function BaselineExample({
  shot,
  league,
  clock,
  index,
  highlight,
  animate,
  showPaths,
}: {
  shot: Shot;
  league: League;
  clock: PlaybackClock;
  index: number;
  highlight: boolean;
  animate: boolean;
  showPaths: boolean;
}) {
  const ball = useRef<THREE.Group>(null);
  const physical = useMemo(
    () => (animate ? simulateRebounds(shot, league) : null),
    [shot, league, animate],
  );
  const end = useMemo(() => firstContact(shot, league).time, [shot, league]),
    success = useMemo(() => cleanShot(shot, league), [shot, league]);
  const points = useMemo(
    () =>
      Array.from({ length: 200 }, (_, i) => {
        const pos = at(shot, (end * i) / 199);
        return [pos.x, pos.y, pos.z] as [number, number, number];
      }),
    [shot, end],
  );
  useFrame(() => {
    if (!ball.current) return;
    if (!physical) return;
    const t = clock.time(performance.now());
    ball.current.visible =
      animate && !(physical.limited && t >= physical.final.time);
    const state = sampleRebounds(physical, t);
    ball.current.position.set(state.p.x, state.p.y, state.p.z);
    ball.current.quaternion.set(...state.q);
  });
  return (
    <>
      {showPaths && (
        <Line
          points={points}
          color={success ? COLORS.success : COLORS.miss}
          dashed={!success}
          dashSize={0.12}
          gapSize={0.09}
          lineWidth={highlight ? 4.5 : 1.7}
          transparent
          opacity={highlight ? 0.9 : 0.25}
          depthWrite={false}
        />
      )}
      {animate && (
        <group ref={ball}>
          <Basketball />
        </group>
      )}
    </>
  );
}
function SequenceBall(p: Props & { sequence: ShotSequence }) {
  const ball = useRef<THREE.Group>(null);
  const physicalBalls = useRef<(THREE.Group | null)[]>([]);
  const path = useRef<ComponentRef<typeof Line>>(null);
  const lastEvent = useRef("");
  const ended = useRef(false);
  const points = useMemo(() => new Float32Array(120 * 3), []);
  useEffect(() => {
    ended.current = false;
    lastEvent.current = "";
  }, [p.sequence, p.playId]);
  useFrame(() => {
    const frame = sequenceFrame(p.sequence, p.clock.time(performance.now()));
    const active = p.sequence.shots[frame.index];
    const pos = active.physical
      ? sampleRebounds(active.physical, frame.localTime).p
      : at(active.shot, frame.localTime);
    if (p.sequence.rebounds) {
      for (let slot = 0; slot < 4; slot++) {
        const group = physicalBalls.current[slot];
        if (!group) continue;
        const i = frame.index - ((frame.index - slot + 4) % 4);
        const entry = p.sequence.shots[i];
        if (!entry?.physical) {
          group.visible = false;
          continue;
        }
        const t = p.clock.time(performance.now()) - entry.start;
        group.visible = t >= 0 && !(entry.physical.limited && t >= entry.end);
        const state = sampleRebounds(entry.physical, Math.max(0, t));
        group.position.set(state.p.x, state.p.y, state.p.z);
        group.quaternion.set(...state.q);
      }
    }
    if (ball.current) {
      ball.current.visible = frame.visible;
      ball.current.position.set(pos.x, pos.y, pos.z);
    }
    if (path.current) {
      const from = p.showPaths ? 0 : Math.max(0, frame.localTime - 0.45);
      for (let i = 0; i < 120; i++) {
        const t = from + ((frame.localTime - from) * i) / 119;
        const v = active.physical
          ? sampleRebounds(active.physical, t).p
          : at(active.shot, t);
        points.set([v.x, v.y, v.z], i * 3);
      }
      path.current.geometry.setPositions(points);
      path.current.computeLineDistances();
      path.current.material.color.set(
        (active.physical ? frame.physicalDecided : frame.decided)
          ? (
              active.physical
                ? active.physical.scoreTime !== null
                : active.success
            )
            ? COLORS.success
            : COLORS.miss
          : "#dae9ed",
      );
    }
    const event = `${frame.index}:${frame.decided}:${frame.visible}:${frame.done}:${frame.physicalResolved}:${frame.unresolved}`;
    if (event !== lastEvent.current) {
      lastEvent.current = event;
      p.onSequenceFrame?.(frame);
    }
    if (p.playing && frame.done && !ended.current) {
      ended.current = true;
      p.onEnd();
    }
  });
  return (
    <>
      {p.sequence.rebounds ? (
        [0, 1, 2, 3].map((slot) => (
          <group
            key={slot}
            ref={(node) => {
              physicalBalls.current[slot] = node;
            }}
          >
            <Basketball />
          </group>
        ))
      ) : (
        <group ref={ball}>
          <Basketball />
        </group>
      )}
      {(p.showPaths || p.animatedTrail) && (
        <Line
          ref={path}
          points={Array.from(
            { length: 120 },
            () => [0, 0, 0] as [number, number, number],
          )}
          color="#dae9ed"
          lineWidth={4}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      )}
    </>
  );
}
export default function Court(p: Props) {
  const start = initial(p.shot).p;
  const physicalPoints = useMemo(() => {
    const end = p.fullPath
      ? p.simulation.final.time
      : (p.simulation.contacts.find((c) => c.surface === "floor")?.time ??
        p.simulation.final.time);
    const points = p.simulation.segments
      .filter((s) => s.start.time <= end)
      .map(
        (s) =>
          [s.start.p.x, s.start.p.y, s.start.p.z] as [number, number, number],
      );
    const last = sampleRebounds(p.simulation, end).p;
    points.push([last.x, last.y, last.z]);
    return points;
  }, [p.simulation, p.fullPath]);
  const referencePoints = useMemo(
    () =>
      Array.from({ length: 240 }, (_, i) => {
        const pos = at(p.shot, (flightTime(p.shot) * i) / 239);
        return [pos.x, pos.y, pos.z] as [number, number, number];
      }),
    [p.shot],
  );
  const subset = p.previews.slice(0, p.visibleCount);
  return (
    <Canvas
      shadows
      camera={{ position: [10, 5, 8], fov: 38, near: 0.03, far: 3000 }}
      dpr={[1, p.comparison ? 1.4 : 1.8]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
      }}
    >
      <color attach="background" args={["#171c20"]} />
      <fog attach="fog" args={["#171c20", 28, 100]} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={["#e8f2ff", "#353c35", 1.8]} />
      <directionalLight
        position={[2, 12, 5]}
        intensity={3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00015}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={18}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[-5, 7, -5]} color="#8fc5e5" intensity={2} />
      <Suspense fallback={null}>
        <Floor league={p.league} full={p.camera === "Full court"} />
        <Camera {...p} />
        {p.sequence ? (
          <SequenceBall {...p} sequence={p.sequence} />
        ) : (
          <AnimatedBall {...p} />
        )}
        {!p.sequence && p.showPaths && (
          <Line
            points={physicalPoints}
            color={
              p.simulation.scoreTime !== null ? COLORS.success : COLORS.miss
            }
            lineWidth={4}
            transparent
            opacity={0.93}
            depthWrite={false}
          />
        )}
        {p.showPaths && p.reference && (
          <Line
            points={referencePoints}
            color={COLORS.reference}
            lineWidth={2.4}
            dashed
            dashSize={0.12}
            gapSize={0.09}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        )}
        {!p.sequence &&
          p.trails &&
          subset.map((s, i) => (
            <BaselineExample
              key={i}
              shot={s}
              league={p.league}
              clock={p.clock}
              index={i}
              highlight={i === p.highlight}
              animate={p.animateSubset && i < 4}
              showPaths={p.showPaths}
            />
          ))}
        {p.annotations && (
          <>
            {p.camera === "Side" && (
              <Mark
                points={Array.from({ length: 40 }, (_, i) => {
                  const a = (((p.shot.angle * Math.PI) / 180) * i) / 39,
                    b = (p.shot.bearing * Math.PI) / 180;
                  return [
                    start.x - 0.8 * Math.sin(b) * Math.cos(a),
                    start.y + 0.8 * Math.sin(a),
                    start.z - 0.8 * Math.cos(b) * Math.cos(a),
                  ] as [number, number, number];
                })}
                color={COLORS.reference}
                width={2}
              />
            )}

            <mesh
              position={[start.x, 0.024, start.z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.24, 0.28, 64]} />
              <meshBasicMaterial
                color={COLORS.reference}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Mark
              points={[
                [start.x, 0.03, start.z],
                [0, 0.03, 0],
              ]}
              color="#a4b5bb"
              width={1}
            />
            <Mark
              points={[
                [start.x, 0.03, start.z],
                [start.x, start.y, start.z],
              ]}
              color="#a4b5bb"
              width={1}
            />
          </>
        )}
      </Suspense>
    </Canvas>
  );
}
