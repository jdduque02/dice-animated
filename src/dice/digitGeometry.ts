import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';

// Seven-segment layout, in a local unit roughly 0.36 wide x 0.9 tall, centered at origin,
// lying flat in the XY plane (faces +Z). Segment ids follow the classic 7-seg naming.
const T = 0.13; // segment thickness — thicker strokes stay legible even shrunk onto small faces
const HALF_W = 0.18; // half width of the digit body
const segments: Record<string, [number, number, number, number]> = {
  // [x0, y0, x1, y1] axis-aligned rectangle corners
  a: [-HALF_W, 0.42, HALF_W, 0.42 + T],
  g: [-HALF_W, -T / 2, HALF_W, T / 2],
  d: [-HALF_W, -0.42 - T, HALF_W, -0.42],
  f: [-HALF_W - T, 0.06, -HALF_W, 0.06 + 0.36],
  b: [HALF_W, 0.06, HALF_W + T, 0.06 + 0.36],
  e: [-HALF_W - T, -0.06 - 0.36, -HALF_W, -0.06],
  c: [HALF_W, -0.06 - 0.36, HALF_W + T, -0.06],
};

const DIGIT_SEGMENTS: Record<string, string[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'c', 'd'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
};

function segmentRect([x0, y0, x1, y1]: [number, number, number, number]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    x0, y0, 0, x1, y0, 0, x1, y1, 0,
    x0, y0, 0, x1, y1, 0, x0, y1, 0,
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1,
  ]), 2));
  return geometry;
}

/** Some digits (1, 3, 7, ...) only use segments on one side of the 7-seg grid — e.g. "1"
 * is just the two right-hand verticals — so their ink sits off-center within the
 * nominal cell even though the grid itself is symmetric. Recentering each glyph on its
 * own ink bounding box (instead of the grid) is what actually makes it look centered. */
function centerOnBoundingBox(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return geometry;
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  geometry.translate(-cx, -cy, 0);
  return geometry;
}

const digitCache = new Map<string, THREE.BufferGeometry>();

function buildDigitGeometry(digit: string): THREE.BufferGeometry {
  const cached = digitCache.get(digit);
  if (cached) return cached;
  const ids = DIGIT_SEGMENTS[digit] ?? [];
  const parts = ids.map((id) => segmentRect(segments[id]));
  const merged = mergeBufferGeometries(parts, false) ?? new THREE.BufferGeometry();
  centerOnBoundingBox(merged);
  digitCache.set(digit, merged);
  return merged;
}

/** Builds a flat, centered glyph (1 or 2 digits) for the given positive integer, facing +Z. */
// One scale per digit count, so "1", "12" and "100" all end up occupying roughly the
// same overall footprint instead of the glyphs overflowing as numbers get longer.
const MULTI_DIGIT_SCALE: Record<number, number> = { 2: 0.72, 3: 0.5, 4: 0.38 };

export function buildNumberGeometry(value: number): THREE.BufferGeometry {
  const str = String(value);
  if (str.length === 1) {
    return buildDigitGeometry(str).clone();
  }

  const DIGIT_WIDTH = HALF_W * 2 + T; // outer width of one digit
  const GAP = 0.06;
  const count = str.length;
  const scale = MULTI_DIGIT_SCALE[count] ?? 0.28;
  const totalWidth = (DIGIT_WIDTH * count + GAP * (count - 1)) * scale;
  const startX = -totalWidth / 2 + (DIGIT_WIDTH * scale) / 2;

  const parts = str.split('').map((ch, i) => {
    const g = buildDigitGeometry(ch).clone();
    const m = new THREE.Matrix4()
      .makeTranslation(startX + i * (DIGIT_WIDTH + GAP) * scale, 0, 0)
      .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
    g.applyMatrix4(m);
    return g;
  });

  return mergeBufferGeometries(parts, false) ?? new THREE.BufferGeometry();
}
