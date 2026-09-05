import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { DieAsset, getDieAsset, readDieValue, buildMixedIconOverlay, getFaceTransforms } from './dieAssets';
import { buildNumberGeometry } from './digitGeometry';
import { DieType, FaceStyle } from './types';
import { PLAY_HALF_X, PLAY_HALF_Z } from '../physics/playArea';

export type DieHandle = {
  roll: () => void;
};

interface DieProps {
  world: CANNON.World;
  type: DieType;
  color: string;
  faceStyle: FaceStyle;
  spawnIndex: number;
  onSettled: (value: number) => void;
}

const REST_LINEAR_EPS = 0.03;
const REST_ANGULAR_EPS = 0.05;
const REST_HOLD_MS = 260;

// Keep spawn/throw positions safely inside the invisible walls regardless of how many
// dice are on screen, so none of them spawn already outside the container. Wide enough
// that adjacent dice don't spawn already overlapping (a die is ~1 unit across) — they'd
// otherwise start the roll wedged into each other instead of tumbling freely.
const SPREAD_STEP_X = PLAY_HALF_X / 2.4;
function spreadX(index: number): number {
  return ((index % 5) - 2) * SPREAD_STEP_X;
}
// The play area is now much deeper than it is wide (see playArea.ts), so give throws a
// wide Z jitter too — otherwise every die would still land clustered near z=0, wasting
// most of that depth. Kept a bit inside the walls (not the full ±PLAY_HALF_Z) so dice
// don't routinely land right at the far edge, where perspective shrinks them the most.
const THROW_JITTER_Z = PLAY_HALF_Z * 0.65;

function contrastColor(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) || 0;
  const g = parseInt(c.substring(2, 4), 16) || 0;
  const b = parseInt(c.substring(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#f5f5f5';
}

/** One small textured plane per face that has a photo assigned — faces left blank
 * show the die's plain color instead. Kept as its own component because useLoader
 * must run unconditionally within it. */
function PhotoFaces({ asset, uris }: { asset: DieAsset; uris: (string | null)[] }) {
  const transforms = useMemo(() => getFaceTransforms(asset), [asset]);
  const entries = useMemo(
    () =>
      uris
        .map((uri, i) => (uri ? { uri, i } : null))
        .filter((e): e is { uri: string; i: number } => e !== null),
    [uris]
  );
  const urlsToLoad = useMemo(() => entries.map((e) => e.uri), [entries]);
  const textures = useLoader(THREE.TextureLoader, urlsToLoad) as unknown as THREE.Texture[];

  return (
    <>
      {entries.map((entry, idx) => {
        const t = transforms[entry.i];
        if (!t) return null;
        return (
          <mesh key={entry.i} position={t.position} quaternion={t.quaternion}>
            <planeGeometry args={[t.size, t.size]} />
            <meshStandardMaterial map={textures[idx]} transparent />
          </mesh>
        );
      })}
    </>
  );
}

export const Die = forwardRef<DieHandle, DieProps>(({ world, type, color, faceStyle, spawnIndex, onSettled }, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const labelGroupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<CANNON.Body | null>(null);
  const asset = useMemo(() => getDieAsset(type), [type]);
  const restSince = useRef<number | null>(null);
  const reported = useRef(false);
  // Dice with no real per-face numbering (d100) report a fresh random value each roll,
  // so it can't be baked into the mesh — it floats above the die as a billboard instead.
  // Seeded immediately (not left blank) so a freshly-placed d100 already shows a value,
  // same as every other die type does at rest before its first roll.
  const [rolledLabel, setRolledLabel] = useState<THREE.BufferGeometry | null>(() =>
    asset.randomRange ? buildNumberGeometry(readDieValue(asset, new THREE.Quaternion())) : null
  );

  useEffect(() => {
    const body = new CANNON.Body({
      mass: 1,
      shape: asset.shape,
      position: new CANNON.Vec3(spreadX(spawnIndex), 1.6, 0),
      angularDamping: 0.35,
      linearDamping: 0.15,
    });
    world.addBody(body);
    bodyRef.current = body;

    return () => {
      world.removeBody(body);
      bodyRef.current = null;
    };
  }, [world, asset]);

  useImperativeHandle(ref, () => ({
    roll: () => {
      const body = bodyRef.current;
      if (!body) return;
      reported.current = false;
      restSince.current = null;
      if (asset.randomRange) setRolledLabel(null);
      // Staggering the drop height by index (instead of every die starting from the
      // same band) spreads out when each one actually reaches the ground, so a bunch
      // of dice rolled together don't all land in the same instant and pile into each
      // other before they've had room to tumble.
      body.position.set(
        spreadX(spawnIndex) + (Math.random() - 0.5) * 0.6,
        1.3 + (spawnIndex % 5) * 0.22 + Math.random() * 0.6,
        (Math.random() - 0.5) * THROW_JITTER_Z
      );
      body.quaternion.setFromEuler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
      body.velocity.set((Math.random() - 0.5) * 2.5, Math.random() * 1.5, (Math.random() - 0.5) * 2.5);
      body.angularVelocity.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
      body.wakeUp();
    },
  }));

  useFrame((state) => {
    const body = bodyRef.current;
    const group = groupRef.current;
    if (!body || !group) return;

    group.position.set(body.position.x, body.position.y, body.position.z);
    group.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);

    if (labelGroupRef.current) {
      labelGroupRef.current.position.set(body.position.x, body.position.y + asset.boundingRadius + 0.4, body.position.z);
      labelGroupRef.current.quaternion.copy(state.camera.quaternion);
    }

    if (reported.current) return;

    const atRest =
      body.velocity.lengthSquared() < REST_LINEAR_EPS && body.angularVelocity.lengthSquared() < REST_ANGULAR_EPS;

    if (atRest) {
      if (restSince.current === null) restSince.current = state.clock.elapsedTime;
      else if ((state.clock.elapsedTime - restSince.current) * 1000 > REST_HOLD_MS) {
        reported.current = true;
        const value = readDieValue(asset, group.quaternion);
        if (asset.randomRange) setRolledLabel(buildNumberGeometry(value));
        onSettled(value);
      }
    } else {
      restSince.current = null;
    }
  });

  const overlayColor = contrastColor(color);
  const iconOverlayGeometry = useMemo(
    () => (faceStyle.kind === 'icon' ? buildMixedIconOverlay(asset, faceStyle.icons) : null),
    [asset, faceStyle]
  );

  return (
    <>
      <group ref={groupRef}>
        <mesh geometry={asset.renderGeometry ?? asset.geometry}>
          {/* Glossy "premium plastic" finish: clearcoat adds a thin lacquer-like
              highlight layer on top of the base color, like the reference dice photos. */}
          <meshPhysicalMaterial color={color} roughness={0.32} metalness={0.05} clearcoat={1} clearcoatRoughness={0.15} />
        </mesh>

        {!asset.randomRange && faceStyle.kind === 'numbers' && (
          <mesh geometry={asset.overlayGeometry}>
            <meshPhysicalMaterial color={overlayColor} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.25} />
          </mesh>
        )}
        {!asset.randomRange && faceStyle.kind === 'pips' && (
          <mesh geometry={asset.pipOverlayGeometry}>
            <meshPhysicalMaterial color={overlayColor} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.25} />
          </mesh>
        )}
        {!asset.randomRange && faceStyle.kind === 'icon' && iconOverlayGeometry && (
          <mesh geometry={iconOverlayGeometry}>
            <meshPhysicalMaterial color={overlayColor} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.25} />
          </mesh>
        )}
        {!asset.randomRange && faceStyle.kind === 'photo' && <PhotoFaces asset={asset} uris={faceStyle.uris} />}
      </group>

      {asset.randomRange && rolledLabel && (
        <group ref={labelGroupRef}>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[0.85, 0.55]} />
            <meshBasicMaterial color="#111111" transparent opacity={0.75} />
          </mesh>
          <mesh geometry={rolledLabel} scale={0.7}>
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      )}
    </>
  );
});
