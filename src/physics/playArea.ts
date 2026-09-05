// Shared play-area bounds, kept in sync with the camera in Scene.tsx. Computed against
// the actual camera frustum (via THREE.Camera.project on the ground's corners, for the
// narrowest common phone aspect ratios) so the walled play area fills the visible frame
// with only ~2% margin. See Walls.tsx (uses these for the physical walls) and Scene.tsx
// (the matching camera position/fov).
//
// The area is rectangular, not square: this camera's near-top-down-but-tilted angle
// maps world X and world Z to screen space at very different scales (screen aspect is
// tall/narrow, ~0.45), so a square region that fills the screen's width leaves most of
// its height empty. Filling both means the play area must be deeper (Z) than it is
// wide (X) by roughly that same ratio. One side effect: a die that lands deep in Z
// reads noticeably smaller on screen than one near the camera — an inherent trade-off
// of using the full frame instead of a safely-uniform-sized square.
// These two aren't independent: a wall's real limit is its far CORNER (combining both
// X and Z), which the camera's perspective projects non-linearly — pushing X out also
// pushes that corner's projected Y, and vice versa. 1.83 is the most X can grow before
// it starts forcing Z back down at all; past that point every bit of extra width costs
// much more depth than it gains (at X=1.93 the safe depth collapses to just ~1.7).
export const PLAY_HALF_X = 1.83;
export const PLAY_HALF_Z = 4.35;
