import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import { IconType } from './types';

// Icons are authored on an ~84-unit design canvas (SVG-style, Y-down); this scales
// them into the same rough footprint as the digit glyphs and flips Y to match our
// (Y-up) overlay space.
const ICON_SCALE = 1 / 84;

/** Mirroring on one axis (our Y-flip below) reverses every triangle's winding order,
 * which makes three.js back-face-cull the whole mesh — it's still "there" (valid,
 * non-empty geometry) but the GPU never draws it. Swapping each triangle's last two
 * indices restores the original winding after the mirror. */
function fixMirroredWinding(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const index = geometry.getIndex();
  if (!index) return geometry;
  const arr = index.array as unknown as number[];
  for (let i = 0; i + 2 < arr.length; i += 3) {
    const tmp = arr[i + 1];
    arr[i + 1] = arr[i + 2];
    arr[i + 2] = tmp;
  }
  index.needsUpdate = true;
  return geometry;
}

function shapesToGeometry(shapes: THREE.Shape[]): THREE.BufferGeometry {
  const parts = shapes.map((s) => new THREE.ShapeGeometry(s));
  const merged = (parts.length === 1 ? parts[0] : mergeBufferGeometries(parts, false)) ?? new THREE.BufferGeometry();
  merged.scale(ICON_SCALE, -ICON_SCALE, ICON_SCALE);
  return fixMirroredWinding(merged);
}

function shapeToGeometry(shape: THREE.Shape): THREE.BufferGeometry {
  return shapesToGeometry([shape]);
}

function buildSkull(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -38);
  shape.bezierCurveTo(22, -38, 34, -22, 34, -4);
  shape.bezierCurveTo(34, 10, 28, 18, 24, 26);
  shape.lineTo(24, 34);
  shape.bezierCurveTo(24, 38, 20, 40, 16, 40);
  shape.lineTo(16, 32);
  shape.lineTo(8, 32);
  shape.lineTo(8, 40);
  shape.lineTo(-8, 40);
  shape.lineTo(-8, 32);
  shape.lineTo(-16, 32);
  shape.lineTo(-16, 40);
  shape.bezierCurveTo(-20, 40, -24, 38, -24, 34);
  shape.lineTo(-24, 26);
  shape.bezierCurveTo(-28, 18, -34, 10, -34, -4);
  shape.bezierCurveTo(-34, -22, -22, -38, 0, -38);
  shape.closePath();

  const leftEye = new THREE.Path();
  leftEye.absarc(-14, -4, 9, 0, Math.PI * 2, true);
  const rightEye = new THREE.Path();
  rightEye.absarc(14, -4, 9, 0, Math.PI * 2, true);
  const nose = new THREE.Path();
  nose.moveTo(0, 4);
  nose.lineTo(-6, 18);
  nose.lineTo(6, 18);
  nose.closePath();
  shape.holes.push(leftEye, rightEye, nose);

  return shapeToGeometry(shape);
}

function buildFire(): THREE.BufferGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(0, -40);
  outer.bezierCurveTo(10, -20, 28, -14, 28, 10);
  outer.bezierCurveTo(28, 28, 15, 42, 0, 42);
  outer.bezierCurveTo(-15, 42, -28, 28, -28, 10);
  outer.bezierCurveTo(-28, -2, -20, -6, -18, -16);
  outer.bezierCurveTo(-12, -4, -6, -2, -6, -10);
  outer.bezierCurveTo(-6, -20, -8, -28, 0, -40);
  outer.closePath();

  const inner = new THREE.Path();
  inner.moveTo(0, -6);
  inner.bezierCurveTo(6, 4, 10, 10, 10, 18);
  inner.bezierCurveTo(10, 26, 5, 32, 0, 32);
  inner.bezierCurveTo(-5, 32, -10, 26, -10, 18);
  inner.bezierCurveTo(-10, 12, -6, 10, -4, 4);
  inner.bezierCurveTo(-2, 8, 0, 6, 0, -6);
  inner.closePath();
  outer.holes.push(inner);

  return shapeToGeometry(outer);
}

function buildWater(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -42);
  shape.bezierCurveTo(16, -18, 30, 4, 30, 20);
  shape.bezierCurveTo(30, 34, 17, 44, 0, 44);
  shape.bezierCurveTo(-17, 44, -30, 34, -30, 20);
  shape.bezierCurveTo(-30, 4, -16, -18, 0, -42);
  shape.closePath();
  return shapeToGeometry(shape);
}

/** Punches a thin ribbon-shaped hole along a polyline — used to carve "meridian"
 * grooves through the earth icon's disc without needing a second material color. */
function bandHole(points: [number, number][]): THREE.Path {
  const width = 3;
  const top: THREE.Vector2[] = [];
  const bottom: THREE.Vector2[] = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    const [px, py] = points[Math.max(0, i - 1)];
    const [nx2, ny2] = points[Math.min(points.length - 1, i + 1)];
    const dx = nx2 - px;
    const dy = ny2 - py;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * width;
    const ny = (dx / len) * width;
    top.push(new THREE.Vector2(x + nx, y + ny));
    bottom.push(new THREE.Vector2(x - nx, y - ny));
  }
  const path = new THREE.Path();
  path.moveTo(top[0].x, top[0].y);
  top.slice(1).forEach((p) => path.lineTo(p.x, p.y));
  bottom
    .slice()
    .reverse()
    .forEach((p) => path.lineTo(p.x, p.y));
  path.closePath();
  return path;
}

function buildEarth(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 38, 0, Math.PI * 2, false);

  const bands: [number, number][][] = [
    [
      [-38, 0],
      [-20, -10],
      [-10, -4],
      [0, 2],
      [8, -2],
      [20, 2],
      [30, 5],
      [38, 0],
    ],
    [
      [-30, -22],
      [-20, -16],
      [-14, -24],
      [-2, -20],
      [6, -17],
      [14, -26],
      [26, -20],
    ],
    [
      [-26, 24],
      [-16, 18],
      [-8, 28],
      [4, 22],
      [14, 17],
      [22, 26],
      [32, 20],
    ],
  ];
  bands.forEach((pts) => shape.holes.push(bandHole(pts)));

  return shapeToGeometry(shape);
}

/** Sun — a disc with 8 rays. Rays are simple axis-independent rectangles, so this
 * always yields valid geometry (no curve-intersection risk). */
function buildLight(): THREE.BufferGeometry {
  const disc = new THREE.Shape();
  disc.absarc(0, 0, 18, 0, Math.PI * 2, false);

  const innerR = 24;
  const outerR = 40;
  const halfWidth = 4;
  const rays: THREE.Shape[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const px = -sin * halfWidth;
    const py = cos * halfWidth;
    const ray = new THREE.Shape();
    ray.moveTo(cos * innerR + px, sin * innerR + py);
    ray.lineTo(cos * outerR + px, sin * outerR + py);
    ray.lineTo(cos * outerR - px, sin * outerR - py);
    ray.lineTo(cos * innerR - px, sin * innerR - py);
    ray.closePath();
    rays.push(ray);
  }

  return shapesToGeometry([disc, ...rays]);
}

/** Crescent moon — a disc with an off-center hole entirely contained inside it (never
 * crossing the outer boundary), which keeps the triangulation always valid. */
function buildDark(): THREE.BufferGeometry {
  const outer = new THREE.Shape();
  outer.absarc(0, 0, 36, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(7, 0, 28, 0, Math.PI * 2, true);
  outer.holes.push(hole);
  return shapeToGeometry(outer);
}

function ellipseShape(cx: number, cy: number, rx: number, ry: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0);
  return s;
}

function triangleShape(points: [number, number][]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return s;
}

/** Cat — round head with two pointed ears. */
function buildCat(): THREE.BufferGeometry {
  const head = ellipseShape(0, -2, 28, 28);
  const earL = triangleShape([
    [-28, -14],
    [-12, -36],
    [-4, -14],
  ]);
  const earR = triangleShape([
    [28, -14],
    [12, -36],
    [4, -14],
  ]);
  return shapesToGeometry([head, earL, earR]);
}

/** Dog — round head, two drooping oval ears, a rounded snout. */
function buildDog(): THREE.BufferGeometry {
  const head = ellipseShape(0, -4, 26, 26);
  const earL = ellipseShape(-27, 4, 10, 22);
  const earR = ellipseShape(27, 4, 10, 22);
  const snout = ellipseShape(0, 20, 15, 11);
  return shapesToGeometry([head, earL, earR, snout]);
}

/** Bird — oval body, round head, triangular beak and tail. The wing is a hole cut
 * into the body so it reads as a wing instead of just fattening the silhouette. */
function buildBird(): THREE.BufferGeometry {
  const body = ellipseShape(-2, 10, 24, 20);
  const head = ellipseShape(18, -14, 14, 14);
  const beak = triangleShape([
    [30, -14],
    [42, -10],
    [30, -6],
  ]);
  const tail = triangleShape([
    [-24, 16],
    [-40, 26],
    [-22, 4],
  ]);
  const wingHole = new THREE.Path();
  wingHole.absellipse(-8, 6, 12, 8, 0, Math.PI * 2, false, 0);
  body.holes.push(wingHole);
  return shapesToGeometry([body, head, beak, tail]);
}

/** Fish — oval body, triangular tail fin and dorsal fin. */
function buildFish(): THREE.BufferGeometry {
  const body = ellipseShape(-6, 0, 26, 17);
  const tail = triangleShape([
    [20, 0],
    [40, -14],
    [40, 14],
  ]);
  const dorsalFin = triangleShape([
    [-10, -17],
    [0, -30],
    [8, -17],
  ]);
  return shapesToGeometry([body, tail, dorsalFin]);
}

const BUILDERS: Record<IconType, () => THREE.BufferGeometry> = {
  skull: buildSkull,
  fire: buildFire,
  water: buildWater,
  earth: buildEarth,
  light: buildLight,
  dark: buildDark,
  cat: buildCat,
  dog: buildDog,
  bird: buildBird,
  fish: buildFish,
};

const cache = new Map<IconType, THREE.BufferGeometry>();

export function getIconGeometry(icon: IconType): THREE.BufferGeometry {
  let geo = cache.get(icon);
  if (!geo) {
    geo = BUILDERS[icon]();
    cache.set(icon, geo);
  }
  return geo;
}
