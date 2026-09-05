import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Converts a triangulated convex BufferGeometry into a CANNON.ConvexPolyhedron,
 * deduplicating vertices when the geometry isn't indexed (e.g. hull-generated
 * geometries produce a vertex triple per triangle with no shared indices).
 */
export function bufferGeometryToConvex(geometry: THREE.BufferGeometry): CANNON.ConvexPolyhedron {
  const position = geometry.attributes.position;
  const index = geometry.index;

  const vertices: CANNON.Vec3[] = [];
  const faces: number[][] = [];

  if (index) {
    for (let i = 0; i < position.count; i++) {
      vertices.push(new CANNON.Vec3(position.getX(i), position.getY(i), position.getZ(i)));
    }
    for (let t = 0; t < index.count; t += 3) {
      faces.push([index.getX(t), index.getX(t + 1), index.getX(t + 2)]);
    }
  } else {
    const keyOf = (x: number, y: number, z: number) =>
      `${x.toFixed(5)}|${y.toFixed(5)}|${z.toFixed(5)}`;
    const indexOfKey = new Map<string, number>();

    const resolve = (i: number): number => {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const key = keyOf(x, y, z);
      let idx = indexOfKey.get(key);
      if (idx === undefined) {
        idx = vertices.length;
        vertices.push(new CANNON.Vec3(x, y, z));
        indexOfKey.set(key, idx);
      }
      return idx;
    };

    for (let t = 0; t < position.count; t += 3) {
      faces.push([resolve(t), resolve(t + 1), resolve(t + 2)]);
    }
  }

  return new CANNON.ConvexPolyhedron({ vertices, faces });
}
