/// <reference types="babylonjs" />
import { OM } from './ourmath.js';
export declare function makeFragmentFromVertices(scene: BABYLON.Scene, { original, cellIndex, relCenter, positions, }: {
    original: BABYLON.Mesh;
    cellIndex: number;
    relCenter: OM.vec3;
    positions: BABYLON.FloatArray;
}): BABYLON.Mesh;
export declare function makeOriginalFromVertices(scene: BABYLON.Scene, name: string, positions: Float32Array): BABYLON.Mesh;
export declare function makeIndependentPhysicsObject(scene: BABYLON.Scene, mesh: BABYLON.Mesh): void;
