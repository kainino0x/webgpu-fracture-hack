/// <reference types="babylonjs" />
export function makeFragmentFromVertices(scene, name, positions) {
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
export function makeIndependentPhysicsObject(scene, mesh) {
    mesh.setParent(null);
    mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, BABYLON.PhysicsImpostor.ConvexHullImpostor, // Or MeshImpostor?
    { mass: 1.0 }, scene);
}
//# sourceMappingURL=helper.js.map