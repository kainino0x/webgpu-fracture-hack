/// <reference types="babylonjs" />
const B = BABYLON;

async function createScene(engine, canvas) {
  // Setup basic scene
  const scene = new B.Scene(engine);
  const camera = new B.ArcRotateCamera('camera1', 0, 1, 10, B.Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  const light = new B.HemisphericLight('light1', new B.Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  // Enable physics
  scene.enablePhysics(new B.Vector3(0, -10, 0), new B.AmmoJSPlugin());

  // Create ground collider
  const ground = B.MeshBuilder.CreateGround('ground1', { width: 6, height: 6, subdivisions: 2 }, scene);
  ground.physicsImpostor = new B.PhysicsImpostor(
    ground,
    B.PhysicsImpostor.BoxImpostor,
    { mass: 0, friction: 0.5, restitution: 0.7 },
    scene
  );

  const cube1 = B.MeshBuilder.CreateBox('cube1', { size: 1 }, scene);
  cube1.position.y += 3;
  makeIndependentPhysicsObject(scene, cube1);
  cube1.physicsImpostor.setLinearVelocity(new B.Vector3(0.5, 0.5, 0.5));

  // (proof of concept) create another mesh from the same data
  setTimeout(() => {
    const vdata = new B.VertexData()
    vdata.indices = cube1.getIndices();
    vdata.positions = cube1.getVerticesData(B.VertexBuffer.PositionKind);
    vdata.normals = cube1.getVerticesData(B.VertexBuffer.NormalKind);
    const cube2 = new B.Mesh('cube2', scene);
    vdata.applyToMesh(cube2);

    cube2.position.y += 3;
    makeIndependentPhysicsObject(scene, cube2);
    cube2.physicsImpostor.setLinearVelocity(new B.Vector3(0.5, 0.5, 0.5));
  }, 1000);

  return scene;
}

function makeIndependentPhysicsObject(scene, mesh) {
  mesh.setParent(null);
  mesh.physicsImpostor = new B.PhysicsImpostor(mesh, B.PhysicsImpostor.MeshImpostor, { mass: 1.0 }, scene);
};

{
  await Ammo();

  const canvas = document.getElementById('renderCanvas');

  const engine = new B.WebGPUEngine(canvas);
  await engine.initAsync();
  window.addEventListener('resize', () => {
    engine.resize();
  });

  const scene = await createScene(engine, canvas);
  engine.runRenderLoop(() => {
    scene.render();
  });
}
