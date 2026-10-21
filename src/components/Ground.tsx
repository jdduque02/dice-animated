import { useEffect } from 'react';
import * as CANNON from 'cannon-es';

export function Ground({ world, material }: { world: CANNON.World; material: CANNON.Material }) {
  useEffect(() => {
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material,
    });
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(body);
    return () => {
      world.removeBody(body);
    };
  }, [world, material]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      {/* Big enough to fill the frame at the highest camera on any aspect. */}
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial color="#2e7d32" />
    </mesh>
  );
}
