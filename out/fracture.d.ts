/// <reference types="@webgpu/types" />
/// <reference types="babylonjs" />
import { OM } from './ourmath.js';
import { TypedArrayBufferView } from './util.js';
declare abstract class Transform {
    readonly device: GPUDevice;
    protected readonly scene: BABYLON.Scene;
    constructor(scene: BABYLON.Scene);
    transform(original: BABYLON.Mesh, hit: BABYLON.PickingInfo): Promise<void>;
    protected abstract transformImpl(original: BABYLON.Mesh, hit: BABYLON.PickingInfo): Promise<void>;
}
export declare class TestTransform extends Transform {
    config: GPUBuffer;
    pipeline: GPUComputePipeline;
    layout: GPUBindGroupLayout;
    static Create(scene: BABYLON.Scene): Promise<TestTransform>;
    transformImpl(original: BABYLON.Mesh, hit: BABYLON.PickingInfo): Promise<void>;
}
export declare class FractureTransform extends Transform {
    fracPipeline: GPUComputePipeline;
    fracLayout: GPUBindGroupLayout;
    fracConfig: GPUBuffer;
    copyPipeline: GPUComputePipeline;
    copyLayout: GPUBindGroupLayout;
    copyConfig: GPUBuffer;
    proxPipeline: GPUComputePipeline;
    proxLayout: GPUBindGroupLayout;
    proxConfig: GPUBuffer;
    fractureCenter: Float32Array;
    cellBuffers: GPUBuffer[];
    arrtricells: Uint32Array;
    arrtris: Float32Array;
    buftricells: GPUBuffer;
    buftris: GPUBuffer;
    buftrioutcells: GPUBuffer;
    buftriout: GPUBuffer;
    bufnewoutcells: GPUBuffer;
    bufnewout: GPUBuffer;
    cellProxBuf: GPUBuffer;
    static Create(scene: BABYLON.Scene): Promise<FractureTransform>;
    transformImpl(original: BABYLON.Mesh, hit: BABYLON.PickingInfo): Promise<void>;
    doTransformCopyPerPlane(transform: OM.mat4x4): number;
    doFracture(vertsAsFloat4: Float32Array, transform: OM.mat4x4, pImpact: OM.vec3): Promise<{
        min: OM.vec3;
        max: OM.vec3;
        points: OM.vec3[];
        faces: OM.vec3[];
        position?: OM.vec3 | undefined;
        size?: OM.vec3 | undefined;
    }[]>;
    dispatchFracture(iteration: number, tricount: number): void;
    dispatchProx(tricount: number): void;
    outputToInput(): Promise<void>;
    makeBufferWithData(data: TypedArrayBufferView, desc: Omit<GPUBufferDescriptor, 'size'> & {
        size?: number;
    }): GPUBuffer;
    readbackBuffer(buffer: GPUBuffer): Promise<ArrayBuffer>;
}
export {};
