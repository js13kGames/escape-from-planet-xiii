// Based on implementation from: https://github.com/Q-Minh/naive-surface-nets/blob/master/src/surface_nets.cpp

import { renderSDF3dTex, SDFNode } from "./sdfGPUEval";
import { vec3Splay, vecArray, Vec3, vecFMKA, vecNormalize, vecBorrow, vec3, vecReset, vecAdd, vecSet, vecMix, vecMulK, vecClone, xAxis, yAxis, zAxis, zAxisNeg, yAxisNeg, xAxisNeg, halfVec3, vecFloor, vecFract } from "./juvec";
import { createVertexAttributesLayout, createMesh, meshAttribsLayout } from "./renderer";
import { arrayPush, mix } from "~aliasedFunctions";

// texture interleaved as value,mat
const floatsPerSdfTexEntry = 4;

export const meshFromSdf = (sdf: SDFNode, volumeRadius: number, halfResolution: number) => {
    const mesh = createMesh(meshAttribsLayout);
    const sdfWidth = halfResolution * 2;

    // Build sdf texture
    const sdfTex = renderSDF3dTex(sdf, sdfWidth, volumeRadius);

    const nEps = 0.0001;

    const nDirVecs = vecArray<Vec3>(4);
    nDirVecs[0][0] = nDirVecs[1][2] = nDirVecs[2][1] = nDirVecs[3][0] = nDirVecs[3][1] = nDirVecs[3][2] = 1;
    nDirVecs[0][1] = nDirVecs[0][2] = nDirVecs[1][0] = nDirVecs[1][1] = nDirVecs[2][0] = nDirVecs[2][2] = -1;

    const tmpVec = vecBorrow<Vec3>();
    const tmpNormal = vecBorrow<Vec3>();

    const indexIntoSdfTex = (iuv: Vec3) => {
        return (iuv[2] * sdfWidth * sdfWidth + iuv[1] * sdfWidth + iuv[0]) * floatsPerSdfTexEntry;
    };

    const getSdfTexValue = (iuv: Vec3) => {
        return sdfTex[indexIntoSdfTex(iuv)];
    };


    const vFract = vecBorrow<Vec3>();
    const vFloor = vecBorrow<Vec3>();

    const sdfInterpolatedEval = (p: Vec3) => {
        vecFMKA(p, 1 / (2 * volumeRadius), halfVec3, vFloor);
        vecMulK(vFloor, sdfWidth - 1);
        vecFract(vFloor, vFract);
        vecFloor(vFloor);

        const samples = [];

        for (let i = 0; i < 8; ++i) {
            vecSet(tmpVec, (i >> 2) & 1, (i >> 1) & 1, i & 1);
            vecAdd(tmpVec, vFloor);
            samples[i] = getSdfTexValue(tmpVec)
        }

        const a = mix(samples[0], samples[4], vFract[0]);
        const b = mix(samples[2], samples[6], vFract[0]);
        const c = mix(samples[1], samples[5], vFract[0]);
        const d = mix(samples[3], samples[7], vFract[0]);

        const e = mix(a, b, vFract[1]);
        const f = mix(c, d, vFract[1]);

        return mix(e, f, vFract[2]);

        //return getSdfTexValue(tmpVec);
        // sdfWidth*(p/(2*vr)+0.5)
    };

    const avg = vecBorrow<Vec3>();
    const iuv = vecBorrow<Vec3>();
    const curCoords = vecBorrow<Vec3>();

    const volumeCorner = vec3Splay(-volumeRadius);

    const activeCubes = {} as any;

    for (let iZ = 0; iZ < sdfWidth - 1; ++iZ) {
        for (let iY = 0; iY < sdfWidth - 1; ++iY) {
            for (let iX = 0; iX < sdfWidth - 1; ++iX) {
                vecSet(curCoords, iX, iY, iZ);
                // Get average of all points in all edges that go through the iso-surface
                vecReset(avg);
                let numEdgePoints = 0;

                const edgeSigns: number[] = [];

                for (let ec of edgeConnections) {
                    const p0 = unitCubeVertices[ec[0]];
                    vecAdd(curCoords, p0, iuv)
                    const p0v = getSdfTexValue(iuv);
                    const p1 = unitCubeVertices[ec[1]];
                    vecAdd(curCoords, p1, iuv)
                    const p1v = getSdfTexValue(iuv);


                    arrayPush(edgeSigns, p0v);


                    // Skip non-crossing edges
                    if (!((p0v <= 0 && p1v > 0) || (p1v <= 0 && p0v > 0))) {
                        continue;
                    }

                    // The ratio of p0v and p1v (which are the opposite sides on the triangle between
                    // the edge and the surface, because the surface is through the edge)
                    // is the same as the ratio of the adjacent sides (Because the triangles are similar)
                    // which are p0 - ps and ps - p1
                    // thus, we can use lineal interpolation to get the intersection point ps.  
                    const t = p0v / (p0v - p1v);
                    vecMix(p0, p1, t, tmpVec);
                    vecAdd(avg, tmpVec);
                    ++numEdgePoints;
                }

                if (numEdgePoints > 0) {
                    vecMulK(avg, 1 / numEdgePoints);
                    const cubeIdx = indexIntoSdfTex(curCoords);
                    // Map to model space
                    vecAdd(avg, curCoords);
                    vecFMKA(avg, 2 * volumeRadius / (sdfWidth - 1), volumeCorner, avg);

                    vecReset(tmpNormal);
                    // Super coarse approach

                    for (let i = 0; i < 4; ++i) {
                        vecFMKA(nDirVecs[i], nEps, avg, tmpVec);
                        const val = sdfInterpolatedEval(tmpVec);
                        vecFMKA(nDirVecs[i], val, tmpNormal, tmpNormal);
                    }

                    vecNormalize(tmpNormal);

                    activeCubes[cubeIdx] = [[vecClone(avg), vecClone(tmpNormal), [sdfTex[cubeIdx + 1]]], vecClone(curCoords), edgeSigns];
                }
            }
        }
    }

    const edgeIdxs = [0, 3, 8];
    const vertOrders = [[3, 2, 1], [1, 2, 3]];

    const neighborOffsets = [
        [vec3(0, -1, 0), vec3(0, -1, -1), vec3(0, 0, -1)], //0-1
        [vec3(-1, 0, 0), vec3(-1, 0, -1), vec3(0, 0, -1)], //0-3
        [vec3(-1, 0, 0), vec3(-1, -1, 0), vec3(0, -1, 0)], //0-4
    ];

    const vertexCubes = [];

    for (let activeIdx in activeCubes) {
        const active = activeCubes[activeIdx];
        const coords = active[1];

        if (coords[0] == 0 || coords[1] == 0 || coords[2] == 0) {
            continue;
        }

        // For each active edge, get the four cubes that share that edge,
        // If all the cubes are active, create a quad

        vertexCubes[0] = active;

        for (let edgeI = 0; edgeI < 3; ++edgeI) {
            let isActive = true;

            for (let i = 0; i < 3; ++i) {
                vecAdd(neighborOffsets[edgeI][i], coords, tmpVec);
                const idx = indexIntoSdfTex(tmpVec);
                const cube = activeCubes[idx];
                vertexCubes[i + 1] = cube;
                isActive = isActive && cube;
            }

            if (!isActive) {
                continue;
            }

            const curVertIds = vertOrders[(active[2][edgeIdxs[edgeI]] > 0) ? 0 : 1];

            mesh.addVertex(...vertexCubes[0][0]);
            mesh.addVertex(...vertexCubes[curVertIds[0]][0]);
            mesh.addVertex(...vertexCubes[curVertIds[1]][0]);

            mesh.addVertex(...vertexCubes[0][0]);
            mesh.addVertex(...vertexCubes[curVertIds[1]][0]);
            mesh.addVertex(...vertexCubes[curVertIds[2]][0]);

        }
    }

    return mesh;
}

const edgeConnections = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
];

const unitCubeVertices = [
    vec3(0, 0, 0),
    vec3(1, 0, 0),
    vec3(1, 1, 0),
    vec3(0, 1, 0),
    vec3(0, 0, 1),
    vec3(1, 0, 1),
    vec3(1, 1, 1),
    vec3(0, 1, 1),
];