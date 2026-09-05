import * as THREE from 'three';

export interface FaceGroup {
  normal: THREE.Vector3;
  center: THREE.Vector3;
  /** Distance from the face center to its closest vertex — a safe "inscribed radius" for fitting a decal. */
  innerRadius: number;
  triangleIndices: number[];
}

const NORMAL_MATCH_COS = 1 - 1e-3;

/**
 * Groups the triangles of a (triangulated) BufferGeometry into logical polygon
 * faces by clustering triangles that share (almost) the same normal direction.
 * Works for any convex polyhedron regardless of how its triangles are indexed/wound.
 */
export function computeFaceGroups(geometry: THREE.BufferGeometry): FaceGroup[] {
  const position = geometry.attributes.position;
  const index = geometry.index;
  const triangleCount = index ? index.count / 3 : position.count / 3;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const groups: FaceGroup[] = [];

  for (let t = 0; t < triangleCount; t++) {
    let i0: number, i1: number, i2: number;
    if (index) {
      i0 = index.getX(t * 3);
      i1 = index.getX(t * 3 + 1);
      i2 = index.getX(t * 3 + 2);
    } else {
      i0 = t * 3;
      i1 = t * 3 + 1;
      i2 = t * 3 + 2;
    }
    a.fromBufferAttribute(position, i0);
    b.fromBufferAttribute(position, i1);
    c.fromBufferAttribute(position, i2);

    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const center = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);

    let group = groups.find((g) => g.normal.dot(normal) > NORMAL_MATCH_COS);
    if (!group) {
      group = { normal, center: new THREE.Vector3(), innerRadius: Infinity, triangleIndices: [] };
      groups.push(group);
    }
    group.triangleIndices.push(t);
    group.center.add(center);
  }

  // Second pass: finalize centers, then compute a safe inner radius per group.
  groups.forEach((g) => g.center.divideScalar(g.triangleIndices.length));

  for (const g of groups) {
    for (const t of g.triangleIndices) {
      let i0: number, i1: number, i2: number;
      if (index) {
        i0 = index.getX(t * 3);
        i1 = index.getX(t * 3 + 1);
        i2 = index.getX(t * 3 + 2);
      } else {
        i0 = t * 3;
        i1 = t * 3 + 1;
        i2 = t * 3 + 2;
      }
      for (const i of [i0, i1, i2]) {
        a.fromBufferAttribute(position, i);
        const d = a.distanceTo(g.center);
        if (d < g.innerRadius) g.innerRadius = d;
      }
    }
  }

  return groups;
}
