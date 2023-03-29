import { B, makeIndependentPhysicsObject } from './helper.js';

export function testTransform({
  scene,
  device,
  original,
}: {
  scene: BABYLON.Scene;
  device: GPUDevice;
  original: BABYLON.Mesh;
}): void {
  const origIndices = original.getIndices()!;
  const origPositions = original.getVerticesData(B.VertexBuffer.PositionKind)!;
  //const origNormals = original.getVerticesData(B.VertexBuffer.NormalKind);

  let idx = 0;
  const half = Math.floor(origIndices.length / 2);
  for (let start = 0; start < origIndices.length; start += half) {
    const vdata = new B.VertexData();
    vdata.indices = origIndices.slice(start, start + half)
    vdata.positions = origPositions;
    const mesh = new B.Mesh(`${original.name}.${idx++}`, scene);
    vdata.applyToMesh(mesh);
    mesh.position = original.position;
    makeIndependentPhysicsObject(scene, mesh);
  }

  original.dispose();
}
