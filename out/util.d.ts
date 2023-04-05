export declare function assert(condition: boolean): asserts condition;
export declare type TypedArrayBufferView = Float32Array | Uint8Array | Int32Array;
export declare function memcpy(src: {
    src: ArrayBuffer | TypedArrayBufferView;
    start?: number;
    length?: number;
}, dst: {
    dst: ArrayBuffer | TypedArrayBufferView;
    start?: number;
}): void;
