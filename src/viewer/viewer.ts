
import { createMeshInstance, initRenderer, lightColor, lightPos, lightShadowColor, Mesh, MeshInstance, meshInstances, render, viewMatrix } from "../renderer";
import { identityQuaternion, mat4, mat4Copy, mat4LookAt, mat4Scale, quat, quatFromAxisAngle, quatMul, quatToMatrix, resetVectorBorrower, vec3, vecClone, vecCopy, vecLength, vecMulK, vecSet } from "../juvec";
import { createAssets, MeshCar, meshes } from "~assets";


let lastTimestamp = -1;
let ts = 0;

let mesh: Mesh;

let mouseDownPos: (number[] | null);
let mouseDelta = [0, 0];

let finalQuat = quat();
let viewQuat = vecClone(identityQuaternion);
let movementViewQuat = vecClone(identityQuaternion);

let meshInstance: MeshInstance;

const tmpMat4_0 = mat4(1);

const mainLoop = (timestamp: number) => {
    resetVectorBorrower();
    vecSet(lightPos, 1, -0.5, 1);

    let dts = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    ts += dts;

    if (mouseDownPos) {
        const alpha = Math.sqrt(mouseDelta[0] * mouseDelta[0] + mouseDelta[1] * mouseDelta[1]) / 300;
        const axis = vec3(-mouseDelta[1], mouseDelta[0], 0);
        const len = vecLength(axis);
        if (len > 0) {
            vecMulK(axis, 1 / len, axis);
            quatFromAxisAngle(axis, alpha, movementViewQuat);
        }
    }

    quatMul(movementViewQuat, viewQuat, finalQuat);

    mat4LookAt(vec3(0, -2, 0), vec3(0, 0, 0), vec3(0, 0, 1), viewMatrix);

    quatToMatrix(finalQuat, meshInstance.modelMatrix);
    mat4Scale(meshInstance.modelMatrix, 10, tmpMat4_0);
    mat4Copy(meshInstance.modelMatrix, tmpMat4_0);

    render();
    window.requestAnimationFrame(mainLoop);
};

window.addEventListener('DOMContentLoaded', () => {

    window.addEventListener('mousemove', (event: MouseEvent) => {
        if (mouseDownPos) {
            mouseDelta[0] = event.clientX - mouseDownPos[0];
            mouseDelta[1] = mouseDownPos[1] - event.clientY;
        }
    }, true);

    window.addEventListener('mouseup', (event: MouseEvent) => {
        mouseDownPos = null;
        quatMul(movementViewQuat, viewQuat, finalQuat);
        vecCopy(viewQuat, finalQuat);
        vecCopy(movementViewQuat, identityQuaternion);
        localStorage.setItem("viewQuat", viewQuat.join(","));
    }, true);


    window.addEventListener('mousedown', (event: MouseEvent) => {
        mouseDownPos = [event.clientX, event.clientY];
        mouseDelta[0] = 0;
        mouseDelta[1] = 0;
    }, true);

    (async () => {
        await initRenderer();
        await createAssets();

        //let sdf = createBox(0.8, 0.8, 0.2).setMaterial(0).union(createBox(0.2, 0.2, 0.6).setMaterial(1));
        //let sdf = createCircle(0.1).union(createBox(0.05,0.05,0.15).rotateXZ(25)).revolution(0.4);
        //let sdf = createBox(0.05,0.05,0.2).revolution(0.4);

        // const scale = 10;
        // const zebraNoise = [Tex.ChannelMap, [Tex.GradientNoise, [Tex.CurUv, scale, scale * 0.06]], [Tex.SawtoothMap, 20]];
        // const grain = [Tex.ChannelMap, Tex.gradientFractalNoise(4, 100), [Tex.Smoothstep, 0.7, 0.5]];

        // const fractalZebraNoise = [Tex.Fractal, zebraNoise, 4];
        // const tex = [Tex.Mix, [Tex.Constant, 0.34, 0.25, 0.16], [Tex.Constant, 0.7, 0.6, 0.46], fractalZebraNoise];

        // const res = 1024;
        // texArray = createTextureArray(res, res, 1, glEnum.RGBA8);
        // const pixels = renderTexToUint8Array(tex, res);
        // pushTextureArrayLayer(texArray, pixels);
        // gl.texParameteri(glEnum.TEXTURE_2D_ARRAY, glEnum.TEXTURE_WRAP_S, glEnum.REPEAT);
        // gl.texParameteri(glEnum.TEXTURE_2D_ARRAY, glEnum.TEXTURE_WRAP_T, glEnum.REPEAT);
        // gl.generateMipmap(glEnum.TEXTURE_2D_ARRAY);

        // resetFramebuffer(screenResolution[0], screenResolution[1]);

        // let sdf = createSphere(0.3).setMaterial(1).union(createSphere(0.1).setMaterial(0).translate(0.4, 0, 0).symmetry(1, 0, 0))
        //     .smoothSubtract(createSphere(0.1).setMaterial(1).translate(0, 0.2, 0).symmetry(0, 1, 0), 0.1);


        const viewQuatStr = localStorage.getItem("viewQuat");
        if (viewQuatStr) {
            vecSet(viewQuat, ...viewQuatStr.split(",").map(x => parseFloat(x)));
        }

        vecSet(lightColor, 1.3, 1.3, 1);
        vecSet(lightShadowColor, 0.45, 0.66, 0.86);

        meshInstance = createMeshInstance(meshes[MeshCar]);
        meshInstances.push(meshInstance);
        window.requestAnimationFrame(mainLoop);
    })();
});