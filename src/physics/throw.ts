import type * as CANNON from 'cannon-es';

// Pure throw/rest logic shared by Die.tsx and scripts/simRolls.ts. No relative imports on
// purpose: Node runs the sim straight from the .ts files and can't resolve extensionless
// relative imports, so the play-area bounds are passed in instead of imported.
export interface PlayBounds {
  halfX: number;
  halfZ: number;
  centerZ: number;
}

export const REST_LINEAR_EPS = 0.06;
export const REST_ANGULAR_EPS = 0.12;
export const REST_HOLD_MS = 260;

// Damping lives here (not inline in Die.tsx) so the sim uses the exact same body tuning.
// cannon-es multiplies velocity by (1 - damping)^dt: keep both strictly below 1 or the sim goes NaN.
export const DIE_LINEAR_DAMPING = 0.1;
export const DIE_ANGULAR_DAMPING = 0.9;

const MAX_COLUMNS = 5;
const DIE_RADIUS = 0.5;

// Dice are laid out in rows of up to MAX_COLUMNS, centered on x = 0 (so one die starts in the
// middle, not at the left slot). Spacing leaves a die-width gap but shrinks on narrow areas.
function slot(index: number, count: number, bounds: PlayBounds) {
  const cols = Math.min(count, MAX_COLUMNS);
  const spacing = Math.min(1.5, (2 * bounds.halfX - 2 * (DIE_RADIUS + 0.3)) / Math.max(cols - 1, 1));
  return { x: ((index % cols) - (cols - 1) / 2) * spacing, row: Math.floor(index / cols) };
}

/** Position a die sits at before its first roll. */
export function restSpawn(index: number, count: number, bounds: PlayBounds): [number, number, number] {
  const { x, row } = slot(index, count, bounds);
  return [x, 1.6, bounds.centerZ - row * 1.5];
}

// Throw feel knobs. Dice start at the near (camera-side) edge and are launched across the
// table, rolling forward, so they travel instead of dropping in place. Tuned with
// scripts/simRolls.ts: the speed range scales with table depth so a short landscape table
// doesn't send every die into the far wall.
const THROW_SPEED_MIN = 5;
const THROW_SPEED_RANGE = 2;
const SPEED_DEPTH_REF = 4.5; // halfZ at which the speeds above apply unscaled
const SIDE_SPEED = 1.5;
const ROLL_SPIN_FACTOR = 0.6; // fraction of true rolling spin (v / r); <1 so dice also tumble
const RANDOM_SPIN = 8;

/**
 * Re-throw a die: start at the near edge (staggered in height and by row), random
 * orientation, a forward launch toward the table's center line plus matching roll spin.
 */
export function applyThrow(
  body: CANNON.Body,
  index: number,
  count: number,
  bounds: PlayBounds,
  rand: () => number = Math.random
) {
  const { x, row } = slot(index, count, bounds);
  const nearZ = bounds.centerZ + bounds.halfZ - (DIE_RADIUS + 0.7);
  body.position.set(
    x + (rand() - 0.5) * 0.4,
    1.3 + (index % MAX_COLUMNS) * 0.22 + rand() * 0.6,
    nearZ - row * 1.5 - rand() * 0.5
  );
  body.quaternion.setFromEuler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2);

  const speed = (THROW_SPEED_MIN + rand() * THROW_SPEED_RANGE) * Math.min(1, bounds.halfZ / SPEED_DEPTH_REF);
  const vx = -x * 0.25 + (rand() - 0.5) * SIDE_SPEED;
  body.velocity.set(vx, rand() * 1.5, -speed);
  const spin = (r: number) => (r - 0.5) * RANDOM_SPIN;
  body.angularVelocity.set(
    -(speed / DIE_RADIUS) * ROLL_SPIN_FACTOR + spin(rand()),
    spin(rand()),
    (vx / DIE_RADIUS) * ROLL_SPIN_FACTOR + spin(rand())
  );
  body.wakeUp();
}

export function isAtRest(body: CANNON.Body): boolean {
  return body.velocity.lengthSquared() < REST_LINEAR_EPS && body.angularVelocity.lengthSquared() < REST_ANGULAR_EPS;
}
