import { roundUp } from './util.js';

export namespace Shaders {
  export const kFracConfigSize = roundUp(24, 16);
  export const kCopyConfigSize = roundUp(16 * 4 + 4 + 4, 16);
  export const kProxConfigSize = 4;
  export const kCopyWorkgroupSize = 1; // TODO: increase these
  export const kProxWorkgroupSize = 1;
  export const kFracWorkgroupSize = 1;
  export const kShaderCode = /* wgsl */ `
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
}
