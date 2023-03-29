/// <reference types="babylonjs" />
export function makeIndependentPhysicsObject(scene: BABYLON.Scene, mesh: BABYLON.Mesh) {
  mesh.setParent(null);
  mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
    mesh,
    BABYLON.PhysicsImpostor.MeshImpostor,
    { mass: 1.0 },
    scene
  );
}
