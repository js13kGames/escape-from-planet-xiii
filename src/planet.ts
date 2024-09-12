import { arrayIndexWrap, arrayLast, physEps } from "./utils";
import { identityMat4, mat4, mat4FromBasisPlusTranslation, mat4Scale, mat4Translate, quat, quatApplyToVec3, quatFromAxisAngle, vec2, Vec2, Vec3, vec3, vec3Cross, vec3CrossNormalize, vec3Splay, vecAdd, vecBorrow, vecBorrowerCheckpoint, vecBorrowerRestore, vecClone, vecCopy, vecDot, vecEq, vecEqEps, vecFMKA, vecLength, vecMulK, vecNormalizeSafe, vecSet, vecSub, xAxis, xAxisNeg, yAxis, yAxisNeg, zAxis, zAxisNeg } from "./juvec";
import { createMesh, createMeshInstance, createOctahedron, createVertexAttributesLayout, meshAttribsLayout, MeshInstance } from "./renderer";
import * as glEnum from "./webglEnums";
import { meshFromSdf } from "./sdfNaiveSurfaceNets";
import { acos, arrayPush, assert, clamp, cos, max, min, Pi, pickRandomFromArray, random, randomRange, sin } from "./aliasedFunctions";
import { startflagPoleHH, MaterialRoad, meshes, MeshPlanetCore, MeshStartFlag, MeshTree0, MaterialRainbow, MaterialMetal, streetlightHH } from "~assets";

export const FenceWidth = 0.2;
export const RainbowRoadHW = 0.18;

interface ArcSegmentPoint {
    pos: Vec3;
    dir: Vec3;
    curveTangent: Vec3;
    tg: Vec3;
    planarLength: number;
};

export const arcsInUnitSphereIntersection = (a0: Vec3, a1: Vec3, b0: Vec3, b1: Vec3): Vec3 | undefined => {
    const borrowerChk = vecBorrowerCheckpoint();
    const aN = vec3CrossNormalize(a0, a1, vecBorrow<Vec3>());
    const bN = vec3CrossNormalize(b0, b1, vecBorrow<Vec3>());

    const L = vec3CrossNormalize(aN, bN, vecBorrow<Vec3>()); // L is the line intersecting the planes of both great circles

    // If it's in short arc then the arc length betwen ax, and bx should be smaller than ab!
    const isInShortArc = (vA: Vec3, vB: Vec3, vX: Vec3) => {
        const ab = acos(vecDot(vA, vB));
        const ax = acos(vecDot(vA, vX));
        const bx = acos(vecDot(vB, vX));
        return ax < ab && bx < ab;
    }

    for (let s = 0; s < 2; ++s) {
        if (isInShortArc(a0, a1, L) && isInShortArc(b0, b1, L)) {
            return vecClone(L);
        }
        vecMulK(L, -1);
    }
    vecBorrowerRestore(borrowerChk);
};

const catmullRomForcedToUnitSphere = (unitControlPoints: Vec3[], nSegments: number) => {
    const ret: Vec3[] = [];

    const vTmp1 = vecBorrow<Vec3>();
    const mA = vecBorrow<Vec3>();
    const mB = vecBorrow<Vec3>();
    const f3 = vecBorrow<Vec3>();
    const f2 = vecBorrow<Vec3>();

    for (let curveI = 0; curveI < unitControlPoints.length; ++curveI) {
        const pA = arrayIndexWrap(unitControlPoints, curveI);
        const pB = arrayIndexWrap(unitControlPoints, curveI + 1);

        vecSub(pB, arrayIndexWrap(unitControlPoints, curveI - 1), mA);
        vecMulK(mA, 0.5);

        vecSub(arrayIndexWrap(unitControlPoints, curveI + 2), pA, mB);
        vecMulK(mB, 0.5);

        vecAdd(mA, mB, f3);
        vecFMKA(pA, 2, f3, f3);
        vecFMKA(pB, -2, f3, f3);

        vecMulK(mB, -1, f2);
        vecFMKA(pA, -3, f2, f2);
        vecFMKA(pB, 3, f2, f2);
        vecFMKA(mA, -2, f2, f2);

        for (let i = 0; i < nSegments; ++i) {
            const k = i / (nSegments - 1);
            vecFMKA(mA, k, pA, vTmp1);
            vecFMKA(f2, k * k, vTmp1, vTmp1);
            vecFMKA(f3, k * k * k, vTmp1, vTmp1);
            vecNormalizeSafe(vTmp1);
            arrayPush(ret, vecClone(vTmp1));
        }
    }

    return ret;
}

export const PlanetAffixEndurance = 1;
export const PlanetAffixZoomedIn = 2;
export const PlanetAffixNoSun = 3;
export const PlanetAffixNight = 4;
export const PlanetAffixTightFences = 5;
export const PlanetAffixSlippery = 6;
export const PlanetAffixSuperTraction = 7;
export const PlanetAffixExtraLong = 8;
export const PlanetAffixTotal = PlanetAffixExtraLong;

export const PlanetAffixStrings = [
    "Endurance",
    "Close View",
    "No Sun",
    "Night",
    "Tight Fences",
    "Slippery",
    "Sticky Road",
    "Extra Long",
];

export const PlanetAffixRainbow = 100;

const mapSegmentsToArcSegmentPoint = (path: Vec3[], reverseTangentHack?: boolean): ArcSegmentPoint[] => path.map((pos, i) => {
    const curveTangent = vec3Splay();
    const nextPoint = arrayIndexWrap(path, i + 1);
    vecSub(arrayIndexWrap(path, i + 1), arrayIndexWrap(path, i - 1), curveTangent);
    vecNormalizeSafe(curveTangent);

    const dir = vec3Splay();
    vecSub(nextPoint, pos, dir);
    const planarLength = vecLength(dir);

    const tg = vec3Splay();
    vec3CrossNormalize(pos, curveTangent, tg);
    if (reverseTangentHack) {
        vecMulK(tg, -1);
    }
    return {
        pos,
        curveTangent,
        tg,
        planarLength,
        dir,
    };
});

export const createPlanet = (affixes: number[]) => {
    const borrowerChk = vecBorrowerCheckpoint();

    const fences: ArcSegmentPoint[][] = [];

    const roadMesh = createMesh(meshAttribsLayout);
    roadMesh.primType = glEnum.TRIANGLE_STRIP;
    const roadHalfWidth = 0.085;

    let controlPoints!: Vec3[];
    const checkpoints: [Vec3, Vec3][] = [];

    const isRainbow = affixes.includes(PlanetAffixRainbow);

    const generateControlPoints = () => {
        type Tri = {} & ReturnType<typeof createOctahedron>[1][0];

        const [vertices, triangles] = createOctahedron(1) as [Vec3[], Tri[]];

        const connectedTriangles = (t: Tri) => {
            return triangles.filter(x => {
                let count = 0;
                for (let i = 0; x != t && i < 3; ++i) {
                    count += x.vertices.includes(t.vertices[i]) ? 1 : 0;
                    if (count == 2) {
                        return true;
                    }
                }
                return false;
            });
        }

        const firstTri = triangles[0];
        let nextTri = firstTri;
        const processedTriangles: Tri[] = [];

        for (; ;) {
            let triCandidates = connectedTriangles(nextTri);
            if (processedTriangles.length > 1 && triCandidates.includes(firstTri)) {
                controlPoints = processedTriangles.map(x => {
                    const p = vec3Splay(0);
                    for (let v of x.vertices) {
                        vecAdd(p, vertices[v], p);
                    }
                    vecMulK(p, 1 / 3);
                    vecNormalizeSafe(p);
                    return p;
                });
                return true;
            }
            triCandidates = triCandidates.filter(x => !processedTriangles.includes(x));
            if (triCandidates.length == 0) {
                return false;
            }
            arrayPush(processedTriangles, nextTri);
            nextTri = pickRandomFromArray(triCandidates);
        }
    }

    for (; ;) {
        const generated = generateControlPoints();
        if (generated) {
            break;
        }
    }

    // Nudge control points to middle of edges in 
    // an naive attempt of generating softer tracks
    const controlPointsNudge = 0.5;
    controlPoints = mapSegmentsToArcSegmentPoint(controlPoints).map((x) => {
        return vecFMKA(x.dir, controlPointsNudge, x.pos, vec3Splay());
    });

    // MUST ALWAYS BE EVEN!
    const segmentsPerCurve = 20;

    const middlePoints = catmullRomForcedToUnitSphere(controlPoints, segmentsPerCurve);

    let totalDistance = 0;

    const atNight = affixes.includes(PlanetAffixNight) || affixes.includes(PlanetAffixNoSun);

    let playerStartPos = vec3Splay();
    let playerStartDir = vec3Splay();
    let playerStartTg = vec3Splay();

    // Build fences 
    let fenceWidth = affixes.includes(PlanetAffixTightFences) ? (FenceWidth * 0.7) : FenceWidth;

    for (let i = 0; i < 2; ++i) {
        fences[i] = mapSegmentsToArcSegmentPoint(catmullRomForcedToUnitSphere(mapSegmentsToArcSegmentPoint(controlPoints).map(x => {
            const p = vecFMKA(x.tg, (i ? 1 : -1) * fenceWidth, x.pos, vec3Splay());
            vecNormalizeSafe(p);
            return p;
        }), segmentsPerCurve), !i);
    }

    const roadTangentSegments = 6;
    const roadSegmentTriStripes: [Vec3, Vec3, [number], Vec2][][] = Array(roadTangentSegments).fill(0).map(_ => []);

    const streetlights: [spotPos: Vec3, spotDir: Vec3][] = [];
    const distBetweenStreetlights = 0.5;
    let nextStreetlightDist = distBetweenStreetlights;

    const middlePointArcs = mapSegmentsToArcSegmentPoint(middlePoints);

    const roadMaterial = isRainbow ? MaterialRainbow : MaterialRoad;

    for (let mpIdx = 0; mpIdx < middlePointArcs.length; ++mpIdx) {
        const { pos, tg, curveTangent: dir, planarLength } = middlePointArcs[mpIdx];

        if (mpIdx == segmentsPerCurve / 2) {
            vecCopy(playerStartPos, middlePoints[mpIdx]);
            vecCopy(playerStartDir, dir);
            vecCopy(playerStartTg, tg);
        }

        const getTangentPoint = (w: number) => {
            const v = vecFMKA(tg, w, pos, vec3Splay());
            vecNormalizeSafe(v);
            return v;
        }


        for (let i = 0; i < roadTangentSegments; ++i) {
            for (let j = 1; j >= 0; --j) {
                const xOffset = (2 * (i + j) / roadTangentSegments - 1);
                const hh = isRainbow ? RainbowRoadHW : roadHalfWidth;
                const v = getTangentPoint(-hh * xOffset);
                arrayPush(roadSegmentTriStripes[i], [v, v, [roadMaterial], [(i + j) / roadTangentSegments, 0]]);
            }
        }

        totalDistance += planarLength;

        if (atNight) {
            nextStreetlightDist -= planarLength;
            if (nextStreetlightDist <= 0) {
                nextStreetlightDist += distBetweenStreetlights;
                const spotPos = vecFMKA(pos, streetlightHH, pos, vec3Splay());
                const spotDir = vec3Splay();
                vecMulK(pos, -1, spotDir);
                arrayPush(streetlights, [spotPos, spotDir]);
            }
        }

        if ((mpIdx + segmentsPerCurve / 2) % segmentsPerCurve == 0) {
            const a = getTangentPoint(fenceWidth * 1.25);
            const b = getTangentPoint(-fenceWidth * 1.25);
            arrayPush(checkpoints, [a, b]);
        }
    }

    for (let strip of roadSegmentTriStripes) {
        arrayPush(strip, strip[0], strip[1], strip[1]);

        roadMesh.addVertex(...strip[0]);
        for (let v of strip) {
            roadMesh.addVertex(...v);
        }
    }

    roadMesh.zOffset = true;

    const fencesMeshes = [createMesh(meshAttribsLayout), createMesh(meshAttribsLayout)];

    if (!isRainbow) {
        for (let fenceId = 0; fenceId < 2; ++fenceId) {
            const tmpVert = vecBorrow<Vec3>();
            const tmpTg = vecBorrow<Vec3>();
            fencesMeshes[fenceId].primType = glEnum.TRIANGLE_STRIP;
            fencesMeshes[fenceId].noCull = true;
            for (let v of fences[fenceId]) {
                const fenceHeight = 0.025;
                for (let i = 0; i < 2; ++i) {
                    vecFMKA(v.pos, fenceHeight * (i - 0.5), v.pos, tmpVert);
                    vecMulK(v.tg, -1, tmpTg);
                    fencesMeshes[fenceId].addVertex(tmpVert, tmpTg, [MaterialMetal]);
                }
            }
        }
    } else {
        roadMesh.noCull = true;
    }

    const tmpMat = mat4(1);
    const tmpMat2 = mat4(1);
    const tmpQ = quat();
    const treeInstances: MeshInstance[] = [];
    const tmpPos = vecBorrow<Vec3>();
    const tmpTg = vecBorrow<Vec3>();
    const tmpTg2 = vecBorrow<Vec3>();

    if (!isRainbow) {
        for (let i = 0; i < 120; ++i) {
            const instance = createMeshInstance(meshes[MeshTree0 + (i % 4)]);

            // Uniform distribution 
            let distToPath: number;
            do {
                const theta = 2 * Pi * random();
                const phi = acos(randomRange(-1, 1));
                vecSet(tmpPos, cos(theta) * sin(phi), sin(theta) * sin(phi), cos(phi));
                vecNormalizeSafe(tmpPos);
                distToPath = getDistanceToMainPath(middlePointArcs, tmpPos);
            } while (distToPath < FenceWidth * 1.24);

            const m = instance.modelMatrix;

            if (tmpPos[0] == 0 && tmpPos[1] == 0) {
                vecSet(tmpTg, 0, 1, 0);
            } else {
                vecSet(tmpTg, -tmpPos[1], tmpPos[0], tmpPos[2]);
            }

            quatFromAxisAngle(tmpPos, random() * 5, tmpQ);
            quatApplyToVec3(tmpQ, tmpTg, tmpTg);

            vec3CrossNormalize(tmpPos, tmpTg, tmpTg2);

            vec3CrossNormalize(tmpPos, tmpTg2, tmpTg);


            mat4FromBasisPlusTranslation(tmpMat, tmpTg, tmpTg2, tmpPos, tmpPos);
            mat4Scale(tmpMat, 18, tmpMat2);
            mat4Translate(tmpMat2, vec3(0, 0, 0.0035), instance.modelMatrix);


            arrayPush(treeInstances, instance);
        }
    }

    const meshInstances = [
        createMeshInstance(fencesMeshes[0]),
        createMeshInstance(fencesMeshes[1]),
        createMeshInstance(roadMesh),
        ...treeInstances,
    ];

    if (!isRainbow) {
        arrayPush(meshInstances, createMeshInstance(meshes[MeshPlanetCore]));
    }

    const pointLights: [pos: Vec3, color: Vec3, radius: number, angleAcos: number, normal: Vec3][] = [];

    for (let s of streetlights) {
        arrayPush(pointLights, [s[0], vec3(1.5, 1.5, 0.8), 0.3, 0, s[1]]);
    }

    {
        const instance = createMeshInstance(meshes[MeshStartFlag]);

        const m = instance.modelMatrix;

        mat4FromBasisPlusTranslation(tmpMat, playerStartTg, playerStartDir, playerStartPos, playerStartPos);
        mat4Translate(tmpMat, vec3(0, 0, startflagPoleHH * 0.65), m);

        arrayPush(meshInstances, instance);
    }

    vecBorrowerRestore(borrowerChk);

    console.log("Track distance:", totalDistance);

    return {
        meshInstances,
        fencesMeshes,
        roadMesh,
        fences,
        playerStartPos,
        playerStartDir,
        checkpoints,
        totalDistance,
        middlePointArcs,
        affixes,
        pointLights,
    };
};

export const destroyPlanet = (planet: Planet) => {
    planet.fencesMeshes[0].destroy();
    planet.fencesMeshes[1].destroy();
    planet.roadMesh.destroy();
};

const getDistanceToMainPath = (path: Planet["middlePointArcs"], p: Vec3) => {
    const tmpVec = vecBorrow<Vec3>();
    return path.reduce((prev, cur) => {
        vecSub(p, cur.pos, tmpVec);
        const d = clamp(vecDot(cur.curveTangent, tmpVec), 0, cur.planarLength);
        vecFMKA(cur.curveTangent, d, cur.pos, tmpVec);
        vecSub(p, tmpVec, tmpVec);
        return min(prev, vecLength(tmpVec));
    }, Infinity);
};

export const getPlanetDistanceToMainPath = (planet: Planet, p: Vec3) => {
    return getDistanceToMainPath(planet.middlePointArcs, p);
};

export type Planet = ReturnType<typeof createPlanet>;