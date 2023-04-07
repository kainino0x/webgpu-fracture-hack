import { FractureTransform } from './fracture.js';
import { makeOriginalFromVertices } from './helper.js';
async function createScene(engine, canvas) {
    // Setup basic scene
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera('camera1', -0.5, 1, 20, BABYLON.Vector3.Zero(), scene);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 200;
    camera.attachControl(canvas, true);
    const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    // Enable physics
    scene.enablePhysics(new BABYLON.Vector3(0, -10, 0), new BABYLON.AmmoJSPlugin(false));
    scene.getPhysicsEngine().setTimeStep(1 / 60 / 4); // Slow physics
    // Create ground collider
    const ground = BABYLON.MeshBuilder.CreateGround('ground1', { width: 12, height: 12, subdivisions: 0 }, scene);
    ground.physicsImpostor = new BABYLON.PhysicsImpostor(ground, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0.5, restitution: 0.7 }, scene);
    const cubePositions = 
    /* prettier-ignore */ new Float32Array([
        -1, -1, -1, -1, 1, 1, -1, -1, 1,
        1, 1, -1, -1, 1, -1, -1, -1, -1,
        1, -1, 1, 1, -1, -1, -1, -1, -1,
        1, 1, -1, -1, -1, -1, 1, -1, -1,
        -1, -1, -1, -1, 1, -1, -1, 1, 1,
        1, -1, 1, -1, -1, -1, -1, -1, 1,
        -1, 1, 1, 1, -1, 1, -1, -1, 1,
        1, 1, 1, 1, 1, -1, 1, -1, -1,
        1, -1, -1, 1, -1, 1, 1, 1, 1,
        1, 1, 1, -1, 1, -1, 1, 1, -1,
        1, 1, 1, -1, 1, 1, -1, 1, -1,
        1, 1, 1, 1, -1, 1, -1, 1, 1,
    ]);
    const orig = makeOriginalFromVertices(scene, 'cube', cubePositions);
    orig.position.y += 1;
    orig.rotate(new BABYLON.Vector3(1, 1, 1), 1);
    orig.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, 5, 0));
    orig.physicsImpostor.setAngularVelocity(new BABYLON.Vector3(0, 4, 0));
    //for (const node of breadthFirstTraverse(cube)) {
    //  if (node.value instanceof GPUBuffer) {
    //    console.log('found GPUBuffer at cube.' + node.path.join('.'));
    //  }
    //}
    const transformer = await FractureTransform.Create(scene);
    setTimeout(() => {
        void transformer.transform(orig);
    }, 1000);
    return scene;
}
{
    await Ammo();
    const canvas = document.getElementById('renderCanvas');
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
//# sourceMappingURL=main.js.map