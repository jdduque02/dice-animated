import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as CANNON from 'cannon-es';
import { createPhysicsWorld } from '../physics/world';
import { Ground } from './Ground';
import { Walls } from './Walls';
import { Die, DieHandle } from '../dice/Die';
import { DieInstanceConfig } from '../dice/types';
import { WoodBackground } from './WoodBackground';
import { CAMERA_FOV, CAMERA_Z, cameraHeightFor, computePlayArea, PlayArea } from '../physics/playArea';

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

// Re-fits camera height and play area whenever the canvas aspect changes (rotation, web
// window resize), so the walls always sit at the edge of what's visible.
function CameraRig({ onArea }: { onArea: (area: PlayArea) => void }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  useEffect(() => {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    camera.position.set(0, cameraHeightFor(aspect), CAMERA_Z);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    onArea(computePlayArea(aspect));
  }, [camera, aspect, onArea]);
  return null;
}

export const Scene = forwardRef<SceneHandle, SceneProps>(({ dice, onDieSettled }, ref) => {
  const { world, materials } = useMemo(() => createPhysicsWorld(), []);
  // Until the canvas reports its real size, assume a typical portrait phone canvas.
  const [area, setArea] = useState<PlayArea>(() => computePlayArea(0.6));
  const diceRefs = useRef(new Map<string, DieHandle | null>());

  useImperativeHandle(ref, () => ({
    rollAll: () => {
      diceRefs.current.forEach((handle) => handle?.roll());
    },
  }));

  return (
    // Near-top-down camera; its height and the play-area walls are fitted to the canvas
    // aspect by CameraRig (see playArea.ts).
    <Canvas camera={{ position: [0, cameraHeightFor(0.6), CAMERA_Z], fov: CAMERA_FOV }}>
      <CameraRig onArea={setArea} />
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
      <Ground world={world} material={materials.ground} />
      <Walls world={world} bounds={area} material={materials.wall} />
      {dice.map((die, i) => (
        <Die
          key={die.id}
          ref={(handle) => {
            diceRefs.current.set(die.id, handle);
          }}
          world={world}
          material={materials.die}
          type={die.type}
          color={die.color}
          faceStyle={die.faceStyle}
          spawnIndex={i}
          diceCount={dice.length}
          bounds={area}
          onSettled={(value) => onDieSettled(die.id, value)}
        />
      ))}
    </Canvas>
  );
});
