/// <reference types="babylonjs" />
declare abstract class Transform {
    protected scene: BABYLON.Scene;
    protected device: GPUDevice;
    constructor(scene: BABYLON.Scene);
    abstract transform(original: BABYLON.Mesh): Promise<void>;
}
export declare class TestTransform extends Transform {
    constructor(scene: BABYLON.Scene);
    transform(original: BABYLON.Mesh): Promise<void>;
}
export {};
