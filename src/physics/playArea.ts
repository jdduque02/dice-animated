// Play-area bounds derived from the real camera + canvas aspect, so the walled area fills
// the visible frame on any screen (portrait phone, rotated, wide web window) instead of
// being sized for the narrowest phone. Pure math, no imports: scripts/simRolls.ts runs it
// under Node straight from the .ts file.
//
// Camera sits at (0, H, CAMERA_Z) looking at the origin. The walls enclose the largest
// axis-aligned rectangle inside the frustum's footprint on the plane y = BOUNDS_PLANE_Y
// (roughly the top of a resting die, so a die against a wall still shows its top face).
// The footprint is a trapezoid (near edge narrower than far edge), so the rectangle's
// width is limited by the near corners; its depth is the near-to-far span.
export const CAMERA_FOV = 50;
export const CAMERA_Z = 2;
const BOUNDS_PLANE_Y = 1;
// Keep the walls a little inside the frame edge so a die at the wall isn't clipped.
const FRAME_MARGIN = 0.15;
// Camera height is chosen per aspect so the play area is ~this many dice wide (a d6 is 1
// unit). Narrow screens need a high camera to reach it; wide windows would otherwise get a
// huge area with tiny dice, so height is clamped.
const TARGET_WIDTH_DICE = 7.5;
const MIN_CAMERA_HEIGHT = 9;
const MAX_CAMERA_HEIGHT = 18;

export interface PlayArea {
  halfX: number;
  halfZ: number;
  /** The camera is tilted, so the area is not centered on z = 0. */
  centerZ: number;
}

const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360);

export function cameraHeightFor(aspect: number): number {
  const h = TARGET_WIDTH_DICE / (2 * TAN_HALF_FOV * aspect);
  return Math.min(MAX_CAMERA_HEIGHT, Math.max(MIN_CAMERA_HEIGHT, h));
}

// Camera basis for a camera at (0, H, CAMERA_Z) looking at the origin: forward f, and the
// screen-up vector u (right is always +x).
function basis(height: number) {
  const n = Math.hypot(height, CAMERA_Z);
  const fy = -height / n;
  const fz = -CAMERA_Z / n;
  return { fy, fz, uy: -fz, uz: fy };
}

/** World point where the ray through normalized screen coords (nx, ny) hits plane y. */
function rayHit(nx: number, ny: number, aspect: number, height: number, y: number) {
  const { fy, fz, uy, uz } = basis(height);
  const dx = nx * TAN_HALF_FOV * aspect;
  const dy = fy + ny * TAN_HALF_FOV * uy;
  const dz = fz + ny * TAN_HALF_FOV * uz;
  const s = (y - height) / dy;
  return { x: dx * s, z: CAMERA_Z + dz * s };
}

export function computePlayArea(aspect: number): PlayArea {
  const h = cameraHeightFor(aspect);
  const nearL = rayHit(-1, -1, aspect, h, BOUNDS_PLANE_Y);
  const farL = rayHit(-1, 1, aspect, h, BOUNDS_PLANE_Y);
  const zMax = nearL.z - FRAME_MARGIN;
  const zMin = farL.z + FRAME_MARGIN;
  return {
    halfX: Math.abs(nearL.x) - FRAME_MARGIN,
    halfZ: (zMax - zMin) / 2,
    centerZ: (zMax + zMin) / 2,
  };
}

/** Normalized screen coords (-1..1 inside the frame) of a world point. */
export function projectToNdc(x: number, y: number, z: number, aspect: number) {
  const height = cameraHeightFor(aspect);
  const { fy, fz, uy, uz } = basis(height);
  const vy = y - height;
  const vz = z - CAMERA_Z;
  const depth = vy * fy + vz * fz;
  return {
    nx: x / (depth * TAN_HALF_FOV * aspect),
    ny: (vy * uy + vz * uz) / (depth * TAN_HALF_FOV),
  };
}
