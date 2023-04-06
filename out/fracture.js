import { kFracturePattern } from './fracture_pattern.js';
import { makeFragmentFromVertices } from './helper.js';
import { OM } from './ourmath.js';
import { assert, memcpy, roundUp } from './util.js';
const kFracConfigSize = roundUp(24, 16);
const kCopyConfigSize = roundUp(16 * 4 + 4 + 4, 16);
const kProxConfigSize = 4;
const kCopyWorkgroupSize = 1; // TODO: increase these
const kProxWorkgroupSize = 1;
const kFracWorkgroupSize = 1;
const kShaderCode = /* wgsl */ `
// testTransform

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

//// fracture transform

struct Tri { a: vec4f, b: vec4f, c: vec4f }

// transformCopyPerPlane

struct CopyConfig {
  transform: mat4x4f,
  planecount: u32, // = cell count = the number of kth planes across all cells
  tricount: u32,
}
@group(0) @binding(0) var<uniform> copy_config: CopyConfig;
@group(0) @binding(3) var<storage, read_write> copy_tricells: array<i32>; // size planecount*tricount
@group(0) @binding(4) var<storage, read_write> copy_tris:     array<Tri>; // size planecount*tricount

@compute @workgroup_size(${kCopyWorkgroupSize})
fn transformCopyPerPlane(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i_tri = gid.x;
  if i_tri >= copy_config.tricount { return; }

  var t = copy_tris[i_tri];
  t.a = copy_config.transform * t.a;
  t.b = copy_config.transform * t.b;
  t.c = copy_config.transform * t.c;

  for (var i_plane = 0u; i_plane < copy_config.planecount; i_plane++) {
    copy_tricells[i_plane * copy_config.tricount + i_tri] = i32(i_plane);
    copy_tris    [i_plane * copy_config.tricount + i_tri] = t;
  }
}

// applyProximity

@group(0) @binding(0) var<storage, read> prox_prox: array<u32>; // true/false proximate per cell
struct ProxConfig { tricount: u32 }
@group(0) @binding(1) var<uniform> prox_config: ProxConfig;
@group(0) @binding(2) var<storage, read_write> prox_tricells: array<i32>; // modified in place

@compute @workgroup_size(${kProxWorkgroupSize})
fn applyProximity(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i_tri = gid.x;
  if i_tri >= prox_config.tricount { return; }

  let c = prox_tricells[i_tri];
  if c != -1 && prox_prox[c] == 0 {
    prox_tricells[i_tri] = -2; // -1 means delete, -2 doesn't!
  }
}

// fracture

struct FracConfig {
  fracCenter: vec4f,
  planecount: u32,
  tricount: u32,
}
@group(0) @binding(0) var<uniform> frac_config: FracConfig;
@group(0) @binding(1) var<storage, read>       planes:    array<vec4f>; // size planecount, each Nx Ny Nz d
@group(0) @binding(3) var<storage, read>       tricells:    array<i32>; // size tricount
@group(0) @binding(4) var<storage, read>       tris:        array<Tri>; // size tricount
@group(0) @binding(5) var<storage, read_write> trioutcells: array<i32>; // size tricount*2
@group(0) @binding(6) var<storage, read_write> triout:      array<Tri>; // size tricount*2
@group(0) @binding(7) var<storage, read_write> newoutcells: array<i32>; // size tricount
struct Edge { a: vec4f, b: vec4f }
@group(0) @binding(8) var<storage, read_write> newout:     array<Edge>; // size tricount

@compute @workgroup_size(${kFracWorkgroupSize})
fn fracture(@builtin(global_invocation_id) gid: vec3<u32>) {
  _ = &planes;
  _ = &newout;

  let index = gid.x;
  if index >= frac_config.tricount { return; }

  // The following makes this kernel a no-op; i.e., each of
  // the 50 fracture pieces will be a copy of the original mesh.
  trioutcells[2 * index] = tricells[index];
  trioutcells[2 * index + 1] = -1;
  triout[2 * index] = tris[index];
  newoutcells[index] = -1;
}
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
    }
    async transform(original) {
        await this.transformImpl(original);
        original.dispose();
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
    async transformImpl(original) {
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
            const enc = this.device.createCommandEncoder({ label: 'transform' });
            {
                const pass = enc.beginComputePass({ label: 'transform' });
                pass.setPipeline(this.pipeline);
                pass.setBindGroup(0, bindGroup);
                pass.dispatchWorkgroups(numOutputTris);
                pass.end();
            }
            enc.copyBufferToBuffer(outTriExists, 0, outTriExistsReadback, 0, numOutputTris * 4);
            enc.copyBufferToBuffer(outPoints, 0, outPointsReadback, 0, numOutputBytes);
            this.device.queue.submit([enc.finish({ label: 'transform' })]);
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
    cellProxBuf;
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
        self.cellProxBuf = makeBufferFromData(self.device, kFracturePattern.cellProx);
        return self;
    }
    async transformImpl(original) {
        const origPositions = original.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        assert(origPositions instanceof Float32Array);
        const vertsAsFloat4 = new Float32Array((origPositions.length / 3) * 4);
        for (let iVertex = 0; iVertex < origPositions.length / 3; ++iVertex) {
            memcpy({ src: origPositions, start: iVertex * 3, length: 3 }, { dst: vertsAsFloat4, start: iVertex * 4 });
            // w is left as 0, it should be unused
        }
        const matrix = original.computeWorldMatrix().getRotationMatrix();
        const rotation = matrix.toArray();
        const pImpact = [0, 0, 0]; // TODO: wire up mouse input
        const fractured = await this.doFracture(vertsAsFloat4, rotation, pImpact);
        let fragmentCount = 0;
        for (let i = 0; i < fractured.length; i++) {
            const fr = fractured[i];
            if (fr) {
                fragmentCount++;
                const name = `${original.name}.${i}`;
                const mesh = makeFragmentFromVertices(this.scene, name, fr.points.flat());
                // TODO: give the fragment the correct transform
                mesh.position.y += 3;
            }
        }
        console.log(`created ${fragmentCount} fragments, of ${kFracturePattern.cellCount} possible`);
    }
    doTransformCopyPerPlane(transform) {
        const tricount = this.arrtris.length / 3 / 4;
        this.buftricells = this.device.createBuffer({
            label: 'buftricells',
            size: kFracturePattern.cellCount * tricount * 4,
            usage: GPUBufferUsage.STORAGE,
        });
        this.buftris = this.makeBufferWithData(this.arrtris, {
            label: 'buftris',
            usage: GPUBufferUsage.STORAGE,
            size: kFracturePattern.cellCount * tricount * 3 * 4 * 4,
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
            label: 'transformCopyPerPlane',
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
            const enc = this.device.createCommandEncoder({ label: 'transformCopyPerPlane' });
            {
                const pass = enc.beginComputePass({ label: 'transformCopyPerPlane' });
                pass.setPipeline(this.copyPipeline);
                pass.setBindGroup(0, bindGroup);
                pass.dispatchWorkgroups(Math.ceil(tricount / kCopyWorkgroupSize));
                pass.end();
            }
            this.device.queue.submit([enc.finish({ label: 'transformCopyPerPlane' })]);
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
                //this.dispatchProx(tricount); // TODO: turn this back on
            }
            await this.outputToInput();
            tricount = this.arrtricells.length;
        }
        const cellfaces = [];
        for (let i_tri = 0; i_tri < this.arrtricells.length; i_tri++) {
            const i_cell = this.arrtricells[i_tri] + 2; // so that -2 becomes a valid cell
            let c = cellfaces[i_cell];
            if (!c) {
                c = cellfaces[i_cell] = {
                    points: [],
                    faces: [],
                    min: [10000, 10000, 10000],
                    max: [-10000, -10000, -10000],
                };
            }
            for (let i_vertex = 0; i_vertex < 3; i_vertex++) {
                const off = i_tri * 12 + i_vertex * 4;
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
            this.buftris = this.makeBufferWithData(this.arrtris, {
                usage: GPUBufferUsage.STORAGE,
            });
        }
        this.buftrioutcells = this.device.createBuffer({
            label: 'buftrioutcells',
            size: tricount * 2 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        this.buftriout = this.device.createBuffer({
            label: 'buftriout',
            size: tricount * 2 * 12 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        this.bufnewoutcells = this.device.createBuffer({
            label: 'bufnewoutcells',
            size: tricount * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        this.bufnewout = this.device.createBuffer({
            label: 'bufnewout',
            size: tricount * 2 * 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
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
            label: 'fracture',
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
            const enc = this.device.createCommandEncoder({ label: 'fracture' });
            {
                const pass = enc.beginComputePass({ label: 'fracture' });
                pass.setPipeline(this.fracPipeline);
                pass.setBindGroup(0, bindGroup);
                pass.dispatchWorkgroups(Math.ceil(tricount / kFracWorkgroupSize));
                pass.end();
            }
            this.device.queue.submit([enc.finish({ label: 'fracture' })]);
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
                { binding: 0, resource: { buffer: this.cellProxBuf } },
                { binding: 1, resource: { buffer: this.proxConfig } },
                { binding: 2, resource: { buffer: this.buftrioutcells } },
            ],
        });
        {
            const enc = this.device.createCommandEncoder({ label: 'prox' });
            {
                const pass = enc.beginComputePass({ label: 'prox' });
                pass.setPipeline(this.proxPipeline);
                pass.setBindGroup(0, bindGroup);
                pass.dispatchWorkgroups(Math.ceil((tricount * 2) / kProxWorkgroupSize));
                pass.end();
            }
            this.device.queue.submit([enc.finish({ label: 'prox' })]);
        }
    }
    async outputToInput() {
        this.buftris.destroy();
        const [arrtrioutcells, arrtriout, arrnewoutcells, arrnewout] = await Promise.all([
            this.readbackBuffer(this.buftrioutcells).then((ab) => new Int32Array(ab)),
            this.readbackBuffer(this.buftriout).then((ab) => new Float32Array(ab)),
            this.readbackBuffer(this.bufnewoutcells).then((ab) => new Int32Array(ab)),
            this.readbackBuffer(this.bufnewout).then((ab) => new Float32Array(ab)),
        ]);
        this.buftrioutcells.destroy();
        this.buftriout.destroy();
        this.bufnewoutcells.destroy();
        this.bufnewout.destroy();
        const { indices: tricells1, values: tris1 } = floatNcompact(12, {
            indices: arrtrioutcells,
            values: arrtriout,
        });
        //console.log('triout compacted', arrtrioutcells.length, 'to', tricells1.length);
        const { indices: newcells, values: news } = floatNcompact(8, {
            indices: arrnewoutcells,
            values: arrnewout,
        });
        //console.log('newout compacted', arrnewoutcells.length, 'to', newcells.length);
        const { indices: tricells2, values: tris2 } = makeFace(newcells, news);
        this.arrtricells = new Int32Array(tricells1.length + tricells2.length);
        this.arrtricells.set(tricells1);
        this.arrtricells.set(tricells2, tricells1.length);
        this.arrtris = new Float32Array(tris1.length + tris2.length);
        this.arrtris.set(tris1);
        this.arrtris.set(tris2, tris1.length);
    }
    makeBufferWithData(data, desc) {
        const buffer = this.device.createBuffer({
            size: data.byteLength,
            ...desc,
            mappedAtCreation: true,
        });
        memcpy({ src: data }, { dst: buffer.getMappedRange(0, data.byteLength) });
        buffer.unmap();
        return buffer;
    }
    async readbackBuffer(buffer) {
        assert(buffer.size % 4 === 0);
        const readback = this.device.createBuffer({
            label: 'readback for ' + buffer.label,
            size: buffer.size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        {
            const enc = this.device.createCommandEncoder({ label: 'readback' });
            enc.copyBufferToBuffer(buffer, 0, readback, 0, buffer.size);
            this.device.queue.submit([enc.finish({ label: 'readback' })]);
        }
        await readback.mapAsync(GPUMapMode.READ);
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
function floatNcompact(N, input) {
    let indicesCount = 0;
    for (let i = 0; i < input.indices.length; i++) {
        if (input.indices[i] !== -1) {
            indicesCount++;
        }
    }
    const out = {
        indices: new Int32Array(indicesCount),
        values: new Float32Array(indicesCount * N),
    };
    let iOut = 0;
    for (let iIn = 0; iIn < input.indices.length; iIn++) {
        if (input.indices[iIn] !== -1) {
            out.indices[iOut] = input.indices[iIn];
            memcpy({ src: input.values, start: iIn * N, length: N }, { dst: out.values, start: iOut * N });
            //for (let n = 0; n < N; n++) {
            //  values[iOut * N + n] = val[iIn * N + n];
            //}
            iOut++;
        }
    }
    return out;
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
    const idxout = new Int32Array(indices.length);
    const values = new Float32Array(indices.length * 9);
    let i_idxout = 0;
    let i_values = 0;
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
            idxout[i_idxout] = iface;
            i_idxout++;
            values.set([...centr, ...f[i][0], ...f[i][1]], i_values);
            i_values += 9;
        }
    }
    return { indices: new Int32Array(idxout), values: new Float32Array(values) };
}
//# sourceMappingURL=fracture.js.map