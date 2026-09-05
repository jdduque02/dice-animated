const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pnpm links packages via symlinks; without this, Metro can resolve the same
// physical module (e.g. "three", pulled in both directly and via three-stdlib)
// through two different symlink paths and treat them as separate instances.
config.resolver.unstable_enableSymlinks = true;

// Expo's default config turns this ON — we explicitly turn it back OFF.
// three's package.json exports map points "import" and "require" at two
// different physical files (three.module.js vs three.cjs). With package-exports
// resolution on, some importers (ESM-style `import * as THREE`) resolve one
// file while others (CJS `require('three')`, used internally by
// @react-three/fiber/three-stdlib) resolve the other — bundling BOTH copies of
// the whole library as unrelated modules with incompatible classes (two
// different THREE.Vector3, etc). That was the real cause of the "Multiple
// instances of Three.js" warning, and likely of downstream bugs (normals/
// quaternions built from mismatched THREE instances silently failing to
// interoperate). Classic (non-exports) resolution picks one file consistently
// for every importer, avoiding the split entirely.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
