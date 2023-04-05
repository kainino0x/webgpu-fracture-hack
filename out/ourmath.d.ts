export declare namespace OM {
    type vec2 = [number, number];
    type vec3 = [number, number, number];
    type mat3x3 = [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number
    ];
    type mat4x4 = [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number
    ];
    function cross3(a: vec3, b: vec3): vec3;
    function dot3(a: vec3, b: vec3): number;
    function add3(a: vec3, b: vec3): vec3;
    function sub3(a: vec3, b: vec3): vec3;
    function mult3c(a: vec3, c: number): vec3;
    function length3(a: vec3): number;
    function compwise(f: (x: number, y: number) => number, a: vec3, b: vec3): vec3;
    function normalize3(a: vec3): vec3;
    function nearlyEqual3(a: vec3, b: vec3): boolean;
    function containsNormal(a: {
        normal: vec3;
    }[], norm: vec3): boolean;
    function toRotationMatrix(a: vec3): mat3x3;
    function mat3Id(): mat3x3;
    function mat3mult(a: mat3x3, b: mat3x3): mat3x3;
    function mat3vec3mult(m: mat3x3, v: vec3): vec3;
    function contains3c(a: vec3, c: number): boolean;
    function equals2i(a: vec2, b: vec2): boolean;
}
