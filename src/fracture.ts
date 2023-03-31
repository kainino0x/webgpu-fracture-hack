import { makeFragmentFromVertices } from './helper.js';
import { assert, memcpy } from './util.js';

const kConfigSize = 4;
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
`;

const shaderModuleForDevice = new WeakMap<GPUDevice, GPUShaderModule>();
function getShaderModuleForDevice(device: GPUDevice) {
  const existing = shaderModuleForDevice.get(device);
  if (existing) return existing;
  const created = device.createShaderModule({ code: kShaderCode });
  shaderModuleForDevice.set(device, created);
  return created;
}

abstract class Transform {
  protected scene: BABYLON.Scene;
  protected device: GPUDevice;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.device = (scene.getEngine() as any)._device;
    this.device.addEventListener('uncapturederror', console.log);
  }

  abstract transform(original: BABYLON.Mesh): Promise<void>;
}

export class TestTransform extends Transform {
  config!: GPUBuffer;
  pipeline!: GPUComputePipeline;
  layout!: GPUBindGroupLayout;

  static async Create(scene: BABYLON.Scene) {
    const self = new TestTransform(scene);
    const module = getShaderModuleForDevice(self.device);

    self.config = self.device.createBuffer({
      size: kConfigSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    self.pipeline = await self.device.createComputePipelineAsync({
      compute: { module, entryPoint: 'testTransform' },
      layout: 'auto',
    });
    self.layout = self.pipeline.getBindGroupLayout(0);
    return self;
  }

  async transform(original: BABYLON.Mesh) {
    const origPositions = original.getVerticesData(BABYLON.VertexBuffer.PositionKind)!;
    assert(origPositions instanceof Float32Array);
    const numInputPoints = origPositions.length / 3;
    const numInputTris = numInputPoints / 3;

    const kNumCells = 2;
    const numOutputTris = numInputTris * kNumCells;

    const inPoints = makeBufferFromData(this.device, origPositions);
    const numOutputBytes = kNumCells * origPositions.byteLength;
    const outTriExists = this.device.createBuffer({
      size: numOutputTris * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const outPoints = this.device.createBuffer({
      size: numOutputBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const bindGroup = this.device.createBindGroup({
      layout: this.layout,
      entries: [
        { binding: 1, resource: { buffer: inPoints } },
        { binding: 2, resource: { buffer: outTriExists } },
        { binding: 3, resource: { buffer: outPoints } },
      ],
    });
    const outTriExistsReadback = this.device.createBuffer({
      size: numOutputTris * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const outPointsReadback = this.device.createBuffer({
      size: numOutputBytes,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    {
      this.device.queue.writeBuffer(this.config, 0, new Float32Array([numInputTris]));
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

function makeBufferFromData(device: GPUDevice, data: Float32Array): GPUBuffer {
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
