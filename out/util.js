// Utilities copied from gpuweb/cts
export function assert(condition) {
    if (!condition) {
        throw new Error();
    }
}
/** Round `n` up to the next multiple of `alignment` (inclusive). */
export function roundUp(n, alignment) {
    assert(Number.isInteger(n) && n >= 0);
    assert(Number.isInteger(alignment) && alignment > 0);
    return Math.ceil(n / alignment) * alignment;
}
function subarrayAsU8(buf, { start = 0, length }) {
    if (buf instanceof ArrayBuffer) {
        return new Uint8Array(buf, start, length);
    }
    else if (buf instanceof Uint8Array || buf instanceof Uint8ClampedArray) {
        // Don't wrap in new views if we don't need to.
        if (start === 0 && (length === undefined || length === buf.byteLength)) {
            return buf;
        }
    }
    const byteOffset = buf.byteOffset + start * buf.BYTES_PER_ELEMENT;
    const byteLength = length !== undefined
        ? length * buf.BYTES_PER_ELEMENT
        : buf.byteLength - (byteOffset - buf.byteOffset);
    return new Uint8Array(buf.buffer, byteOffset, byteLength);
}
export function memcpy(src, dst) {
    subarrayAsU8(dst.dst, dst).set(subarrayAsU8(src.src, src));
}
//# sourceMappingURL=util.js.map