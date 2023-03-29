/// <reference types="babylonjs" />
export const B = BABYLON;

export function makeIndependentPhysicsObject(scene: BABYLON.Scene, mesh: BABYLON.Mesh) {
  mesh.setParent(null);
  mesh.physicsImpostor = new B.PhysicsImpostor(
    mesh,
    B.PhysicsImpostor.MeshImpostor,
    { mass: 1.0 },
    scene
  );
}
