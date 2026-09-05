import { useEffect } from 'react';
import * as CANNON from 'cannon-es';

export function Ground({ world }: { world: CANNON.World }) {
  useEffect(() => {
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(body);
    return () => {
      world.removeBody(body);
    };
  }, [world]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#2e7d32" />
    </mesh>
  );
}
