import { useEffect } from 'react';
import * as CANNON from 'cannon-es';
import { PLAY_HALF_X, PLAY_HALF_Z } from '../physics/playArea';

// Invisible static side walls (no mesh — physics only) that keep rolling dice fully
// inside the visible play area instead of tumbling off past the camera's view. No
// ceiling: gravity always brings a die back down, and a hard ceiling made tumbling
// throws feel capped/artificial. Rectangular, not square — see playArea.ts for why.
const WALL_CONFIGS: { position: [number, number, number]; rotationX: number; rotationY: number }[] = [
  { position: [PLAY_HALF_X, 0, 0], rotationX: 0, rotationY: -Math.PI / 2 },
  { position: [-PLAY_HALF_X, 0, 0], rotationX: 0, rotationY: Math.PI / 2 },
  { position: [0, 0, PLAY_HALF_Z], rotationX: 0, rotationY: Math.PI },
  { position: [0, 0, -PLAY_HALF_Z], rotationX: 0, rotationY: 0 },
];

export function Walls({ world }: { world: CANNON.World }) {
  useEffect(() => {
    const bodies = WALL_CONFIGS.map(({ position, rotationX, rotationY }) => {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
      body.position.set(...position);
      body.quaternion.setFromEuler(rotationX, rotationY, 0);
      world.addBody(body);
      return body;
    });

    return () => {
      bodies.forEach((b) => world.removeBody(b));
    };
  }, [world]);

  return null;
}
