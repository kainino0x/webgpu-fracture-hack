import { kFracturePattern } from './fracture_pattern.js';
import { makeFragmentFromVertices } from './helper.js';
import { OM } from './ourmath.js';
import { assert, memcpy } from './util.js';
const kFracConfigSize = 24;
const kCopyConfigSize = 16 * 4 + 4 + 4;
const kProxConfigSize = 4;
const kShaderCode = /* wgsl */ `
@group(0) @binding(1) var<storage, read> inPoints: array<f32>;
@group(0) @binding(2) var<storage, read_write> outTriExists: array<u32>;
@group(0) @binding(3) var<storage, read_write> outPoints: array<f32>;

@compute @workgroup_size(1) // TODO: increase
fn testTransform(
  @builtin(global_invocation_id) outTriIdxXYZ: vec3<u32>,
) {
  let outTriIdx = outTriIdxXYZ.x;
  let numInTris = arrayLength(&inPoints) / 9;
  let inTriIdx = outTriIdx % numInTris;
  let cellIdx = outTriIdx / numInTris;

  if (cellIdx == 0) == (inTriIdx < numInTris / 2) {
    outTriExists[outTriIdx] = 1;
    for (var offset = 0u; offset < 9; offset++) {
      outPoints[outTriIdx * 9 + offset] = inPoints[inTriIdx * 9 + offset];
    }
  }
}

@compute @workgroup_size(1)
fn fracture() {}

@compute @workgroup_size(1)
fn applyProximity() {}

@compute @workgroup_size(1)
fn transformCopyPerPlane() {}
`;
const shaderModuleForDevice = new WeakMap();
function getShaderModuleForDevice(device) {
    const existing = shaderModuleForDevice.get(device);
    if (existing)
        return existing;
    const created = device.createShaderModule({ code: kShaderCode });
    shaderModuleForDevice.set(device, created);
    return created;
}
class Transform {
    device;
    scene;
    constructor(scene) {
        this.scene = scene;
        this.device = scene.getEngine()._device;
        this.device.addEventListener('uncapturederror', console.log);
    }
}
export class TestTransform extends Transform {
    config;
    pipeline;
    layout;
    static async Create(scene) {
        const self = new TestTransform(scene);
        const module = getShaderModuleForDevice(self.device);
        self.config = self.device.createBuffer({
            label: 'config',
            size: kFracConfigSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        self.pipeline = await self.device.createComputePipelineAsync({
            compute: { module, entryPoint: 'testTransform' },
            layout: 'auto',
        });
        self.layout = self.pipeline.getBindGroupLayout(0);
        return self;
    }
    async transform(original) {
        const origPositions = original.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        assert(origPositions instanceof Float32Array);
        const numInputPoints = origPositions.length / 3;
        const numInputTris = numInputPoints / 3;
        const kNumCells = 2;
        const numOutputTris = numInputTris * kNumCells;
        const inPoints = makeBufferFromData(this.device, origPositions);
        const numOutputBytes = kNumCells * origPositions.byteLength;
        const outTriExists = this.device.createBuffer({
            label: 'outTriExists',
            size: numOutputTris * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const outPoints = this.device.createBuffer({
            label: 'outPoints',
            size: numOutputBytes,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const bindGroup = this.device.createBindGroup({
            label: 'transform',
            layout: this.layout,
            entries: [
                { binding: 1, resource: { buffer: inPoints } },
                { binding: 2, resource: { buffer: outTriExists } },
                { binding: 3, resource: { buffer: outPoints } },
            ],
        });
        const outTriExistsReadback = this.device.createBuffer({
            label: 'outTriExistsReadback',
            size: numOutputTris * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        const outPointsReadback = this.device.createBuffer({
            label: 'outPointsReadback',
            size: numOutputBytes,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        this.device.queue.writeBuffer(this.config, 0, new Float32Array([numInputTris]));
        {
            const enc = this.device.createCommandEncoder();
            {
                const pass = enc.beginComputePass();
                pass.setPipeline(this.pipeline);
                pass.setBindGroup(0, bindGroup);
                pass.dispatchWorkgroups(numOutputTris);
                pass.end();
            }
            enc.copyBufferToBuffer(outTriExists, 0, outTriExistsReadback, 0, numOutputTris * 4);
            enc.copyBufferToBuffer(outPoints, 0, outPointsReadback, 0, numOutputBytes);
            this.device.queue.submit([enc.finish()]);
        }
        inPoints.destroy();
        outPoints.destroy();
        await Promise.all([
            outTriExistsReadback.mapAsync(GPUMapMode.READ),
            outPointsReadback.mapAsync(GPUMapMode.READ),
        ]);
        const outTriExistsData = new Uint32Array(outTriExistsReadback.getMappedRange());
        const outPointsData = new Float32Array(outPointsReadback.getMappedRange());
        for (let cell = 0; cell < kNumCells; ++cell) {
            const outPointsCompacted = [];
            for (let idx = 0; idx < numInputTris; ++idx) {
                const outTriIdx = cell * numInputTris + idx;
                if (outTriExistsData[outTriIdx]) {
                    outPointsCompacted.push(...outPointsData.subarray(outTriIdx * 9, outTriIdx * 9 + 9));
                }
            }
            const positions = new Float32Array(outPointsCompacted);
            const name = `${original.name}.${cell}`;
            const mesh = makeFragmentFromVertices(this.scene, name, positions);
            mesh.position.y += 3;
        }
        outTriExistsReadback.destroy();
        outPointsReadback.destroy();
        original.dispose();
    }
}
export class FractureTransform extends Transform {
    fracPipeline;
    fracLayout;
    fracConfig;
    copyPipeline;
    copyLayout;
    copyConfig;
    proxPipeline;
    proxLayout;
    proxConfig;
    fractureCenter;
    cellBuffers;
    arrtricells;
    arrtris;
    buftricells;
    buftris;
    buftrioutcells;
    buftriout;
    bufnewoutcells;
    bufnewout;
    static async Create(scene) {
        const self = new FractureTransform(scene);
        const module = getShaderModuleForDevice(self.device);
        self.fracConfig = self.device.createBuffer({
            label: 'fracConfig',
            size: kFracConfigSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        self.fracPipeline = await self.device.createComputePipelineAsync({
            label: 'fracPipeline',
            compute: { module, entryPoint: 'fracture' },
            layout: 'auto',
        });
        self.fracLayout = self.fracPipeline.getBindGroupLayout(0);
        self.copyConfig = self.device.createBuffer({
            label: 'copyConfig',
            size: kCopyConfigSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        self.copyPipeline = await self.device.createComputePipelineAsync({
            compute: { module, entryPoint: 'transformCopyPerPlane' },
            layout: 'auto',
        });
        self.copyLayout = self.copyPipeline.getBindGroupLayout(0);
        self.proxConfig = self.device.createBuffer({
            label: 'proxConfig',
            size: kProxConfigSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        self.proxPipeline = await self.device.createComputePipelineAsync({
            compute: { module, entryPoint: 'applyProximity' },
            layout: 'auto',
        });
        self.proxLayout = self.proxPipeline.getBindGroupLayout(0);
        self.cellBuffers = kFracturePattern.cellData.map((data) => makeBufferFromData(self.device, data));
        return self;
    }
    async transform(original) {
        const origPositions = original.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        assert(origPositions instanceof Float32Array);
        const vertsAsFloat4 = new Float32Array((origPositions.length / 3) * 4);
        for (let iVertex = 0; iVertex < origPositions.length / 3; ++iVertex) {
            memcpy({ src: origPositions, start: iVertex * 3, length: 3 }, { dst: vertsAsFloat4, start: iVertex * 4 });
        }
        const matrix = original.computeWorldMatrix().getRotationMatrix();
        const rotation = matrix.toArray();
        const pImpact = [0, 0, 0]; // TODO: wire up mouse input
        const fractured = await this.doFracture(vertsAsFloat4, rotation, pImpact);
        for (let i = 0; i < fractured.length; i++) {
            const fr = fractured[i];
            if (fr) {
                const fracPos = fr.position;
                const name = `${original.name}.${i}`;
                makeFragmentFromVertices(this.scene, name, fr.points.flat());
            }
        }
    }
    doTransformCopyPerPlane(transform) {
        const tricount = this.arrtris.length / 4;
        this.buftricells = this.device.createBuffer({
            label: 'buftricells',
            size: kFracturePattern.cellCount * tricount * 4,
            usage: GPUBufferUsage.STORAGE,
        });
        this.buftris = this.makeBufferWithData(this.arrtris, {
            label: 'buftris',
            usage: GPUBufferUsage.STORAGE,
        });
        {
            const config = new ArrayBuffer(kCopyConfigSize);
            const configi = new Int32Array(config);
            const configf = new Float32Array(config);
            configf.set(transform, 0); // 16 floats
            configi[16] = kFracturePattern.cellCount;
            configi[17] = tricount;
            this.device.queue.writeBuffer(this.copyConfig, 0, config);
        }
        const bindGroup = this.device.createBindGroup({
            layout: this.copyLayout,
            entries: [
                // transform, cellCount, tricount
                { binding: 0, resource: { buffer: this.copyConfig } },
                // 0 was cellCount
                // 1 was transform
                // 2 was tricount
                { binding: 3, resource: { buffer: this.buftricells } },
                { binding: 4, resource: { buffer: this.buftris } },
            ],
        });
        {
            const enc = this.device.createCommandEncoder();
            {
                const pass = enc.beginComputePass();
                pass.setPipeline(this.copyPipeline);
                pass.setBindGroup(0, bindGroup);
                const localsize = 1;
                pass.dispatchWorkgroups(Math.ceil(tricount / localsize));
                pass.end();
            }
            this.device.queue.submit([enc.finish()]);
        }
        return tricount * kFracturePattern.cellCount;
    }
    async doFracture(vertsAsFloat4, transform, pImpact) {
        let tricount = vertsAsFloat4.length / 4;
        this.arrtris = vertsAsFloat4;
        this.fractureCenter = new Float32Array(OM.mult3c(pImpact, -1));
        tricount = this.doTransformCopyPerPlane(transform);
        for (let i = 0; i < this.cellBuffers.length; i++) {
            this.dispatchFracture(i, tricount);
            if (i === this.cellBuffers.length - 1) {
                // on the last iteration, before copying to cpu, merge faraway cells
                this.dispatchProx(tricount);
            }
            await this.outputToInput(tricount);
            tricount = this.arrtricells.length;
        }
        const cellfaces = [];
        for (let i = 0; i < this.arrtricells.length; i++) {
            const idx = this.arrtricells[i] + 2; // so that -2 becomes a valid cell
            let c = cellfaces[idx];
            if (!c) {
                c = cellfaces[idx] = {
                    points: [],
                    faces: [],
                    min: [10000, 10000, 10000],
                    max: [-10000, -10000, -10000],
                };
            }
            for (let v = 0; v < 3; v++) {
                const off = i * 12 + v * 4;
                const p = [this.arrtris[off + 0], this.arrtris[off + 1], this.arrtris[off + 2]];
                c.points.push(p);
                c.min = OM.compwise(Math.min, c.min, p);
                c.max = OM.compwise(Math.max, c.max, p);
            }
            const ci = c.faces.length * 3;
            c.faces.push([ci, ci + 1, ci + 2]);
        }
        // "recenter"
        for (let i = 0; i < cellfaces.length; i++) {
            const c = cellfaces[i];
            if (!c) {
                continue;
            }
            c.position = OM.mult3c(OM.add3(c.min, c.max), 0.5);
            c.size = OM.sub3(c.max, c.min);
            for (let j = 0; j < c.points.length; j++) {
                c.points[j] = OM.sub3(c.points[j], c.position);
            }
        }
        return cellfaces;
    }
    dispatchFracture(iteration, tricount) {
        if (iteration > 0) {
            this.buftricells = this.makeBufferWithData(this.arrtricells, {
                usage: GPUBufferUsage.STORAGE,
            });
            this.buftricells = this.makeBufferWithData(this.arrtris, {
                usage: GPUBufferUsage.STORAGE,
            });
        }
        this.buftrioutcells = this.device.createBuffer({
            label: 'buftrioutcells',
            size: tricount * 2 * 4,
            usage: GPUBufferUsage.STORAGE,
        });
        this.buftriout = this.device.createBuffer({
            label: 'buftriout',
            size: tricount * 2 * 12 * 4,
            usage: GPUBufferUsage.STORAGE,
        });
        this.bufnewoutcells = this.device.createBuffer({
            label: 'bufnewoutcells',
            size: tricount * 4,
            usage: GPUBufferUsage.STORAGE,
        });
        this.bufnewout = this.device.createBuffer({
            label: 'bufnewout',
            size: tricount * 2 * 4 * 4,
            usage: GPUBufferUsage.STORAGE,
        });
        {
            const config = new ArrayBuffer(kFracConfigSize);
            const configi = new Int32Array(config);
            const configf = new Float32Array(config);
            configf.set(this.fractureCenter, 0); // 4 floats
            configi[4] = kFracturePattern.cellCount;
            configi[5] = tricount;
            this.device.queue.writeBuffer(this.fracConfig, 0, config);
        }
        const bindGroup = this.device.createBindGroup({
            label: 'doFractureStep',
            layout: this.fracLayout,
            entries: [
                // fractureCenter, cellCount, tricount
                { binding: 0, resource: { buffer: this.fracConfig } },
                // 0 was cellCount
                { binding: 1, resource: { buffer: this.cellBuffers[iteration] } },
                // 2 was tricount
                { binding: 3, resource: { buffer: this.buftricells } },
                { binding: 4, resource: { buffer: this.buftris } },
                { binding: 5, resource: { buffer: this.buftrioutcells } },
                { binding: 6, resource: { buffer: this.buftriout } },
                { binding: 7, resource: { buffer: this.bufnewoutcells } },
                { binding: 8, resource: { buffer: this.bufnewout } },
                // 9 was fractureCenter
            ],
        });
        {
            const enc = this.device.createCommandEncoder();
            {
                const pass = enc.beginComputePass();
                pass.setPipeline(this.fracPipeline);
                pass.setBindGroup(0, bindGroup);
                const localsize = 1;
                pass.dispatchWorkgroups(Math.ceil(tricount / localsize));
                pass.end();
            }
            this.device.queue.submit([enc.finish()]);
        }
    }
    dispatchProx(tricount) {
        {
            const config = new Uint32Array([tricount * 2]);
            this.device.queue.writeBuffer(this.proxConfig, 0, config);
        }
        const bindGroup = this.device.createBindGroup({
            label: 'prox',
            layout: this.proxLayout,
            entries: [
                { binding: 1, resource: { buffer: this.proxConfig } },
                { binding: 2, resource: { buffer: this.buftrioutcells } },
            ],
        });
        {
            const enc = this.device.createCommandEncoder();
            {
                const pass = enc.beginComputePass();
                pass.setPipeline(this.proxPipeline);
                pass.setBindGroup(0, bindGroup);
                const localsize = 1;
                pass.dispatchWorkgroups(Math.ceil((tricount * 2) / localsize));
                pass.end();
            }
            this.device.queue.submit([enc.finish()]);
        }
    }
    async outputToInput(oldtricount) {
        this.buftris.destroy();
        const [arrtrioutcells, arrtriout, arrnewoutcells, arrnewout] = await Promise.all([
            this.readbackBuffer(this.buftrioutcells, 4 * oldtricount * 2).then((ab) => new Int32Array(ab)),
            this.readbackBuffer(this.buftriout, 4 * oldtricount * 2 * 12).then((ab) => new Float32Array(ab)),
            this.readbackBuffer(this.bufnewoutcells, 4 * oldtricount).then((ab) => new Int32Array(ab)),
            this.readbackBuffer(this.bufnewout, 4 * oldtricount * 2 * 4).then((ab) => new Float32Array(ab)),
        ]);
        this.buftrioutcells.destroy();
        this.buftriout.destroy();
        this.bufnewoutcells.destroy();
        this.bufnewout.destroy();
        let { indices: tricells, values: tris } = floatNcompact(12, arrtrioutcells, arrtriout);
        const { indices: newcells, values: news } = floatNcompact(8, arrnewoutcells, arrnewout);
        {
            const { indices, values } = makeFace(newcells, news);
            tricells = tricells.concat(indices);
            tris = tris.concat(values);
        }
        this.arrtricells = new Int32Array(tricells);
        this.arrtris = new Float32Array(tris);
    }
    makeBufferWithData(data, desc) {
        const buffer = this.device.createBuffer({
            ...desc,
            size: data.byteLength,
            mappedAtCreation: true,
        });
        memcpy({ src: data }, { dst: buffer.getMappedRange() });
        buffer.unmap();
        return buffer;
    }
    async readbackBuffer(buffer, size) {
        assert(size % 4 === 0);
        const readback = this.device.createBuffer({
            label: 'readback for ' + buffer.label,
            size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        {
            const enc = this.device.createCommandEncoder();
            enc.copyBufferToBuffer(buffer, 0, readback, 0, size);
            this.device.queue.submit([enc.finish()]);
        }
        try {
            await readback.mapAsync(GPUMapMode.READ);
        }
        catch (ex) {
            // For some reason breakpoints aren't catching a rejection here??
            debugger;
        }
        const copy = readback.getMappedRange().slice(0);
        readback.destroy();
        return copy;
    }
}
function makeBufferFromData(device, data) {
    const buffer = device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        mappedAtCreation: true,
    });
    const mapped = buffer.getMappedRange();
    memcpy({ src: data }, { dst: mapped });
    buffer.unmap();
    return buffer;
}
function floatNcompact(N, index, val) {
    const indices = [];
    const values = [];
    for (let i = 0; i < index.length; i++) {
        if (index[i] != -1) {
            indices.push(index[i]);
            for (let n = 0; n < N; n++) {
                values.push(val[i * N + n]);
            }
        }
    }
    return { indices: indices, values: values };
}
function makeFace(indices, points) {
    const faces = [];
    for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        let f = faces[idx];
        if (!f) {
            f = faces[idx] = [];
        }
        // save the current two points into the correct face
        const p1 = [points[i * 8 + 0], points[i * 8 + 1], points[i * 8 + 2]];
        const p2 = [points[i * 8 + 4], points[i * 8 + 5], points[i * 8 + 6]];
        f.push([p1, p2]);
    }
    const idxout = [];
    const values = [];
    for (let iface = 0; iface < faces.length; iface++) {
        const f = faces[iface];
        if (!f) {
            continue;
        }
        let centr = [0, 0, 0];
        for (let j = 0; j < f.length; j++) {
            centr = OM.add3(centr, OM.add3(f[j][0], f[j][1]));
        }
        centr = OM.mult3c(centr, 0.5 / f.length);
        // Create a tri from the centroid and the two points on each edge
        for (let i = 0; i < f.length; i++) {
            idxout.push(iface);
            values.push(...centr, ...f[i][0], ...f[i][1]);
        }
    }
    return { indices: idxout, values: values };
}
//# sourceMappingURL=fracture.js.map