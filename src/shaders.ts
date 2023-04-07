import { roundUp } from './util.js';

export namespace Shaders {
  export const kFracConfigSize = roundUp(24, 16);
  export const kCopyConfigSize = roundUp(16 * 4 + 4 + 4, 16);
  export const kProxConfigSize = 4;
  export const kCopyWorkgroupSize = 32;
  export const kProxWorkgroupSize = 32;
  export const kFracWorkgroupSize = 32;
  export const kShaderCode = /* wgsl */ `
// testTransform

@group(0) @binding(1) var<storage, read> inPoints: array<f32>;
@group(0) @binding(2) var<storage, read_write> outTriExists: array<u32>;
@group(0) @binding(3) var<storage, read_write> outPoints: array<f32>;

@compute @workgroup_size(1)
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

const kNoOpMode = false;

@compute @workgroup_size(${kFracWorkgroupSize})
fn fracture(@builtin(global_invocation_id) gid: vec3<u32>) {
  let index = gid.x;
  if index >= frac_config.tricount { return; }

  if kNoOpMode {
    // The following makes this kernel a no-op; i.e., each of
    // the 50 fracture pieces will be a copy of the original mesh.
    trioutcells[2 * index] = tricells[index];
    trioutcells[2 * index + 1] = -1;
    triout[2 * index] = tris[index];
    newoutcells[index] = -1;
  } else {
    let cell = tricells[index];
    let _pla = planes[cell];
    if all(_pla.xyz == vec3(0, 0, 0)) {
      // this cell doesn't have a plane on this iteration; do nothing
      trioutcells[2 * index] = cell;
      triout[2 * index] = tris[index];
      trioutcells[2 * index + 1] = -1;
      newoutcells[index] = -1;
      return;
    }
    let pN = vec4(_pla.xyz, 0);
    // move the plane into local coordinate system.
    let pd = _pla.w + dot(pN, frac_config.fracCenter);
    let pP = vec4(0, 0, -pd / pN.z, 0); // Arbitrarily calculate a point on the plane (z-axis intersection)

    let tri = tris[index];

    var cull1 = dot(pN, tri.a - pP) < 0;
    var cull2 = dot(pN, tri.b - pP) < 0;
    var cull3 = dot(pN, tri.c - pP) < 0;
    var winding = true; // keeps track of whether or not the winding is still consistent.

    var p1 = tri.a;
    var p2 = tri.b;
    var p3 = tri.c;
    // sort the points from culled to not culled.
    if !cull1 {  // if cull1 is false, swap 1 and 3 (order 321)
      // is this faster than putting if-else?  if (cull3){...} else if (cull2){...}
      cull1 = cull3;
      cull3 = false;
      p1 = tri.c;
      p2 = tri.b;
      p3 = tri.a;

      winding = false;

      if !cull1 {  // if it's still false, swap 1 and 2 (final order 231)
        cull1 = cull2;
        cull2 = false;
        p1 = tri.b;
        p2 = tri.c;

        winding = true;
      }
    } else if !cull2 {
      cull2 = cull3;
      cull3 = false;

      p1 = tri.a;
      p2 = tri.c;
      p3 = tri.b;

      winding = false;
    }

    // note that it's configured to output only the original triagle by default.
    var newTri1 = tri;    // current triangle.
    var newTri2 = Tri();
    var cell1 = cell;     // cell of the current face.
    var cell2 = -1;       // cell of the new face.
    var cellP = -1;       // cell of the new points (for newoutcells).
    var newP1: vec4f;     // new points.
    var newP2: vec4f;

    if cull3 {  // if all 3 points are culled, do nothing.  Output is -1
      cell1 = -1;
    } else if !cull1 {  // if all 3 points are not culled, add to output normally.
      // do nothing.
    } else if !cull2 {  // XOR: if only one point is culled (p1), needs new face, add both to output
      // calculate new edge p1-p2
      var v = normalize(p1 - p2);
      newP1 = p2 + v * -(dot(p2, pN) + pd) / dot(v, pN);

      // calculate new edge p1-p3
      v = normalize(p1 - p3);
      newP2 = p3 + v * -(dot(p3, pN) + pd) / dot(v, pN);

      newTri1.a = p2;
      newTri2.a = p2;
      if winding {
        newTri1.b = newP2;
        newTri1.c = newP1;
        newTri2.b = p3;
        newTri2.c = newP2;
      } else {
        newTri1.b = newP1;
        newTri1.c = newP2;
        newTri2.b = newP2;
        newTri2.c = p3;
      }

      // Both new faces and new points
      cell2 = cell;
      cellP = cell;
    } else {  // two points culled (p1, p2), modify current face and add to output
      // calculate new edge p2-p3
      var v = normalize(p2 - p3);
      newP1 = p3 + v * -(dot(p3, pN) + pd) / dot(v, pN);

      // calculate new edge p1-p3
      v = normalize(p1 - p3);
      newP2 = p3 + v * -(dot(p3, pN) + pd) / dot(v, pN);

      // set new points
      newTri1.a = newP1;
      if winding {
          newTri1.b = p3;
          newTri1.c = newP2;
      } else {
          newTri1.b = newP2;
          newTri1.c = p3;
      }
      
      // just new points.
      cellP = cell;
    }

    // output triangles.
    trioutcells[2 * index] = cell1;
    triout[2 * index] = newTri1;
    trioutcells[2 * index + 1] = cell2;
    triout[2 * index + 1] = newTri2;
    
    // output new points (for later triangulation).
    newoutcells[index] = cellP;
    if winding {
      newout[index] = Edge(newP1, newP2);
    } else {
      newout[index] = Edge(newP2, newP1);
    }
  }
}
`;
}
