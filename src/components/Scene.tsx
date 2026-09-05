import { Canvas, useFrame } from '@react-three/fiber';
import { forwardRef, Suspense, useImperativeHandle, useMemo, useRef } from 'react';
import * as CANNON from 'cannon-es';
import { createPhysicsWorld } from '../physics/world';
import { Ground } from './Ground';
import { Walls } from './Walls';
import { Die, DieHandle } from '../dice/Die';
import { DieInstanceConfig } from '../dice/types';
import { WoodBackground } from './WoodBackground';

export type SceneHandle = {
  rollAll: () => void;
};

interface SceneProps {
  dice: DieInstanceConfig[];
  onDieSettled: (id: string, value: number) => void;
}

function PhysicsStepper({ world }: { world: CANNON.World }) {
  useFrame((_, delta) => {
    world.step(1 / 60, Math.min(delta, 1 / 30), 3);
  });
  return null;
}

export const Scene = forwardRef<SceneHandle, SceneProps>(({ dice, onDieSettled }, ref) => {
  const world = useMemo(() => createPhysicsWorld(), []);
  const diceRefs = useRef(new Map<string, DieHandle | null>());

  useImperativeHandle(ref, () => ({
    rollAll: () => {
      diceRefs.current.forEach((handle) => handle?.roll());
    },
  }));

  return (
    // Steeper, closer-to-top-down angle than a "natural" 3D shot: computed (via
    // THREE.Camera.project against the play area's corners, for the narrowest phone
    // aspect ratios) so the whole walled play area — including a die bouncing near a
    // corner — stays inside the visible frustum. See Walls.tsx for the matching bounds.
    <Canvas camera={{ position: [0, 10, 2], fov: 50 }}>
      <Suspense fallback={<color attach="background" args={['#3e2417']} />}>
        <WoodBackground />
      </Suspense>
      {/* Key + cool fill + warm rim: gives the glossy dice material something to
          reflect from multiple angles instead of one flat directional light. */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.1} />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} color="#bcd7ff" />
      <pointLight position={[0, 3, 4]} intensity={0.4} color="#fff5e0" />
      <PhysicsStepper world={world} />
      <Ground world={world} />
      <Walls world={world} />
      {dice.map((die, i) => (
        <Die
          key={die.id}
          ref={(handle) => {
            diceRefs.current.set(die.id, handle);
          }}
          world={world}
          type={die.type}
          color={die.color}
          faceStyle={die.faceStyle}
          spawnIndex={i}
          onSettled={(value) => onDieSettled(die.id, value)}
        />
      ))}
    </Canvas>
  );
});
