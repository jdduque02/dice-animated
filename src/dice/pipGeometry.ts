import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';

// Classic 1-6 dot layouts, in the same "flat, centered, faces +Z" local unit space as
// digitGeometry.ts, so pips slot into buildFaceOverlay exactly like numbers/icons do.
const GRID = 0.3;
const PIP_RADIUS = 0.11;

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-1, 1],
    [1, -1],
  ],
  3: [
    [-1, 1],
    [0, 0],
    [1, -1],
  ],
  4: [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ],
  5: [
    [-1, 1],
    [1, 1],
    [0, 0],
    [-1, -1],
    [1, -1],
  ],
  6: [
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [1, 1],
    [1, 0],
    [1, -1],
  ],
};

function buildPipDot(): THREE.BufferGeometry {
  // Flat decal, same convention as the number/icon overlays — faces +Z, no depth.
  return new THREE.CircleGeometry(PIP_RADIUS, 24);
}

const pipCache = new Map<number, THREE.BufferGeometry>();

/** Builds a flat, centered pip-dot glyph (1-6 raised dots) for the given face value,
 * facing +Z — same convention as buildNumberGeometry. Values outside 1-6 have no
 * classic dot layout and return an empty geometry (callers should restrict pip mode
 * to dice with 6 or fewer faces). */
export function buildPipGeometry(value: number): THREE.BufferGeometry {
  const cached = pipCache.get(value);
  if (cached) return cached.clone();

  const layout = PIP_LAYOUTS[value];
  if (!layout) return new THREE.BufferGeometry();

  const dots = layout.map(([gx, gy]) => {
    const dot = buildPipDot();
    dot.translate(gx * GRID, gy * GRID, 0);
    return dot;
  });
  const merged = mergeBufferGeometries(dots, false) ?? new THREE.BufferGeometry();
  pipCache.set(value, merged);
  return merged.clone();
}
