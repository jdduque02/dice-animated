import * as CANNON from 'cannon-es';

export interface PhysicsMaterials {
  die: CANNON.Material;
  ground: CANNON.Material;
  wall: CANNON.Material;
}

export function createPhysicsWorld(): { world: CANNON.World; materials: PhysicsMaterials } {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  const materials: PhysicsMaterials = {
    die: new CANNON.Material('die'),
    ground: new CANNON.Material('ground'),
    wall: new CANNON.Material('wall'),
  };

  // cannon-es's default (friction 0.3, restitution 0.3) makes dice "grab" each other
  // on contact instead of sliding/bouncing apart — with several dice rolling together
  // this reads as them jamming up and barely tumbling. Lower friction + a bit more
  // bounce keeps them separating and rolling freely when they collide.
  const dieDie = { friction: 0.15, restitution: 0.25 };
  // Table: grippy and dead, like felt/wood — dice tumble, then stop instead of skating or
  // pogo-ing. These two are the main "feel" knobs for how far a die travels after landing.
  const dieGround = { friction: 0.5, restitution: 0.2 };
  // Edge of the table: absorbs the hit instead of returning it. A bouncy wall is what makes
  // the area read as a box.
  const dieWall = { friction: 0.2, restitution: 0.1 };

  world.defaultContactMaterial.friction = dieDie.friction;
  world.defaultContactMaterial.restitution = dieDie.restitution;
  world.addContactMaterial(new CANNON.ContactMaterial(materials.die, materials.die, dieDie));
  world.addContactMaterial(new CANNON.ContactMaterial(materials.die, materials.ground, dieGround));
  world.addContactMaterial(new CANNON.ContactMaterial(materials.die, materials.wall, dieWall));
  return { world, materials };
}
