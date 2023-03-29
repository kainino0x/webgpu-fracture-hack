import { makeIndependentPhysicsObject } from './helper.js';
export function testTransform({ scene, device, original, }) {
    const origIndices = original.getIndices();
    const origPositions = original.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    //const origNormals = original.getVerticesData(B.VertexBuffer.NormalKind);
    let idx = 0;
    const half = Math.floor(origIndices.length / 2);
    for (let start = 0; start < origIndices.length; start += half) {
        const vdata = new BABYLON.VertexData();
        vdata.indices = origIndices.slice(start, start + half);
        vdata.positions = origPositions;
        const mesh = new BABYLON.Mesh(`${original.name}.${idx++}`, scene);
        vdata.applyToMesh(mesh);
        mesh.position = original.position;
        makeIndependentPhysicsObject(scene, mesh);
    }
    original.dispose();
}
//# sourceMappingURL=fracture.js.map