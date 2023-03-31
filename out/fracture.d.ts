/// <reference types="babylonjs" />
declare abstract class Transform {
    protected scene: BABYLON.Scene;
    protected device: GPUDevice;
    constructor(scene: BABYLON.Scene);
    abstract transform(original: BABYLON.Mesh): Promise<void>;
}
export declare class TestTransform extends Transform {
    config: GPUBuffer;
    pipeline: GPUComputePipeline;
    layout: GPUBindGroupLayout;
    static Create(scene: BABYLON.Scene): Promise<TestTransform>;
    transform(original: BABYLON.Mesh): Promise<void>;
}
export {};
