import { useEffect } from 'react';
import * as CANNON from 'cannon-es';
import type { PlayBounds } from '../physics/throw';

// Invisible static side walls (no mesh — physics only) that keep rolling dice fully
// inside the visible play area instead of tumbling off past the camera's view. No
// ceiling: gravity always brings a die back down, and a hard ceiling made tumbling
// throws feel capped/artificial. Bounds come from the camera/aspect — see playArea.ts.
function wallConfigs({ halfX, halfZ, centerZ }: PlayBounds) {
  return [
    { position: [halfX, 0, 0], rotationY: -Math.PI / 2 },
    { position: [-halfX, 0, 0], rotationY: Math.PI / 2 },
    { position: [0, 0, centerZ + halfZ], rotationY: Math.PI },
    { position: [0, 0, centerZ - halfZ], rotationY: 0 },
  ] as const;
}

export function Walls({ world, bounds, material }: { world: CANNON.World; bounds: PlayBounds; material: CANNON.Material }) {
  useEffect(() => {
    const bodies = wallConfigs(bounds).map(({ position, rotationY }) => {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material });
      body.position.set(position[0], position[1], position[2]);
      body.quaternion.setFromEuler(0, rotationY, 0);
      world.addBody(body);
      return body;
    });

    return () => {
      bodies.forEach((b) => world.removeBody(b));
    };
  }, [world, bounds.halfX, bounds.halfZ, bounds.centerZ, material]);

  return null;
}
