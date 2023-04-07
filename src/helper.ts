// @webgpu/types must be first, or babylonjs's definitions of the WebGPU types
// will take precedent (and they're not as strict).
/// <reference types="@webgpu/types" />
/// <reference types="babylonjs" />

import { OM } from './ourmath.js';

export function makeFragmentFromVertices(
  scene: BABYLON.Scene,
  {
    original,
    cellIndex,
    relCenter,
    positions,
  }: {
    original: BABYLON.Mesh;
    cellIndex: number;
    relCenter: OM.vec3;
    positions: BABYLON.FloatArray;
  }
) {
  const mesh = new BABYLON.Mesh(`${original.name}.${cellIndex}`, scene);
  {
    const vdata = new BABYLON.VertexData();
    // Set index data to 0,1,2,3,...
    vdata.indices = [...new Array(positions.length)].map((_, i) => i);
    vdata.positions = positions;
    vdata.applyToMesh(mesh);
  }
  makeIndependentPhysicsObject(scene, mesh);
  {
    const origP = original.physicsImpostor!;
    const meshP = mesh.physicsImpostor!;
    const relCenterB = new BABYLON.Vector3(...relCenter);

    mesh.position = original.position.add(relCenterB);

    const origLV = origP.getLinearVelocity()!;
    const origAV = origP.getAngularVelocity()!;
    meshP.setAngularVelocity(origAV);
    meshP.setLinearVelocity(origLV.add(origAV.cross(relCenterB)));
  }
  return mesh;
}

export function makeOriginalFromVertices(
  scene: BABYLON.Scene,
  name: string,
  positions: Float32Array
) {
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
    material = new BABYLON.StandardMaterial('material', scene);
    material.diffuseColor = new BABYLON.Color3(1, 0, 0);
    material.backFaceCulling = false;
  }

  mesh.setParent(null);
  mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
    mesh,
    BABYLON.PhysicsImpostor.ConvexHullImpostor, // Or MeshImpostor? needed if using the prox kernel
    { mass: 1.0 },
    scene
  );
  mesh.material = material;
}
