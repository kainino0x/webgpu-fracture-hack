import { TestTransform } from './fracture.js';
import { makeFragmentFromVertices } from './helper.js';

async function createScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement) {
  // Setup basic scene
  const scene = new BABYLON.Scene(engine);
  const camera = new BABYLON.ArcRotateCamera('camera1', -0.5, 1, 20, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  // Enable physics
  scene.enablePhysics(new BABYLON.Vector3(0, -10, 0), new BABYLON.AmmoJSPlugin());

  // Create ground collider
  const ground = BABYLON.MeshBuilder.CreateGround(
    'ground1',
    { width: 12, height: 12, subdivisions: 0 },
    scene
  );
  ground.physicsImpostor = new BABYLON.PhysicsImpostor(
    ground,
    BABYLON.PhysicsImpostor.BoxImpostor,
    { mass: 0, friction: 0.5, restitution: 0.7 },
    scene
  );

  const cubePositions =
    /* prettier-ignore */ new Float32Array([
    -1,-1,-1,   -1, 1, 1,   -1,-1, 1,
     1, 1,-1,   -1, 1,-1,   -1,-1,-1,
     1,-1, 1,    1,-1,-1,   -1,-1,-1,
     1, 1,-1,   -1,-1,-1,    1,-1,-1,
    -1,-1,-1,   -1, 1,-1,   -1, 1, 1,
     1,-1, 1,   -1,-1,-1,   -1,-1, 1,
    -1, 1, 1,    1,-1, 1,   -1,-1, 1,
     1, 1, 1,    1, 1,-1,    1,-1,-1,
     1,-1,-1,    1,-1, 1,    1, 1, 1,
     1, 1, 1,   -1, 1,-1,    1, 1,-1,
     1, 1, 1,   -1, 1, 1,   -1, 1,-1,
     1, 1, 1,    1,-1, 1,   -1, 1, 1,
  ]);
  const cube = makeFragmentFromVertices(scene, 'cube', cubePositions);
  cube.position.y += 3;
  cube.physicsImpostor!.setLinearVelocity(new BABYLON.Vector3(0.5, 0.5, 0.5));
  for (const node of breadthFirstTraverse(cube)) {
    if (node.value instanceof GPUBuffer)
      console.log('found GPUBuffer at cube.' + node.path.join('.'));
  }

  // (proof of concept) create another mesh from the same data
  const tt = await TestTransform.Create(scene);
  setTimeout(() => {
    void tt.transform(cube);
  }, 1000);

  return scene;
}

function* breadthFirstTraverse(root: object) {
  const visited = new Set();
  const queue = [{ value: root, path: [] as string[] }];
  let node;
  while ((node = queue.shift())) {
    yield node;

    for (const [k, child] of Object.entries(node.value)) {
      if (!child || typeof child !== 'object') continue;
      if (child.buffer instanceof ArrayBuffer) continue;

      if (visited.has(child)) continue;
      visited.add(child);

      queue.push({ value: child, path: [...node.path, k] });
    }
  }
}

declare const Ammo: any;
{
  await Ammo();

  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

  const engine = new BABYLON.WebGPUEngine(canvas);
  await engine.initAsync();
  window.addEventListener('resize', () => {
    engine.resize();
  });

  const scene = await createScene(engine, canvas);
  engine.runRenderLoop(() => {
    scene.render();
  });
}
