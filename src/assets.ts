
import { createTextureArray, gl, pushTextureArrayLayer, TextureArray } from "./webgl";
import * as glEnum from "./webglEnums";
import { createTetraSphereMesh, createUnitQuadMesh, createVertexAttributesLayout, Mesh, VertexAttributesLayout } from "./renderer";
import { meshFromSdf } from "./sdfNaiveSurfaceNets";
import { soundInit } from "~sound";
import { arrayPush, Deg, floor, mix, random, randomRange } from "~aliasedFunctions";
import { FenceWidth } from "~planet";
import { BOX, cylinder, DISTORT, intersect, INTERSECT, PLANE, ROTATE, SCALE, SDFNode, SET_MATERIAL, SPHERE, SYMMETRY, TRANSLATE, union, UNION } from "./sdfGPUEval";
import { titleDiv } from "~index";


// Only the lower 5 bits of the material have the
// mat id. The upper 3 are for params.

export const MaterialGrass = 0;
export const MaterialRoad = 1;
export const MaterialCar = 2;
export const MaterialTire = 3;
export const MaterialTreeTop = 4;
export const MaterialTreeBranch = 5;
export const MaterialRainbow = 6;
export const MaterialMetal = 7;
export const MaterialCheckersFlag = 8;

export const materialTexArrayResolution = 1024;

export const carLength = 0.02;
export const startflagPoleHH = 0.07;

export const streetlightHH = 0.05;

export let meshes: Mesh[];
export const MeshCar = 0;
export const MeshCarTofu = 1;
export const MeshCarPart = 2;
export const MeshStartFlag = 3;
export const MeshTree0 = 4;
export const MeshTree1 = 5;
export const MeshTree2 = 6;
export const MeshTree3 = 7;

export const LastSdfMesh = MeshTree3;

export const MeshPlanetCore = LastSdfMesh + 1;
export const MeshPointLightSphere = LastSdfMesh + 2;
export const MeshFloor = LastSdfMesh + 3;

let toLoad = 0;
let loaded = 0;

export const addLoadJob = <T>(f: () => T) => {
    ++toLoad;
    return new Promise<T>(r => {
        setTimeout(() => {
            ++loaded;
            r(f());
        });
    });
};

export const setLoadingString = () => {
    titleDiv.innerHTML = "Loading " + floor(100 * loaded / toLoad);
};


type SdfMeshDef = [SDFNode, number, number];

const createCarSdf = (): SdfMeshDef[] => {
    const cabinHeight = 1 / 4;
    const cabinLength = 2 / 3;
    const baseHeight = 0.17;
    const baseLength = 1;

    const carWidth = 1 / 2;

    const tireR = 0.25;
    const tireThick = 0.1;

    const chassisBaseHeight = tireR;

    const chassisZPos = baseHeight * 2 + chassisBaseHeight + cabinHeight;

    // const cabin = createBox(carWidth * 0.95, cabinLength, cabinHeight)
    //     .intersect(createPlane(0, 1, 1).translate(0, 0.45))
    //     .intersect(createPlane(0, -1, 0.6).translate(0, -0.5))
    //     .intersect(createPlane(0, -0.2, 1).translate(0, 0, 0.2))
    //     .intersect(createPlane(1, 0, 0.5).translate(carWidth - 0.1).symmetry(1))
    //     .translate(0, cabinLength - baseLength, chassisZPos)
    //     .setMaterial(MaterialCar);

    // const windshield = createBox(carWidth, 0.4, 0.14).translate(0, 0.1, chassisZPos - 0.12).intersect(cabin).scale(1.18).setMaterial(MaterialTire);

    // const base = createBox(carWidth, baseLength, baseHeight).
    //     intersect(createPlane(0, 0.3, 1).translate(0, 0.45, 0.2))
    //     .translate(0, 0, baseHeight + chassisBaseHeight)
    //     .setMaterial(MaterialCar);


    // const tires = createCylinder(tireR, tireThick).rotateXZ(90).translate(carWidth + tireThick, 0.53, tireR).symmetry(1, 1).setMaterial(MaterialTire);

    // const sdf = base.smoothUnion(cabin, 0.03).smooth(0.09);

    // return [
    //     [sdf.setMaterial(MaterialCar).scale(carLength), carLength * 1.5, 40],
    //     [tires.union(windshield).scale(carLength), carLength * 1.5, 40]
    // ];

    const cabin = [TRANSLATE, [0, cabinLength - baseLength, chassisZPos],
        intersect(
            [BOX, [carWidth * 0.95, cabinLength, cabinHeight]],
            [TRANSLATE, [0, 0.45, 0], [PLANE, [0, 1, 1]]],
            [TRANSLATE, [0, -0.5, 0], [PLANE, [0, -1, 0.6]]],
            [TRANSLATE, [0, 0, 0.2], [PLANE, [0, -0.2, 1]]],
            [SYMMETRY, [1, 0, 0], [TRANSLATE, [carWidth - 0.1, 0, 0], [PLANE, [1, 0, 0.5]]]],
        )
    ];

    const base = [TRANSLATE, [0, 0, baseHeight + chassisBaseHeight],
        [INTERSECT,
            [BOX, [carWidth, baseLength, baseHeight]],
            [TRANSLATE, [0, 0.45, 0.2], [PLANE, [0, 0.3, 1]]]
        ]
    ];

    const car = union(base, cabin);

    const tire = [ROTATE, 90 * Deg, cylinder(tireR, tireThick)];
    const tires = [SYMMETRY, [1, 1, 0], [TRANSLATE, [carWidth + tireThick / 2, 0.53, tireR], tire]];

    //const windshield = createBox(carWidth, 0.4, 0.14).translate(0, 0.1, chassisZPos - 0.12).intersect(cabin).scale(1.18).setMaterial(MaterialTire);
    const windshield = [SCALE, 1.01, [INTERSECT, [TRANSLATE, [0, 0.1, chassisZPos - 0.12], [BOX, [carWidth, 0.4, 0.14]]], cabin]];

    const blackParts = union(tires, windshield);
    
    return [
        [[SET_MATERIAL, MaterialCar, [SCALE, carLength, car]], carLength * 1.5, 60],
        [[SET_MATERIAL, MaterialMetal, [SCALE, carLength, car]], carLength * 1.5, 60],
        [[SET_MATERIAL, MaterialTire, [SCALE, carLength, blackParts]], carLength * 1.5, 60],
    ]
}

const createStartFlag = (): SdfMeshDef => {
    const flagBase = 0.005;
    const flagHH = 0.02;

    const poles = [SYMMETRY, [1, 0, 0], [TRANSLATE, [FenceWidth, 0, 0], [BOX, [flagBase, flagBase, startflagPoleHH]]]];
    const flag = [SET_MATERIAL, MaterialCheckersFlag, [TRANSLATE, [0, 0, startflagPoleHH - flagHH], [BOX, [FenceWidth, flagBase, flagHH]]]];
    return [[SET_MATERIAL, MaterialMetal, [UNION, poles, flag]], FenceWidth * 1.1, 25];
};



const createTrees = (): SdfMeshDef[] => {
    const treeSize = 0.01;
    const ball = [SPHERE, 0.4];
    const snowman = union(ball, [TRANSLATE, [0, 0, 0.4], [SCALE, 0.7, ball]]);
    const distort = [DISTORT, 3000, 0.02, [DISTORT, 1500, 0.08, snowman]];
    return Array(4).fill(0).map((_, i) => ([[SET_MATERIAL, MaterialTreeTop | (i << 5), [SCALE, treeSize, distort]], treeSize * 1.2, 18]));
};

export const createAssets = async () => {

    soundInit();

    const sdfs: SdfMeshDef[] = [
        ...createCarSdf(),
        createStartFlag(),
        ...createTrees(),
    ];

    // for (let s of sdfs) {
    //     console.log(texToSdf(s[0],null as any, null as any));
    // }

    meshes = await Promise.all(sdfs.map(x => addLoadJob(() => meshFromSdf(...x))));

    arrayPush(meshes,createTetraSphereMesh(4, 1, MaterialGrass));

    const pointLightSphere = createTetraSphereMesh(2, 1, MaterialGrass);
    pointLightSphere.upload();
    arrayPush(meshes,pointLightSphere);

    const floor = createUnitQuadMesh();
    floor.upload();
    arrayPush(meshes,floor);
};