import { useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Asset } from 'expo-asset';

const woodAsset = Asset.fromModule(require('../../assets/wood-bg.jpg'));

export function WoodBackground() {
  const texture = useLoader(THREE.TextureLoader, woodAsset.uri);

  useEffect(() => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);

  return <primitive attach="background" object={texture} />;
}
