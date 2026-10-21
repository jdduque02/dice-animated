// Headless physics check for the "dice feel like they're in a box" work (SPEC R1.2, R1.5-R1.8).
// Run: node scripts/simRolls.ts   — prints metrics and exits 1 if any criterion fails.
import * as CANNON from 'cannon-es';
import { createPhysicsWorld, type PhysicsMaterials } from '../src/physics/world.ts';
import { computePlayArea, projectToNdc } from '../src/physics/playArea.ts';
import { DIE_ANGULAR_DAMPING, DIE_LINEAR_DAMPING, applyThrow, isAtRest, REST_HOLD_MS, restSpawn, type PlayBounds } from '../src/physics/throw.ts';

const ROLLS = 200;
const DT = 1 / 60;
const MAX_SECONDS = 8;
const DIE_SIZE = 1; // d6 edge length = one "diameter" in the spec's units

// Portrait phone (worst case for width) and a wide web window.
const ASPECTS = [0.45, 1.8];

// Seeded so a failing run is reproducible while tuning.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ponytail: walls/ground mirror Walls.tsx/Ground.tsx by hand; share a builder if either changes again.
function addStatics(world: CANNON.World, bounds: PlayBounds, m: PhysicsMaterials) {
  const walls = [
    { p: [bounds.halfX, 0, 0], ry: -Math.PI / 2 },
    { p: [-bounds.halfX, 0, 0], ry: Math.PI / 2 },
    { p: [0, 0, bounds.centerZ + bounds.halfZ], ry: Math.PI },
    { p: [0, 0, bounds.centerZ - bounds.halfZ], ry: 0 },
  ].map(({ p, ry }) => {
    const b = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: m.wall });
    b.position.set(p[0], p[1], p[2]);
    b.quaternion.setFromEuler(0, ry, 0);
    world.addBody(b);
    return b;
  });
  const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: m.ground });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);
  return { walls: new Set(walls), ground };
}

interface RollResult {
  touchedWall: boolean;
  settleSeconds: number; // time until the LAST die has held rest for REST_HOLD_MS (what Die.tsx waits for)
  settled: boolean;
  displacement: number[]; // per die, in diameters, first ground contact -> rest
  outOfBounds: number;
}

function simulate(diceCount: number, rand: () => number, bounds: PlayBounds): RollResult {
  const { world, materials } = createPhysicsWorld();
  const { walls, ground } = addStatics(world, bounds, materials);
  const bodies = Array.from({ length: diceCount }, (_, i) => {
    const body = new CANNON.Body({
      mass: 1,
      material: materials.die,
      shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
      position: new CANNON.Vec3(...restSpawn(i, diceCount, bounds)),
      angularDamping: DIE_ANGULAR_DAMPING,
      linearDamping: DIE_LINEAR_DAMPING,
    });
    world.addBody(body);
    return body;
  });

  const firstContact = new Map<CANNON.Body, [number, number]>();
  let touchedWall = false;
  world.addEventListener('beginContact', (e: { bodyA: CANNON.Body; bodyB: CANNON.Body }) => {
    for (const [a, b] of [
      [e.bodyA, e.bodyB],
      [e.bodyB, e.bodyA],
    ]) {
      if (walls.has(a)) touchedWall = true;
      if (a === ground && !firstContact.has(b)) firstContact.set(b, [b.position.x, b.position.z]);
    }
  });

  bodies.forEach((b, i) => applyThrow(b, i, diceCount, bounds, rand));

  const restSince: (number | null)[] = bodies.map(() => null);
  const settledAt: (number | null)[] = bodies.map(() => null);
  let t = 0;
  while (t < MAX_SECONDS && settledAt.some((s) => s === null)) {
    world.step(DT);
    t += DT;
    bodies.forEach((b, i) => {
      if (settledAt[i] !== null) return;
      if (!isAtRest(b)) restSince[i] = null;
      else if (restSince[i] === null) restSince[i] = t;
      else if ((t - restSince[i]!) * 1000 > REST_HOLD_MS) settledAt[i] = t;
    });
  }

  const displacement = bodies.map((b) => {
    const from = firstContact.get(b) ?? [b.position.x, b.position.z];
    return Math.hypot(b.position.x - from[0], b.position.z - from[1]) / DIE_SIZE;
  });
  const outOfBounds = bodies.filter(
    (b) => Math.abs(b.position.x) > bounds.halfX || Math.abs(b.position.z - bounds.centerZ) > bounds.halfZ || b.position.y < 0
  ).length;
  const settled = settledAt.every((s) => s !== null);
  return {
    touchedWall,
    settled,
    settleSeconds: settled ? Math.max(...(settledAt as number[])) : MAX_SECONDS,
    displacement,
    outOfBounds,
  };
}

function run(diceCount: number, bounds: PlayBounds) {
  const rand = mulberry32(1234 + diceCount);
  const results = Array.from({ length: ROLLS }, () => simulate(diceCount, rand, bounds));
  const pct = (n: number) => (100 * n) / ROLLS;
  const times = results.map((r) => r.settleSeconds).sort((a, b) => a - b);
  const disp = results.flatMap((r) => r.displacement);
  return {
    noWallPct: pct(results.filter((r) => !r.touchedWall).length),
    settledFastPct: pct(results.filter((r) => r.settled && r.settleSeconds <= 3.5).length),
    p95: times[Math.floor(ROLLS * 0.95)],
    meanDisp: disp.reduce((a, b) => a + b, 0) / disp.length,
    outOfBounds: results.reduce((a, r) => a + r.outOfBounds, 0),
  };
}

// R1.8 for real: the wall rectangle (at floor level and at die-top height) must project
// inside the camera frame, otherwise a die at a wall is cut off.
function cornersInFrame(aspect: number, b: PlayBounds): number {
  let worst = 0;
  for (const y of [0, 1]) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const { nx, ny } = projectToNdc(sx * b.halfX, y, b.centerZ + sz * b.halfZ, aspect);
        worst = Math.max(worst, Math.abs(nx), Math.abs(ny));
      }
    }
  }
  return worst;
}

const checks: [string, boolean, string][] = [];
for (const aspect of ASPECTS) {
  const bounds: PlayBounds = computePlayArea(aspect);
  const one = run(1, bounds);
  const six = run(6, bounds);
  const widthDice = (2 * bounds.halfX) / DIE_SIZE;
  const frame = cornersInFrame(aspect, bounds);
  // Wide windows are shallow (little room to travel), so the travel bar is lower there.
  const minTravel = aspect >= 1 ? 1.5 : 2;
  const tag = `[aspect ${aspect}]`;
  checks.push(
    [`${tag} R1.2 width >= 6 dice`, widthDice >= 6, `${widthDice.toFixed(1)} dice, depth ${(2 * bounds.halfZ).toFixed(1)}`],
    [`${tag} R1.5 1 die: >=70% rolls w/o wall`, one.noWallPct >= 70, `${one.noWallPct.toFixed(0)}%`],
    [`${tag} R1.6 6 dice: >=90% at rest <=3.5s`, six.settledFastPct >= 90, `${six.settledFastPct.toFixed(0)}% (p95 ${six.p95.toFixed(2)}s)`],
    [`${tag} R1.7 mean travel >= ${minTravel} dice`, one.meanDisp >= minTravel, `1 die ${one.meanDisp.toFixed(2)}, 6 dice ${six.meanDisp.toFixed(2)}`],
    [`${tag} R1.8 no die out of bounds`, one.outOfBounds + six.outOfBounds === 0, `${one.outOfBounds + six.outOfBounds} out`],
    [`${tag} R1.8 walls inside camera frame`, frame <= 1, `max |ndc| ${frame.toFixed(3)}`],
  );
}

for (const [name, ok, value] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  —  ${value}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
