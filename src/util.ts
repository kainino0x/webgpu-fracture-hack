// Utilities copied from gpuweb/cts

export function assert(condition: boolean): asserts condition {
  if (!condition) {
    throw new Error();
  }
}

/** Round `n` up to the next multiple of `alignment` (inclusive). */
export function roundUp(n: number, alignment: number): number {
  assert(Number.isInteger(n) && n >= 0);
  assert(Number.isInteger(alignment) && alignment > 0);
  return Math.ceil(n / alignment) * alignment;
}

export type TypedArrayBufferView =
  // expand as needed
  Float32Array | Uint8Array | Uint32Array;

function subarrayAsU8(
  buf: ArrayBuffer | TypedArrayBufferView,
  { start = 0, length }: { start?: number; length?: number }
): Uint8Array | Uint8ClampedArray {
  if (buf instanceof ArrayBuffer) {
    return new Uint8Array(buf, start, length);
  } else if (buf instanceof Uint8Array || buf instanceof Uint8ClampedArray) {
    // Don't wrap in new views if we don't need to.
    if (start === 0 && (length === undefined || length === buf.byteLength)) {
      return buf;
    }
  }
  const byteOffset = buf.byteOffset + start * buf.BYTES_PER_ELEMENT;
  const byteLength =
    length !== undefined
      ? length * buf.BYTES_PER_ELEMENT
      : buf.byteLength - (byteOffset - buf.byteOffset);
  return new Uint8Array(buf.buffer, byteOffset, byteLength);
}

export function memcpy(
  src: { src: ArrayBuffer | TypedArrayBufferView; start?: number; length?: number },
  dst: { dst: ArrayBuffer | TypedArrayBufferView; start?: number }
): void {
  subarrayAsU8(dst.dst, dst).set(subarrayAsU8(src.src, src));
}

export function* breadthFirstTraverse(root: object) {
  const visited = new Set();
  const queue = [{ value: root, path: [] as string[] }];
  let node;
  while ((node = queue.shift())) {
    yield node;

    for (const [k, child] of Object.entries(node.value)) {
      if (!child || typeof child !== 'object') continue;
      if (child.buffer instanceof ArrayBuffer) continue;

      if (visited.has(child)) continue;
      visited.add(child);

      queue.push({ value: child, path: [...node.path, k] });
    }
  }
}
