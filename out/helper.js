/// <reference types="babylonjs" />
export function makeIndependentPhysicsObject(scene, mesh) {
    mesh.setParent(null);
    mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, BABYLON.PhysicsImpostor.MeshImpostor, { mass: 1.0 }, scene);
}
//# sourceMappingURL=helper.js.map