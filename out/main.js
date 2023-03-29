import { testTransform } from './fracture.js';
import { makeIndependentPhysicsObject } from './helper.js';
async function createScene(engine, canvas) {
    // Extract the GPUDevice
    const device = engine._device;
    // Setup basic scene
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera('camera1', 0, 1, 10, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    // Enable physics
    scene.enablePhysics(new BABYLON.Vector3(0, -10, 0), new BABYLON.AmmoJSPlugin());
    // Create ground collider
    const ground = BABYLON.MeshBuilder.CreateGround('ground1', { width: 6, height: 6, subdivisions: 2 }, scene);
    ground.physicsImpostor = new BABYLON.PhysicsImpostor(ground, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0.5, restitution: 0.7 }, scene);
    const cube1 = BABYLON.MeshBuilder.CreateBox('cube1', { size: 1 }, scene);
    cube1.position.y += 3;
    makeIndependentPhysicsObject(scene, cube1);
    cube1.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0.5, 0.5, 0.5));
    for (const node of breadthFirstTraverse(cube1)) {
        if (node.value instanceof GPUBuffer)
            console.log('found GPUBuffer at cube1.' + node.path.join('.'));
    }
    // (proof of concept) create another mesh from the same data
    setTimeout(() => {
        testTransform({ scene, device, original: cube1 });
    }, 1000);
    return scene;
}
function* breadthFirstTraverse(root) {
    const visited = new Set();
    const queue = [{ value: root, path: [] }];
    let node;
    while ((node = queue.shift())) {
        yield node;
        for (const [k, child] of Object.entries(node.value)) {
            if (!child || typeof child !== 'object')
                continue;
            if (child.buffer instanceof ArrayBuffer)
                continue;
            if (visited.has(child))
                continue;
            visited.add(child);
            queue.push({ value: child, path: [...node.path, k] });
        }
    }
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