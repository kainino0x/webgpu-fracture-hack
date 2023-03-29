/// <reference types="babylonjs" />
export const B = BABYLON;
export function makeIndependentPhysicsObject(scene, mesh) {
    mesh.setParent(null);
    mesh.physicsImpostor = new B.PhysicsImpostor(mesh, B.PhysicsImpostor.MeshImpostor, { mass: 1.0 }, scene);
}
//# sourceMappingURL=helper.js.map