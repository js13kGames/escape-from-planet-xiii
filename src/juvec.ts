/*
    All vectors have 4 components to avoid different functions for each size
*/

import { Deg, abs, acos, assert, atan2, cos, floor, fract, max, mix, sin, sqrt, symmetricClamp, tan } from "./aliasedFunctions";

// Todo: Add vector type validation to catch potential cast issues
// This will need metadata on the vectors themselves
// const DebugValidateVectorTypes = true;

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export type Quaternion = Vec4;
export type Vec = Vec2 | Vec3 | Vec4;
// Column major
export type Mat4 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];

export const vec2 = (x: number, y: number) => {
    return [x, y, 0, 0] as unknown as Vec2;
};

export const vec2Splay = (k?: number) => {
    k = k ?? 0;
    return [k, k, 0, 0] as unknown as Vec2;
};

export const vec3 = (x: number, y: number, z: number) => {
    return [x, y, z, 0] as unknown as Vec3;
};

export const vec3Splay = (k?: number) => {
    k = k ?? 0;
    return [k, k, k, 0] as unknown as Vec3;
};

export const vec4 = (x: number, y: number, z: number, w: number) => {
    return [x, y, z, w] as unknown as Vec4;
};

export const vec4Splay = (k?: number) => {
    k = k ?? 0;
    return [k, k, k, k] as unknown as Vec4;
};

export const vecArray = <T extends Vec>(sz: number): T[] => {
    const r = [];
    for (let i = 0; i < sz; ++i) {
        r.push([0, 0, 0, 0]);
    }
    return r as T[];
};

export const vecSet = <T extends Vec>(v: T, x?: number, y?: number, z?: number, w?: number) => {
    v[0] = x ?? 0;
    v[1] = y ?? 0;
    (v as Vec4)[2] = z ?? 0;
    (v as Vec4)[3] = w ?? 0;
};

export const vecReset = <T extends Vec>(r: T) => {
    vecSet(r);
};

export const vecCopy = <T extends Vec>(dst: T, src: T) => {
    vecSet(dst, ...src);
};

export const vecClone = <T extends Vec>(v: T) => {
    return vec4(...(v as Vec4)) as T;
};

export const vecAdd = <T extends Vec>(a: T, b: T, r?: T) => {
    r = r ?? a;
    r[0] = a[0] + b[0];
    r[1] = a[1] + b[1];
    (r as Vec4)[2] = (a as Vec4)[2] + (b as Vec4)[2];
    (r as Vec4)[3] = (a as Vec4)[3] + (b as Vec4)[3];
};

export const vecSub = <T extends Vec>(a: T, b: T, r?: T) => {
    r = r ?? a;
    r[0] = a[0] - b[0];
    r[1] = a[1] - b[1];
    (r as Vec4)[2] = (a as Vec4)[2] - (b as Vec4)[2];
    (r as Vec4)[3] = (a as Vec4)[3] - (b as Vec4)[3];
};

export const vecMulK = <T extends Vec>(a: T, k: number, r?: T) => {
    r = r ?? a;
    r[0] = a[0] * k;
    r[1] = a[1] * k;
    (r as Vec4)[2] = (a as Vec4)[2] * k;
    (r as Vec4)[3] = (a as Vec4)[3] * k;
};

export const vecFMKA = <T extends Vec>(a: T, k: number, b: T, r: T) => {
    r[0] = a[0] * k + b[0];
    r[1] = a[1] * k + b[1];
    (r as Vec4)[2] = (a as Vec4)[2] * k + (b as Vec4)[2];
    (r as Vec4)[3] = (a as Vec4)[3] * k + (b as Vec4)[3];
    return r;
};

export const vecDot = <T extends Vec>(a: T, b: T) => {
    // Validate vec type
    return a[0] * b[0] + a[1] * b[1] + (a as Vec4)[2] * (b as Vec4)[2] + (a as Vec4)[3] * (b as Vec4)[3];
};

export const vecLength = <T extends Vec>(a: T) => {
    return sqrt(vecDot(a, a));
};

export const vecNormalize = (a: Vec, r?: Vec) => {
    r = r ?? a;
    vecMulK(a, 1 / vecLength(a), r);
};

export const vecEq = (a: Vec, b: Vec) => {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
};

export const vecEqEps = (a: Vec, b: Vec, eps: number) => {
    return abs(b[0] - a[0]) < eps && abs(b[1] - a[1]) < eps && abs((b as Vec4)[2] - (a as Vec4)[2]) < eps && abs((b as Vec4)[3] - (a as Vec4)[3]) < eps;
};

export const vecAbs = (a: Vec, r?: Vec) => {
    r = r ?? a;
    r[0] = abs(a[0]);
    r[1] = abs(a[1]);
    (r as Vec4)[2] = abs((a as Vec4)[2]);
    (r as Vec4)[3] = abs((a as Vec4)[3]);
};

export const vecFract = (a: Vec, r?: Vec) => {
    r = r ?? a;
    r[0] = fract(a[0]);
    r[1] = fract(a[1]);
    (r as Vec4)[2] = fract((a as Vec4)[2]);
    (r as Vec4)[3] = fract((a as Vec4)[3]);
};

export const vecFloor = (a: Vec, r?: Vec) => {
    r = r ?? a;
    r[0] = floor(a[0]);
    r[1] = floor(a[1]);
    (r as Vec4)[2] = floor((a as Vec4)[2]);
    (r as Vec4)[3] = floor((a as Vec4)[3]);
};


export const vecMax = (a: Vec, b: Vec, r?: Vec) => {
    r = r ?? a;
    r[0] = max(a[0], b[0]);
    r[1] = max(a[1], b[1]);
    (r as Vec4)[2] = max((a as Vec4)[2], (b as Vec4)[2]);
    (r as Vec4)[3] = max((a as Vec4)[3], (b as Vec4)[3]);
};

export const vecSymmetricClamp = (a: Vec, b: Vec, r?: Vec) => {
    r = r ?? a;
    r[0] = symmetricClamp(a[0], b[0]);
    r[1] = symmetricClamp(a[1], b[1]);
    (r as Vec4)[2] = symmetricClamp((a as Vec4)[2], (b as Vec4)[2]);
    (r as Vec4)[3] = symmetricClamp((a as Vec4)[3], (b as Vec4)[3]);
};

export const vecMix = (a: Vec, b: Vec, t: number, r?: Vec) => {
    r = r ?? a;
    r[0] = mix(a[0], b[0], t);
    r[1] = mix(a[1], b[1], t);
    (r as Vec4)[2] = mix((a as Vec4)[2], (b as Vec4)[2], t);
    (r as Vec4)[3] = mix((a as Vec4)[3], (b as Vec4)[3], t);
};

export const vecNormalizeSafe = (a: Vec, r?: Vec) => {
    r = r ?? a;
    const l = vecLength(a);
    if (l === 0) {
        vecReset(r);
    } else {
        vecMulK(a, 1 / l, r);
    }
};

// Vectors must be normalized!
export const vec2AngleBetween = (a: Vec2, b: Vec2) => {
    return atan2(b[1] * a[0] - b[0] * a[1], a[0] * b[0] + a[1] * b[1]);
};

export const vec2Rotate = (v: Vec2, angle: number, r: Vec2) => {
    assert(v != r);
    const c = cos(angle);
    const s = sin(angle);
    r[0] = c * v[0] + s * v[1];
    r[1] = c * v[1] - s * v[0];
};

export const vec3Cross = (a: Vec3, b: Vec3, r: Vec3) => {
    assert(a != r);
    assert(b != r);
    r[0] = a[1] * b[2] - a[2] * b[1];
    r[1] = a[2] * b[0] - a[0] * b[2];
    r[2] = a[0] * b[1] - a[1] * b[0];
};

export const vec3CrossNormalize = (a: Vec3, b: Vec3, r: Vec3) => {
    vec3Cross(a, b, r);
    vecNormalizeSafe(r);
    return r;
};

// https://www.scratchapixel.com/lessons/3d-basic-rendering/minimal-ray-tracer-rendering-simple-shapes/ray-sphere-intersection.html
// Dir should be normalized please
export const sphereRayIntersection = (center: Vec3, r: number, o: Vec3, dir: Vec3): [a?: number, b?: number] => {
    const ret = [] as unknown as [undefined, undefined];

    const L = vecBorrow<Vec3>();
    vecSub(center, o, L);
    const tca = vecDot(L, dir);
    const d2 = vecDot(L, L) - tca * tca;
    if (d2 > r * r) {
        return ret;
    }

    const thc = sqrt(r * r - d2);

    let t0 = tca - thc;
    let t1 = tca + thc;

    if (t0 > t1) {
        [t0, t1] = [t1, t0];
    }

    return [t0, t1];
};

export const sphereSegmentIntersection = (center: Vec3, r: number, a: Vec3, b: Vec3) => {
    const dir = vecBorrow<Vec3>();
    vecSub(b, a, dir);
    const len = vecLength(dir);
    vecMulK(dir, 1 / len);
    const ts = sphereRayIntersection(center, r, a, dir);
    for (let i = 0; i < 2; ++i) {
        const t = ts[i];
        if (t != undefined && t >= 0 && t <= len) {
            return t;
        }
    }
    return -1;
}

// UNTESTED

// export const projectPointIntoPlane = (p: Vec3, planeOrigin: Vec3, normal: Vec3, r: Vec3) => {
//     vecSub(p, planeOrigin, r)
//     vecFMKA(r, -vecDot(r, normal), normal, r);
//     vecAdd(r, planeOrigin, r);
// };

// export const segmentSegmentIntersection = (p0: Vec3, p1: Vec3, q0: Vec3, q1: Vec3, r: Vec3) => {
//     // Borrow!
//     console.log(p0,p1,q0,q1);
//     const v = vec3Splay();
//     const u = vec3Splay();
//     const a = vec3Splay();
//     const b = vec3Splay();
//     vecSub(p1, p0, v);
//     vecSub(q1, q0, u);
//     vec3Cross(v, u, a);
//     const dot = vecDot(a, a);
//     if (dot == 0) {
//         return false;
//     }

//     vecSub(q0, p0, r);
//     vec3Cross(r, u, b);

//     const t = vecDot(b, a) / dot;

//     if (t >= 0 && t <= 1) {
//         vecFMKA(p0, t, v, r);
//         return true;
//     }
//     return false;
// };

export const vecToStr = (v: Vec) => {
    return `(${v[0]}, ${v[1]}, ${v[2]}, ${v[3]})`;
};

// Matrices

export const mat4Diagonal = (v: number, dst: Mat4) => {
    dst.fill(0);
    dst[0] = dst[5] = dst[10] = dst[15] = v;
}

export const mat4 = (v: number) => {
    let m = Array(16) as Mat4;
    mat4Diagonal(1, m);
    return m;
};

const tmpMat4_0 = mat4(1);
const tmpMat4_1 = mat4(1);

export const mat4Copy = (dst: Mat4, src: Mat4) => {
    for (let i = 0; i < 16; ++i) {
        dst[i] = src[i];
    }
};

// (dst, x, y, z, t);
export const mat4FromBasisPlusTranslation = (dst: Mat4, ...vecs: [Vec3, Vec3, Vec3, Vec3]) => {
    mat4Diagonal(1, dst);
    for (let i = 0; i < 4; ++i) {
        // hack for js2024: the way I did the basis is flipping 
        // the objects winding, so I'll negate the first vector to fix this
        const scale = i == 0 ? -1 : 1;
        for (let c = 0; c < 3; ++c) {
            dst[i * 4 + c] = vecs[i][c] * scale;
        }
    }
};

export const mat4FromBasis = (x: Vec3, y: Vec3, z: Vec3, dst: Mat4) => {
    mat4Diagonal(1, dst);
    mat4FromBasisPlusTranslation(dst, x, y, z, zeroVector as Vec3);
};

export const mat4Ortho = (rw: number, rh: number, near: number, far: number, dst: Mat4) => {
    const depthSize: number = far - near;
    mat4Diagonal(1, dst);
    dst[0] = 1 / rw;
    dst[5] = -1 / rh;
    dst[10] = -2 / depthSize;
    dst[14] = -(near + far) / depthSize;
};

// https://www.songho.ca/opengl/gl_projectionmatrix.html
export const mat4Perspective = (right: number, top: number, near: number, far: number, dst: Mat4) => {
    const depthSize = far - near;
    mat4Diagonal(1, dst);
    dst[0] = near / right;
    dst[5] = near / top;
    dst[10] = -(near + far) / depthSize;
    dst[11] = -1;
    dst[14] = -2 * far * near / depthSize;
    dst[15] = 0;
};

export const mat4PerspectiveHorizontalFov = (horizontalFov: number, aspect: number, near: number, far: number, dst: Mat4) => {
    const right = near * tan(horizontalFov / 2);
    const top = -right / aspect;
    mat4Perspective(right, top, near, far, dst);
};

export const mat4PerspectiveVerticalFov = (verticalFov: number, aspect: number, near: number, far: number, dst: Mat4) => {
    const top = -near * tan(verticalFov / 2);
    const right = -top * aspect;
    mat4Perspective(right, top, near, far, dst);
};

export const mat4LookAt = (eye: Vec3, target: Vec3, up: Vec3, dst: Mat4) => {
    let dir = vecBorrow<Vec3>();
    vecSub(target, eye, dir);
    vecNormalize(dir);
    let side = vecBorrow<Vec3>();
    vec3Cross(dir, up, side);
    vecNormalize(side);
    let viewUp = vecBorrow<Vec3>();
    vec3Cross(dir, side, viewUp);
    vecNormalize(viewUp);

    mat4Diagonal(1, dst);
    dst[0] = side[0];
    dst[1] = viewUp[0];
    dst[2] = -dir[0];

    dst[4] = side[1];
    dst[5] = viewUp[1];
    dst[6] = -dir[1];

    dst[8] = side[2];
    dst[9] = viewUp[2];
    dst[10] = -dir[2];

    dst[12] = -vecDot(side, eye);
    dst[13] = -vecDot(viewUp, eye);
    dst[14] = vecDot(dir, eye);
};

export const mat4GetColumn = (m: Mat4, n: number, r: Vec4) => {
    const idx = n * 4;
    vecSet(r, m[idx], m[idx + 1], m[idx + 2], m[idx + 3]);
};

export const mat4GetRow = (m: Mat4, n: number, r: Vec4) => {
    const idx = n;
    vecSet(r, m[idx], m[idx + 4], m[idx + 8], m[idx + 12]);
}

export const mat4Translate = (m: Mat4, p: Vec3, r: Mat4) => {
    mat4Diagonal(1, tmpMat4_0);
    tmpMat4_0[12] = p[0];
    tmpMat4_0[13] = p[1];
    tmpMat4_0[14] = p[2];
    mat4Mul(m, tmpMat4_0, r);
}

export const mat4Scale = (m: Mat4, scale: number, r: Mat4) => {
    mat4Diagonal(scale, tmpMat4_0);
    tmpMat4_0[15] = 1;
    mat4Mul(m, tmpMat4_0, r);
};

export const mat4ToConsole = (m: Mat4) => {
    console.log(`-----------------------------------------------`);
    console.log(`| ${m[0].toFixed(4)} ${m[4].toFixed(4)} ${m[8].toFixed(4)} ${m[12].toFixed(4)} |`);
    console.log(`| ${m[1].toFixed(4)} ${m[5].toFixed(4)} ${m[9].toFixed(4)} ${m[13].toFixed(4)} |`);
    console.log(`| ${m[2].toFixed(4)} ${m[6].toFixed(4)} ${m[10].toFixed(4)} ${m[14].toFixed(4)} |`);
    console.log(`| ${m[3].toFixed(4)} ${m[7].toFixed(4)} ${m[11].toFixed(4)} ${m[15].toFixed(4)} |`);
    console.log(`-----------------------------------------------`);
};

// Inefficient as it can be, but short code.
export const mat4Mul = (a: Mat4, b: Mat4, dst: Mat4) => {
    const vA = vecBorrow<Vec4>();
    const vB = vecBorrow<Vec4>();
    assert(a != dst && b != dst);
    for (let col = 0; col < 4; ++col) {
        mat4GetColumn(b, col, vB);
        for (let row = 0; row < 4; ++row) {
            mat4GetRow(a, row, vA);
            dst[col * 4 + row] = vecDot(vA, vB);
        }
    }
}

/*
    Quaternions are stored as [i,j,k,1]
*/

export const quat = () => {
    return vec4Splay() as Quaternion;
};

export const quatFromAxisAngle = (axis: Vec3, angle: number, r: Quaternion) => {
    const ha = angle / 2;
    r[0] = axis[0] * sin(ha);
    r[1] = axis[1] * sin(ha);
    r[2] = axis[2] * sin(ha);
    r[3] = cos(ha);
};

// Dir must be normalized, 
export const quatFromDirection = (dir: Vec3, r: Quaternion) => {
    if (vecEq(dir, xAxisNeg)) {
        vecCopy(r, identityQuaternion);
        return;
    }
    if (vecEq(dir, xAxis)) {
        quatFromAxisAngle(zAxis, Deg * 180, r);
        return;
    }

    let tmpNormal = vecBorrow<Vec3>();
    vec3Cross(xAxisNeg, dir, tmpNormal);
    vecNormalize(tmpNormal);
    quatFromAxisAngle(tmpNormal, acos(vecDot(xAxisNeg, dir)), r);
};

export const quatMul = (a: Quaternion, b: Quaternion, r: Quaternion) => {
    assert(a != r);
    assert(b != r);

    r[3] = a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2];
    r[0] = a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1];
    r[1] = a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0];
    r[2] = a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3];
};

export const quatConj = (q: Quaternion, r: Quaternion) => {
    r[0] = -q[0];
    r[1] = -q[1];
    r[2] = -q[2];
    r[3] = q[3];
}

// https://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/transforms/index.htm
export const quatApplyToVec3 = (a: Quaternion, v: Vec3, r: Vec3) => {
    const tmp1 = vecBorrow<Vec3>();
    const tmpQ = vecBorrow<Quaternion>();
    const conj = vecBorrow<Quaternion>();
    quatMul(a, v as any, tmpQ);
    quatConj(a, conj);
    quatMul(tmpQ, conj, tmp1 as any);
    vecCopy(r, tmp1);
    (r as any)[3] = 0;
};

export const quatApplyToVec3Normalize = (a: Quaternion, v: Vec3, r: Vec3) => {
    quatApplyToVec3(a, v, r);
    vecNormalizeSafe(r);
};

//from https://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToMatrix/index.htm
export const quatToMatrix = (q: Quaternion, mat: Mat4) => {
    mat4Diagonal(1, mat);

    const sqw = q[3] * q[3];
    const sqx = q[0] * q[0];
    const sqy = q[1] * q[1];
    const sqz = q[2] * q[2];

    // invs (inverse square length) is only required if quaternion is not already normalised
    const invs = 1 / (sqx + sqy + sqz + sqw)
    mat[0] = (sqx - sqy - sqz + sqw) * invs; // since sqw + sqx + sqy + sqz =1/invs*invs
    mat[5] = (-sqx + sqy - sqz + sqw) * invs;
    mat[10] = (-sqx - sqy + sqz + sqw) * invs;

    {
        const tmp1 = q[0] * q[1];
        const tmp2 = q[2] * q[3];
        mat[4] = 2.0 * (tmp1 + tmp2) * invs;
        mat[1] = 2.0 * (tmp1 - tmp2) * invs;
    }
    {
        const tmp1 = q[0] * q[2];
        const tmp2 = q[1] * q[3];
        mat[8] = 2.0 * (tmp1 - tmp2) * invs;
        mat[2] = 2.0 * (tmp1 + tmp2) * invs;
    }
    {
        const tmp1 = q[1] * q[2];
        const tmp2 = q[0] * q[3];
        mat[9] = 2.0 * (tmp1 + tmp2) * invs;
        mat[6] = 2.0 * (tmp1 - tmp2) * invs;
    }
}



let borrowerPos = 0;
const vecsToBorrow = Array(0x20000).fill(0).map(() => vec4Splay());

export const vecBorrow = <T>() => {
    assert(borrowerPos < 0x10000);
    const borrowed = vecsToBorrow[borrowerPos++] as T;
    // It needs to be resetted because most operations work 
    // with dimensions<4 assuming the rest of the components are 0
    vecReset(borrowed as any);
    return borrowed;
};

export const vecBorrowerCheckpoint = () => {
    return borrowerPos;
};

export const vecBorrowerRestore = (n: number) => {
    borrowerPos = n;
};

export const resetVectorBorrower = () => {
    borrowerPos = 0;
};

export const mat4Vec4Mul = (mat: Mat4, v: Vec4, r: Vec4) => {
    assert(v != r);
    r[0] = mat[0] * v[0] + mat[4] * v[1] + mat[8] * v[2] + mat[12] * v[3];
    r[1] = mat[1] * v[0] + mat[5] * v[1] + mat[9] * v[2] + mat[13] * v[3];
    r[2] = mat[2] * v[0] + mat[6] * v[1] + mat[10] * v[2] + mat[14] * v[3];
    r[3] = mat[3] * v[0] + mat[7] * v[1] + mat[11] * v[2] + mat[15] * v[3];
};

export const xAxis = vec3(1, 0, 0);
export const yAxis = vec3(0, 1, 0);
export const zAxis = vec3(0, 0, 1);
export const xAxisNeg = vec3(-1, 0, 0);
export const yAxisNeg = vec3(0, -1, 0);
export const zAxisNeg = vec3(0, 0, -1);
export const zeroVector: Vec = [0, 0, 0, 0];
export const oneVec3 = vec3Splay(1);
export const halfVec3 = vec3Splay(0.5);
export const identityMat4: Mat4 = mat4(1);
export const identityQuaternion: Quaternion = [0, 0, 0, 1];