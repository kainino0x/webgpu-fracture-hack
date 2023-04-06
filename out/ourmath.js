export var OM;
(function (OM) {
    function cross3(a, b) {
        return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }
    OM.cross3 = cross3;
    function dot3(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }
    OM.dot3 = dot3;
    function add3(a, b) {
        return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    }
    OM.add3 = add3;
    function sub3(a, b) {
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    }
    OM.sub3 = sub3;
    function mult3c(a, c) {
        return [a[0] * c, a[1] * c, a[2] * c];
    }
    OM.mult3c = mult3c;
    function length3(a) {
        return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    }
    OM.length3 = length3;
    function compwise(f, a, b) {
        return [f(a[0], b[0]), f(a[1], b[1]), f(a[2], b[2])];
    }
    OM.compwise = compwise;
    function normalize3(a) {
        const length = length3(a);
        return [a[0] / length, a[1] / length, a[2] / length];
    }
    OM.normalize3 = normalize3;
    function nearlyEqual3(a, b) {
        const EPSILON = 0.0001;
        return Math.abs(dot3(a, b) - 1) < EPSILON;
    }
    OM.nearlyEqual3 = nearlyEqual3;
    function containsNormal(a, norm) {
        return a.some((v) => nearlyEqual3(v.normal, norm));
    }
    OM.containsNormal = containsNormal;
    function toRotationMatrix(a) {
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
    OM.toRotationMatrix = toRotationMatrix;
    function mat3Id() {
        return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }
    OM.mat3Id = mat3Id;
    function mat3mult(a, b) {
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
    OM.mat3mult = mat3mult;
    function mat3vec3mult(m, v) {
        return [
            m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
            m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
            m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
        ];
    }
    OM.mat3vec3mult = mat3vec3mult;
    function contains3c(a, c) {
        return a[0] === c || a[1] === c || a[2] === c;
    }
    OM.contains3c = contains3c;
    function equals2i(a, b) {
        return (a[0] === b[0] && a[1] === b[1]) || (a[1] === b[0] && a[0] === b[1]);
    }
    OM.equals2i = equals2i;
})(OM || (OM = {}));
//# sourceMappingURL=ourmath.js.map