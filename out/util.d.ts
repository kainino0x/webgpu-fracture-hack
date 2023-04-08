export declare function assert(condition: boolean): asserts condition;
/** Round `n` up to the next multiple of `alignment` (inclusive). */
export declare function roundUp(n: number, alignment: number): number;
export declare type TypedArrayBufferView = Float32Array | Uint8Array | Uint32Array;
export declare function memcpy(src: {
    src: ArrayBuffer | TypedArrayBufferView;
    start?: number;
    length?: number;
}, dst: {
    dst: ArrayBuffer | TypedArrayBufferView;
    start?: number;
}): void;
export declare function breadthFirstTraverse(root: object): Generator<{
    value: object;
    path: string[];
}, void, unknown>;
