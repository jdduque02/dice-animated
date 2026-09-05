import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ConvexGeometry, RoundedBoxGeometry, mergeBufferGeometries } from 'three-stdlib';
import { DieType, DIE_SIDES, IconType } from './types';
import { computeFaceGroups } from './faceGroups';
import { assignNumbers } from './numbering';
import { buildNumberGeometry } from './digitGeometry';
import { buildPipGeometry } from './pipGeometry';
import { getIconGeometry } from './iconGeometry';
import { bufferGeometryToConvex } from './convex';

export interface DieFaceValue {
  normal: THREE.Vector3;
  value: number;
}

export interface FaceLayout {
  normal: THREE.Vector3;
  center: THREE.Vector3;
  innerRadius: number;
}

export interface DieAsset {
  type: DieType;
  geometry: THREE.BufferGeometry;
  /** Cosmetic-only alternate geometry for the visible shell (e.g. a rounded-corner d6) —
   * purely decorative, kept separate from `geometry` so physics, face detection, and
   * numbering all keep working off the true flat-faced shape. Falls back to `geometry`
   * when a die type has no rounded variant. */
  renderGeometry?: THREE.BufferGeometry;
  shape: CANNON.Shape;
  /** Default overlay: the per-face numbers. */
  overlayGeometry: THREE.BufferGeometry;
  /** Classic 1-6 dot overlay — only meaningful when the die has 6 or fewer faces
   * (there's no canonical pip layout past 6), otherwise empty. */
  pipOverlayGeometry: THREE.BufferGeometry;
  /** Positions/orientations of the numbered faces, reusable to build alternate
   * overlays (icons, photos) that sit in exactly the same spots as the numbers. */
  faceLayout: FaceLayout[];
  faceValues: DieFaceValue[];
  boundingRadius: number;
  /** d4 has no face pointing away from a resting position; read its result from the
   * downward-facing (table-touching) face instead of the upward one. */
  readFromBelow: boolean;
  /** For dice with no real per-face numbering (d100): roll a random value in this
   * range instead of reading the resting face's orientation. */
  randomRange?: [number, number];
}

const BOX_HALF = 0.5;

/**
 * Builds a pentagonal trapezohedron (the true d10 shape) as the polar dual of a
 * pentagonal antiprism. Dual points of a polyhedron's faces are, by construction,
 * exactly coplanar whenever they shared a common original vertex — which is exactly
 * what guarantees the 10 kite faces come out perfectly flat (unlike guessing raw
 * vertex coordinates directly, which produced 20 slightly-warped triangles instead
 * of 10 clean kites).
 */
function buildD10Geometry(): THREE.BufferGeometry {
  const n = 5;
  const ringRadius = 1;
  // 0.9 balances the pentagon-cap faces against the belt-triangle faces (both end up
  // ~0.9 units from the origin) so all 12 dual points land at roughly the same
  // distance — a "round" d10. A smaller ringHeight (e.g. 0.5) makes the cap faces
  // much closer to the origin than the belt, which inflates their dual points far
  // past the rest of the shape (the die was coming out roughly 2x oversized/spiky).
  const ringHeight = 0.9;

  const idxU = (i: number) => ((i % n) + n) % n;
  const idxL = (i: number) => n + idxU(i);

  const verts: THREE.Vector3[] = [];
  for (let k = 0; k < n; k++) {
    const a1 = (k * 2 * Math.PI) / n;
    verts.push(new THREE.Vector3(Math.cos(a1) * ringRadius, Math.sin(a1) * ringRadius, ringHeight));
  }
  for (let k = 0; k < n; k++) {
    const a2 = (k * 2 * Math.PI) / n + Math.PI / n;
    verts.push(new THREE.Vector3(Math.cos(a2) * ringRadius, Math.sin(a2) * ringRadius, -ringHeight));
  }

  const faces: number[][] = [];
  faces.push([idxU(0), idxU(1), idxU(2), idxU(3), idxU(4)]); // top pentagon
  faces.push([idxL(4), idxL(3), idxL(2), idxL(1), idxL(0)]); // bottom pentagon
  for (let k = 0; k < n; k++) {
    faces.push([idxU(k), idxU(k + 1), idxL(k)]);
    faces.push([idxL(k), idxU(k + 1), idxL(k + 1)]);
  }

  const origin = new THREE.Vector3(0, 0, 0);
  const dualPoints = faces.map((f) => {
    const p0 = verts[f[0]];
    const p1 = verts[f[1]];
    const p2 = verts[f[2]];
    const normal = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0)).normalize();
    const faceCenter = f
      .reduce((acc, i) => acc.add(verts[i]), new THREE.Vector3())
      .divideScalar(f.length);
    if (normal.dot(faceCenter.clone().sub(origin)) < 0) normal.negate();
    const distance = normal.dot(faceCenter);
    return normal.multiplyScalar(0.82 / distance);
  });

  return new ConvexGeometry(dualPoints) as unknown as THREE.BufferGeometry;
}

/** Triangulates arbitrary (convex, planar) polygon faces into an indexed BufferGeometry,
 * auto-correcting winding so every triangle's normal points away from the shape's centroid. */
function facesToGeometry(verts: THREE.Vector3[], faces: number[][]): THREE.BufferGeometry {
  const centroid = verts.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(verts.length);
  const positions: number[] = [];
  verts.forEach((v) => positions.push(v.x, v.y, v.z));
  const indices: number[] = [];

  for (const face of faces) {
    for (let i = 1; i < face.length - 1; i++) {
      let a = face[0];
      let b = face[i];
      let c = face[i + 1];
      const pa = verts[a];
      const pb = verts[b];
      const pc = verts[c];
      const normal = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3().subVectors(pc, pa));
      const faceCenter = new THREE.Vector3().add(pa).add(pb).add(pc).divideScalar(3);
      if (normal.dot(faceCenter.clone().sub(centroid)) < 0) {
        const tmp = b;
        b = c;
        c = tmp;
      }
      indices.push(a, b, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A d5 as real tabletop "long dice" are made: a pentagonal prism (the 5 numbered
 * side faces) capped with two pyramids. The pointed caps make it physically unstable
 * to rest on, so it always settles on one of the 5 flat numbered sides.
 */
function buildD5Geometry(): THREE.BufferGeometry {
  const n = 5;
  const radius = 0.5;
  const halfHeight = 0.32;
  const capHeight = 0.55;

  const idx = (i: number) => ((i % n) + n) % n;
  const topRing: THREE.Vector3[] = [];
  const bottomRing: THREE.Vector3[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k * 2 * Math.PI) / n;
    topRing.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, halfHeight));
    bottomRing.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, -halfHeight));
  }
  const topApex = new THREE.Vector3(0, 0, halfHeight + capHeight);
  const bottomApex = new THREE.Vector3(0, 0, -halfHeight - capHeight);

  const verts = [...topRing, ...bottomRing, topApex, bottomApex];
  const topApexIdx = n * 2;
  const bottomApexIdx = n * 2 + 1;
  const T = (i: number) => idx(i);
  const B = (i: number) => n + idx(i);

  const faces: number[][] = [];
  for (let k = 0; k < n; k++) faces.push([T(k), T(k + 1), B(k + 1), B(k)]);
  for (let k = 0; k < n; k++) faces.push([topApexIdx, T(k), T(k + 1)]);
  for (let k = 0; k < n; k++) faces.push([bottomApexIdx, B(k + 1), B(k)]);

  return facesToGeometry(verts, faces);
}

function createBaseGeometry(type: DieType): THREE.BufferGeometry {
  switch (type) {
    case 'd4':
      return new THREE.TetrahedronGeometry(0.68);
    case 'd5':
      return buildD5Geometry();
    case 'd6':
      return new THREE.BoxGeometry(BOX_HALF * 2, BOX_HALF * 2, BOX_HALF * 2);
    case 'd8':
      return new THREE.OctahedronGeometry(0.62);
    case 'd12':
      // Bigger than a "proportional" dodecahedron would be: with 12 faces packed onto
      // a small sphere each face (and its number) reads tiny. Real d12/d20 dice are
      // usually noticeably larger than a d6 for exactly this reason.
      return new THREE.DodecahedronGeometry(0.8);
    case 'd20':
      return new THREE.IcosahedronGeometry(0.86);
    case 'd10':
    case 'd100':
      return buildD10Geometry();
  }
}

function faceBasis(normal: THREE.Vector3): THREE.Matrix4 {
  const reference = Math.abs(normal.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3().crossVectors(reference, normal).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  return new THREE.Matrix4().makeBasis(tangent, bitangent, normal);
}

export interface FaceTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  size: number;
}

/** Per-face position/orientation/size, for placing individual objects (e.g. a photo
 * plane) on each numbered face — the same spots buildFaceOverlay uses for glyphs. */
export function getFaceTransforms(asset: DieAsset): FaceTransform[] {
  return asset.faceLayout.map((face) => {
    const basis = faceBasis(face.normal);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
    const position = face.center.clone().addScaledVector(face.normal, 0.015);
    return { position, quaternion, size: face.innerRadius * 1.5 };
  });
}

/** Places one glyph (from `glyphAt`) on every face in `layout` that returns one (a null
 * skips that face, leaving it blank), merged into a single mesh. `fitFactor` is the
 * fraction of the face's inner radius the glyph is scaled to — smaller leaves more
 * margin around the edges. */
function buildFaceOverlay(
  layout: FaceLayout[],
  glyphAt: (index: number) => THREE.BufferGeometry | null,
  fitFactor: number = 0.94
): THREE.BufferGeometry {
  if (layout.length === 0) return new THREE.BufferGeometry();
  const parts: THREE.BufferGeometry[] = [];
  layout.forEach((face, i) => {
    const glyph = glyphAt(i);
    if (!glyph) return;
    const scale = face.innerRadius * fitFactor;
    const basis = faceBasis(face.normal);
    const offsetCenter = face.center.clone().addScaledVector(face.normal, 0.015);

    const m = basis.clone();
    m.setPosition(offsetCenter);
    m.multiply(new THREE.Matrix4().makeScale(scale, scale, scale));

    glyph.applyMatrix4(m);
    parts.push(glyph);
  });
  if (parts.length === 0) return new THREE.BufferGeometry();
  return mergeBufferGeometries(parts, false) ?? new THREE.BufferGeometry();
}

/** Builds an overlay with a possibly different icon per face (or no icon at all on a
 * face left blank) — lets a die mix e.g. 4 "dark" faces, 2 "light" faces, or one
 * outlier icon among a run of the same icon. Not cached: the combination is
 * per-die-instance, not per-die-type. */
export function buildMixedIconOverlay(asset: DieAsset, icons: (IconType | null)[]): THREE.BufferGeometry {
  return buildFaceOverlay(asset.faceLayout, (i) => {
    const icon = icons[i];
    return icon ? getIconGeometry(icon).clone() : null;
  });
}

function buildDieAsset(type: DieType): DieAsset {
  const geometry = createBaseGeometry(type);
  geometry.computeBoundingSphere();
  const boundingRadius = geometry.boundingSphere?.radius ?? 0.6;

  // Purely cosmetic rounded shell for the cube — kept flat-faced BoxGeometry (`geometry`)
  // for physics/face-detection, since RoundedBoxGeometry's bevel makes every triangle's
  // normal subtly different, which would fragment computeFaceGroups' coplanar clustering.
  const renderGeometry =
    type === 'd6' ? new RoundedBoxGeometry(BOX_HALF * 2, BOX_HALF * 2, BOX_HALF * 2, 4, 0.07) : undefined;

  const shape: CANNON.Shape =
    type === 'd6'
      ? new CANNON.Box(new CANNON.Vec3(BOX_HALF, BOX_HALF, BOX_HALF))
      : bufferGeometryToConvex(geometry);

  // d100 has no real per-face labels — it looks like a d10 but reports a random 1-100.
  if (type === 'd100') {
    return {
      type,
      geometry,
      renderGeometry,
      shape,
      overlayGeometry: new THREE.BufferGeometry(),
      pipOverlayGeometry: new THREE.BufferGeometry(),
      faceLayout: [],
      faceValues: [],
      boundingRadius,
      readFromBelow: false,
      randomRange: [1, 100],
    };
  }

  const allGroups = computeFaceGroups(geometry);
  // d5 is a numbered prism with two blank pyramid caps — only the near-equatorial
  // faces (small |normal.z|) are the 5 numbered sides; the caps are excluded entirely.
  const numberedGroups = type === 'd5' ? allGroups.filter((g) => Math.abs(g.normal.z) < 0.4) : allGroups;

  if (__DEV__ && numberedGroups.length !== DIE_SIDES[type]) {
    console.warn(`[dados] ${type}: se esperaban ${DIE_SIDES[type]} caras y se detectaron ${numberedGroups.length}`);
  }

  const numbers =
    type === 'd5'
      ? numberedGroups
          .slice()
          .sort((a, b) => Math.atan2(a.normal.y, a.normal.x) - Math.atan2(b.normal.y, b.normal.x))
          .map((_, i) => i + 1)
      : assignNumbers(numberedGroups);
  const orderedGroups = type === 'd5'
    ? numberedGroups.slice().sort((a, b) => Math.atan2(a.normal.y, a.normal.x) - Math.atan2(b.normal.y, b.normal.x))
    : numberedGroups;

  const faceLayout: FaceLayout[] = orderedGroups.map((g) => ({
    normal: g.normal.clone(),
    center: g.center.clone(),
    innerRadius: g.innerRadius,
  }));
  // d6's square faces have room to run numbers close to the edge; the narrower
  // triangular/kite/pentagon faces on the other dice need more breathing room so the
  // glyph doesn't crowd or poke past the face boundary.
  const numberFit = type === 'd6' ? 0.94 : 0.68;
  const overlayGeometry = buildFaceOverlay(faceLayout, (i) => buildNumberGeometry(numbers[i]), numberFit);
  // Pips only have a canonical look up to 6 dots — leave larger dice (d8+) with an
  // empty pip overlay rather than silently drawing nothing for out-of-range values.
  const pipOverlayGeometry =
    DIE_SIDES[type] <= 6 ? buildFaceOverlay(faceLayout, (i) => buildPipGeometry(numbers[i])) : new THREE.BufferGeometry();
  const faceValues: DieFaceValue[] = orderedGroups.map((g, i) => ({ normal: g.normal.clone(), value: numbers[i] }));

  return {
    type,
    geometry,
    renderGeometry,
    shape,
    overlayGeometry,
    pipOverlayGeometry,
    faceLayout,
    faceValues,
    boundingRadius,
    readFromBelow: type === 'd4',
  };
}

const cache = new Map<DieType, DieAsset>();

export function getDieAsset(type: DieType): DieAsset {
  let asset = cache.get(type);
  if (!asset) {
    asset = buildDieAsset(type);
    cache.set(type, asset);
  }
  return asset;
}

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

/** Reads the value currently facing up (or down, for d4) given the body's world quaternion,
 * or rolls a fresh random value for dice with no real per-face numbering (d100). */
export function readDieValue(asset: DieAsset, quaternion: THREE.Quaternion): number {
  if (asset.randomRange) {
    const [min, max] = asset.randomRange;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  const target = asset.readFromBelow ? DOWN : UP;
  const n = new THREE.Vector3();
  let best = asset.faceValues[0];
  let bestDot = -Infinity;
  for (const face of asset.faceValues) {
    n.copy(face.normal).applyQuaternion(quaternion);
    const dot = n.dot(target);
    if (dot > bestDot) {
      bestDot = dot;
      best = face;
    }
  }
  return best.value;
}
