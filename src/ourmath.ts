export namespace OM {
  export type vec2 = [number, number];
  export type vec3 = [number, number, number];
  export type mat3x3 =
    /* prettier-ignore */ [
      number, number, number,
      number, number, number,
      number, number, number,
    ];
  export type mat4x4 =
    /* prettier-ignore */ [
      number, number, number, number,
      number, number, number, number,
      number, number, number, number,
      number, number, number, number,
    ];

  export function cross3(a: vec3, b: vec3): vec3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  export function dot3(a: vec3, b: vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  export function add3(a: vec3, b: vec3): vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  export function sub3(a: vec3, b: vec3): vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  export function mult3c(a: vec3, c: number): vec3 {
    return [a[0] * c, a[1] * c, a[2] * c];
  }

  export function length3(a: vec3): number {
    return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  }

  export function compwise(f: (x: number, y: number) => number, a: vec3, b: vec3): vec3 {
    return [f(a[0], b[0]), f(a[1], b[1]), f(a[2], b[2])];
  }

  export function normalize3(a: vec3): vec3 {
    const length = length3(a);
    return [a[0] / length, a[1] / length, a[2] / length];
  }

  export function nearlyEqual3(a: vec3, b: vec3) {
    const EPSILON = 0.0001;
    return Math.abs(dot3(a, b) - 1) < EPSILON;
  }

  export function containsNormal(a: { normal: vec3 }[], norm: vec3) {
    return a.some((v) => nearlyEqual3(v.normal, norm));
  }

  export function toRotationMatrix(a: vec3) {
    let m = mat3Id();
    let m1 = mat3Id();
    const DEG_TO_RAD = 3.14159265359 / 180.0;
    let sAng, cAng;

    if (a[2]) {
      m1 = mat3Id();
      sAng = Math.sin(-a[2] * DEG_TO_RAD);
      cAng = Math.cos(-a[2] * DEG_TO_RAD);
      m1[0] = cAng;
      m1[1] = sAng;
      m1[3] = -sAng;
      m1[4] = cAng;

      m = mat3mult(m, m1);
    }
    if (a[1]) {
      m1 = mat3Id();
      sAng = Math.sin(-a[1] * DEG_TO_RAD);
      cAng = Math.cos(-a[1] * DEG_TO_RAD);
      m1[0] = cAng;
      m1[2] = -sAng;
      m1[6] = sAng;
      m1[8] = cAng;

      m = mat3mult(m, m1);
    }
    if (a[0]) {
      m1 = mat3Id();
      sAng = Math.sin(-a[0] * DEG_TO_RAD);
      cAng = Math.cos(-a[0] * DEG_TO_RAD);
      m1[4] = cAng;
      m1[5] = sAng;
      m1[7] = -sAng;
      m1[8] = cAng;

      m = mat3mult(m, m1);
    }
    return m;
  }

  export function mat3Id(): mat3x3 {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }

  export function mat3mult(a: mat3x3, b: mat3x3): mat3x3 {
    return [
      a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
      a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
      a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
      a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
      a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
      a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
      a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
      a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
      a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
    ];
  }

  export function mat3vec3mult(m: mat3x3, v: vec3): vec3 {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
  }

  export function contains3c(a: vec3, c: number) {
    return a[0] === c || a[1] === c || a[2] === c;
  }

  export function equals2i(a: vec2, b: vec2) {
    return (a[0] === b[0] && a[1] === b[1]) || (a[1] === b[0] && a[0] === b[1]);
  }
}
