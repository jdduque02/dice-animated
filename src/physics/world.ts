import * as CANNON from 'cannon-es';

export function createPhysicsWorld(): CANNON.World {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  // cannon-es's default (friction 0.3, restitution 0.3) makes dice "grab" each other
  // on contact instead of sliding/bouncing apart — with several dice rolling together
  // this reads as them jamming up and barely tumbling. Lower friction + a bit more
  // bounce keeps them separating and rolling freely when they collide.
  world.defaultContactMaterial.friction = 0.15;
  world.defaultContactMaterial.restitution = 0.4;
  return world;
}
