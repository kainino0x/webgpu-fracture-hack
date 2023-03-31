/// <reference types="babylonjs" />
/// <reference types="@webgpu/types" />

export function makeFragmentFromVertices(scene: BABYLON.Scene, name: string, positions: BABYLON.FloatArray) {
  const mesh = new BABYLON.Mesh(name, scene);
  {
    const vdata = new BABYLON.VertexData();
    // Set index data to 0,1,2,3,...
    vdata.indices = [...new Array(positions.length)].map((_, i) => i);
    vdata.positions = positions;
    vdata.applyToMesh(mesh);
  }
  makeIndependentPhysicsObject(scene, mesh);
  return mesh;
}

let material: BABYLON.StandardMaterial;

export function makeIndependentPhysicsObject(scene: BABYLON.Scene, mesh: BABYLON.Mesh) {
  if (!material) {
    material = new BABYLON.StandardMaterial("material", scene);
    material.diffuseColor = new BABYLON.Color3(1, 0, 0);
    material.backFaceCulling = false;
  }

  mesh.setParent(null);
  mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
    mesh,
    BABYLON.PhysicsImpostor.ConvexHullImpostor, // Or MeshImpostor?
    { mass: 1.0 },
    scene
  );
  mesh.material = material;
}
