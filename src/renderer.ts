import { gl, initWebgl, createProgram, WebGLShaderBundle, getUniformLocation, Texture3d, createTexture3d, createUBO, texture3dSubdata, Framebuffer, createFramebuffer, setFramebuffer, resetFramebuffer, createTexture, setupOrderedTextureUniforms, setUniformMatrix4fv, FBAttachNone, FBAttachDepth, FBAttachRGBA32F, bindTextures, FBAttachRGBAU8, FBAttachRGBA16F, setUniform3f, setUniform4f, setUniform1f, setUniform2f, glDisable, glEnable } from "./webgl";
import { gameViewBufferScale, viewResolution } from "./constants";
import * as glEnum from "./webglEnums";
import { identityMat4, mat4, Mat4, mat4LookAt, mat4Ortho, mat4PerspectiveVerticalFov, mat4Scale, mat4Translate, vec2, vec3, Vec3, vec3CrossNormalize, vec3Splay, vec4, Vec4, vec4Splay, vecAdd, vecBorrow, vecClone, vecEqEps, vecMulK, vecNormalizeSafe, vecSub, xAxis, xAxisNeg, yAxis, yAxisNeg, zAxis, zAxisNeg, zeroVector } from "./juvec";
import { arrayPush, assert, Deg } from "./aliasedFunctions";
import { MaterialRoad, meshes, MeshPointLightSphere } from "~assets";
import { physEps, arrayIndexWrap } from "~utils";
import { mesh_vert, mesh_frag, var_VIEWMATRIX, var_PROJECTIONMATRIX, var_MODELMATRIX, screen_vert, defrMainLight_frag, var_LIGHTPOS, var_LIGHTCOLOR, var_LIGHTSHADOWCOLOR, var_LIGHTVIEWMATRIX, var_LIGHTPROJMATRIX, var_TEXCOLOR, var_TEXNORMALS, var_TEXPOS, var_SHADOWDEPTH, var_TEXARRAY, nothing_frag, pointLight_frag, var_LIGHTRADIUSANDCOLOR, var_MATERIALCOLOR, final_frag, var_LIGHTACOSANDNORMAL, var_SETTINGS } from "./shaders/bundle";
import { mode, ModeChooseYourCar } from "~index";

export const screenResolution = vec4Splay();

export let meshAttribsLayout: VertexAttributesLayout;

const createViewCanvas = () => {
    screenResolution[0] = window.innerWidth;
    screenResolution[1] = window.innerHeight;
    const canvas = document.createElement("canvas");
    canvas.width = screenResolution[0];
    canvas.height = screenResolution[1];
    const style = canvas.style;
    style.position = "absolute";
    style.inset = "0";

    return canvas;
};

export let debugDiv: HTMLDivElement;

let glCanvas: HTMLCanvasElement;

let gameFramebuffer: Framebuffer;

let sepia: number;

export const viewMatrix = mat4(1);
export const lightPos = vec3(2, 2, 2);
export const lightColor = vec4Splay();
export const lightShadowColor = vec3(0, 0, 1);

export interface PointLight {
    pos: Vec3,
    color: Vec3,
    normal: Vec3,
    radius: number,
    angleAcos: number,
};

export const meshInstances: MeshInstance[] = [];
export const pointLights: PointLight[] = [];
export let unitQuadMesh: Mesh;

let shadowFramebuffer: Framebuffer;
const shadowViewMatrix = mat4(1);
const shadowProjMatrix = mat4(1);
const shadowResolution = 4 * 1024;
let lightsFramebuffer: Framebuffer;
let finalFramebuffer: Framebuffer;

export let meshProgram: WebGLShaderBundle;
let defrMainLightProgram: WebGLShaderBundle;
let shadowProgram: WebGLShaderBundle;
let pointLightProgram: WebGLShaderBundle;
let finalProgram: WebGLShaderBundle;

export const setSepia = (v: number) => {
    sepia = v;
};

export const createAndPushPointLight = (pos: Vec3, color: Vec3, radius: number, angleAcos: number, normal: Vec3) => {
    const light = { pos, color, radius, angleAcos, normal };
    arrayPush(pointLights, light);
    return light;
};

export const createAndPushMeshInstance = (mesh: Mesh) => {
    const instance = createMeshInstance(mesh);
    arrayPush(meshInstances, instance);
    return instance;
};

export const clearRendererMeshes = () => {
    meshInstances.length = 0;
    pointLights.length = 0;
};

export const initRenderer = async () => {
    const body = document.body;
    const bodyStyle = body.style;
    bodyStyle.margin = "0";
    bodyStyle.fontFamily = "sans-serif";
    bodyStyle.fontSize = "6vh";
    bodyStyle.color = "#fff";
    bodyStyle.backgroundColor = "#000";
    bodyStyle.userSelect = "none";
    bodyStyle.textAlign = "center";
    bodyStyle.overflow = "auto";

    glCanvas = createViewCanvas();
    body.appendChild(glCanvas);

    initWebgl(glCanvas);

    meshAttribsLayout = createVertexAttributesLayout().append(3, "f").append(3, "f").append(1, "f").append(2, "f");

    shadowFramebuffer = createFramebuffer(shadowResolution, shadowResolution, FBAttachNone, FBAttachDepth);
    gameFramebuffer = createFramebuffer(screenResolution[0] * gameViewBufferScale, screenResolution[1] * gameViewBufferScale, FBAttachRGBA16F, FBAttachRGBA16F, FBAttachRGBA16F, FBAttachDepth);
    lightsFramebuffer = createFramebuffer(screenResolution[0] * gameViewBufferScale, screenResolution[1] * gameViewBufferScale, FBAttachRGBAU8, FBAttachRGBAU8);
    finalFramebuffer = createFramebuffer(screenResolution[0] * gameViewBufferScale, screenResolution[1] * gameViewBufferScale, lightsFramebuffer.colorTextures[0]);

    // Shaders
    meshProgram = createProgram(mesh_vert, mesh_frag);
    getUniformLocation(meshProgram, var_VIEWMATRIX, var_PROJECTIONMATRIX, var_MODELMATRIX);

    defrMainLightProgram = createProgram(screen_vert, defrMainLight_frag);
    getUniformLocation(defrMainLightProgram, var_VIEWMATRIX, var_PROJECTIONMATRIX, var_LIGHTPOS, var_LIGHTCOLOR, var_LIGHTSHADOWCOLOR, var_LIGHTVIEWMATRIX, var_LIGHTPROJMATRIX);
    setupOrderedTextureUniforms(defrMainLightProgram, var_TEXCOLOR, var_TEXNORMALS, var_TEXPOS, var_SHADOWDEPTH);

    shadowProgram = createProgram(mesh_vert, nothing_frag);
    getUniformLocation(shadowProgram, var_VIEWMATRIX, var_PROJECTIONMATRIX, var_MODELMATRIX);

    pointLightProgram = createProgram(mesh_vert, pointLight_frag);
    getUniformLocation(pointLightProgram, var_VIEWMATRIX, var_PROJECTIONMATRIX, var_MODELMATRIX, var_LIGHTACOSANDNORMAL, var_LIGHTRADIUSANDCOLOR);
    setupOrderedTextureUniforms(pointLightProgram, var_TEXNORMALS, var_TEXPOS, var_MATERIALCOLOR);

    finalProgram = createProgram(screen_vert, final_frag);
    getUniformLocation(finalProgram, var_SETTINGS);
    setupOrderedTextureUniforms(finalProgram, var_TEXCOLOR);

    unitQuadMesh = createUnitQuadMesh();
};

export const createUnitQuadMesh = () => {
    const mesh = createMesh(meshAttribsLayout);
    mesh.primType = glEnum.TRIANGLE_STRIP;
    const n = vec3(0, 0, 1);
    mesh.addVertex(vec2(-1, 1), n, [MaterialRoad, 0, 0]);
    mesh.addVertex(vec2(-1, -1), n, [MaterialRoad, 0, 0]);
    mesh.addVertex(vec2(1, 1), n, [MaterialRoad, 1, 0]);
    mesh.addVertex(vec2(1, -1), n, [MaterialRoad, 1, 0]);
    mesh.upload();
    return mesh;
}

export const render = () => {
    const submitMeshes = (prog: WebGLShaderBundle) => {
        for (let mi of meshInstances) {
            setUniformMatrix4fv(prog, var_MODELMATRIX, mi.modelMatrix);
            if (mi.mesh.noCull) {
                glDisable(glEnum.CULL_FACE);
            }
            if (mi.mesh.zOffset) {
                glEnable(glEnum.POLYGON_OFFSET_FILL);
                gl.polygonOffset(0, -10);
            }
            mi.mesh.render();
            glEnable(glEnum.CULL_FACE);
            glDisable(glEnum.POLYGON_OFFSET_FILL);
        }
    };

    glEnable(glEnum.DEPTH_TEST);
    glEnable(glEnum.CULL_FACE);
    gl.cullFace(glEnum.BACK);

    // Draw shadows
    setFramebuffer(shadowFramebuffer);
    gl.clear(glEnum.DEPTH_BUFFER_BIT);
    gl.colorMask(false, false, false, false);

    shadowProgram.use();

    const shadowW = mode == ModeChooseYourCar ? 0.2 : 2.5;
    mat4Ortho(shadowW, shadowW, 0.5, 5, shadowProjMatrix);

    mat4LookAt(lightPos, zeroVector as Vec3, zAxis, shadowViewMatrix);

    setUniformMatrix4fv(shadowProgram, var_VIEWMATRIX, shadowViewMatrix);
    setUniformMatrix4fv(shadowProgram, var_PROJECTIONMATRIX, shadowProjMatrix);

    submitMeshes(shadowProgram);

    gl.colorMask(true, true, true, true);

    // Fill deferred buffers
    setFramebuffer(gameFramebuffer);
    gl.drawBuffers([glEnum.COLOR_ATTACHMENT0, glEnum.COLOR_ATTACHMENT1, glEnum.COLOR_ATTACHMENT2]);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(glEnum.COLOR_BUFFER_BIT | glEnum.DEPTH_BUFFER_BIT);


    let projMatrix = mat4(1);
    const aspect = screenResolution[0] / screenResolution[1];
    mat4PerspectiveVerticalFov(25 * Deg, aspect, 0.005, 10, projMatrix);

    meshProgram.use();

    setUniformMatrix4fv(meshProgram, var_VIEWMATRIX, viewMatrix);
    setUniformMatrix4fv(meshProgram, var_PROJECTIONMATRIX, projMatrix);

    submitMeshes(meshProgram);

    // Main light pass
    setFramebuffer(lightsFramebuffer);
    gl.drawBuffers([glEnum.COLOR_ATTACHMENT0, glEnum.COLOR_ATTACHMENT1]);
    glDisable(glEnum.DEPTH_TEST);
    defrMainLightProgram.use();

    setUniformMatrix4fv(defrMainLightProgram, var_LIGHTVIEWMATRIX, shadowViewMatrix);
    setUniformMatrix4fv(defrMainLightProgram, var_LIGHTPROJMATRIX, shadowProjMatrix);
    setUniformMatrix4fv(defrMainLightProgram, var_VIEWMATRIX, viewMatrix);
    setUniformMatrix4fv(defrMainLightProgram, var_PROJECTIONMATRIX, projMatrix);

    setUniform3f(defrMainLightProgram, var_LIGHTPOS, ...lightPos);
    setUniform4f(defrMainLightProgram, var_LIGHTCOLOR, ...lightColor);
    setUniform3f(defrMainLightProgram, var_LIGHTSHADOWCOLOR, ...lightShadowColor);

    bindTextures(glEnum.TEXTURE_2D, glEnum.TEXTURE0, ...gameFramebuffer.colorTextures, shadowFramebuffer.depthTexture);


    unitQuadMesh.render();

    // Point lights
    setFramebuffer(finalFramebuffer);
    pointLightProgram.use();
    setUniformMatrix4fv(pointLightProgram, var_VIEWMATRIX, viewMatrix);
    setUniformMatrix4fv(pointLightProgram, var_PROJECTIONMATRIX, projMatrix);
    bindTextures(glEnum.TEXTURE_2D, glEnum.TEXTURE0, gameFramebuffer.colorTextures[1], gameFramebuffer.colorTextures[2], lightsFramebuffer.colorTextures[1]);

    const plMesh = meshes[MeshPointLightSphere];

    const tmpMat1 = mat4(1);
    const tmpMat2 = mat4(1);

    gl.enable(glEnum.BLEND);
    gl.blendFunc(glEnum.ONE, glEnum.ONE);

    for (let pl of pointLights) {
        mat4Translate(identityMat4, pl.pos, tmpMat1);
        mat4Scale(tmpMat1, pl.radius, tmpMat2);
        setUniformMatrix4fv(pointLightProgram, var_MODELMATRIX, tmpMat2);
        setUniform4f(pointLightProgram, var_LIGHTACOSANDNORMAL, pl.angleAcos, ...pl.normal);
        setUniform4f(pointLightProgram, var_LIGHTRADIUSANDCOLOR, pl.radius, ...pl.color);
        plMesh.render();
    }

    gl.disable(glEnum.BLEND);

    // Final blit

    resetFramebuffer(screenResolution[0], screenResolution[1]);

    finalProgram.use();
    setUniform2f(finalProgram, var_SETTINGS, sepia, 0);
    bindTextures(glEnum.TEXTURE_2D, glEnum.TEXTURE0, finalFramebuffer.colorTextures[0]);
    unitQuadMesh.render();
};

type VertexAttributeType = "f";

const typeByteSizes = {
    "f": 4,
};

interface VertexAttribute {
    components: number,
    type: VertexAttributeType,
};

export interface VertexAttributesLayout {
    attributes: VertexAttribute[];
    sizeBytes: number;
    append: (components: number, type: VertexAttributeType) => VertexAttributesLayout;
    upload: () => void;
};

export interface VertexAttributes {
    layout: VertexAttributesLayout;
    vao: WebGLVertexArrayObject;
};

export const createVertexAttributesLayout = (): VertexAttributesLayout => {
    const attribs = {
        attributes: [],
        sizeBytes: 0,
    } as unknown as VertexAttributesLayout;

    attribs.append = (components: number, type: VertexAttributeType) => {
        arrayPush(attribs.attributes, { components, type });
        attribs.sizeBytes += typeByteSizes[type] * components;
        return attribs;
    };

    return attribs;
};

export const createVertexAttributes = (layout: VertexAttributesLayout): VertexAttributes => {
    const typeGlTypes = {
        "f": glEnum.FLOAT,
    };

    const vao = gl.createVertexArray() as WebGLVertexArrayObject;
    gl.bindVertexArray(vao);
    let runningSize = 0;
    const attributes = layout.attributes;
    for (let i = 0; i < attributes.length; ++i) {
        const attr = attributes[i];
        gl.vertexAttribPointer(i, attr.components, typeGlTypes[attr.type], false, layout.sizeBytes, runningSize);
        runningSize += typeByteSizes[attr.type] * attr.components;
        gl.enableVertexAttribArray(i);
    }
    return { layout, vao };
};


export const createOctahedron = (resolution: number) => {
    const vertices: Vec3[] = [];
    const triangles: { vertices: Vec3, normal: Vec3 }[] = [];

    const getOrAddVertex = (v: Vec3) => {
        const idx = vertices.findIndex(x => vecEqEps(x, v, physEps));
        if (idx < 0) {
            arrayPush(vertices, vecClone(v));
            return vertices.length - 1;
        }
        return idx;
    };

    const vTmp0 = vecBorrow<Vec3>();
    const vTmp1 = vecBorrow<Vec3>();

    const addTriangle = (subdivide: number, ...verts: Vec3[]) => {
        if (subdivide > 0) {
            --subdivide;
            const midPoints = [];
            for (let i = 0; i < 3; ++i) {
                const p = midPoints[i] = vecBorrow<Vec3>();
                vecAdd(arrayIndexWrap(verts, i - 1), verts[i], p);
                vecMulK(p, 0.5);
            }
            addTriangle(subdivide, ...midPoints);
            for (let i = 0; i < 3; ++i) {
                addTriangle(subdivide, verts[i], arrayIndexWrap(midPoints, i + 1), midPoints[i]);
            }
        } else {
            const normal = vec3Splay();
            vecSub(verts[1], verts[0], vTmp0);
            vecSub(verts[2], verts[0], vTmp1);
            vec3CrossNormalize(vTmp0, vTmp1, normal);
            arrayPush(triangles, {
                normal,
                vertices: verts.map(x => getOrAddVertex(x)) as Vec3,
            });
        }
    };

    const winds = [xAxis, yAxis, xAxisNeg, yAxisNeg];
    for (let i = 0; i < 4; ++i) {
        addTriangle(resolution, zAxis, winds[i], arrayIndexWrap(winds, i + 1));
        addTriangle(resolution, zAxisNeg, arrayIndexWrap(winds, i + 1), winds[i]);
    }

    return [vertices, triangles] as [Vec3[], typeof triangles];
};

export const createTetraSphereMesh = (subdivision: number, scale: number, material: number) => {
    const [vertices, triangles] = createOctahedron(subdivision);
    for (let v of vertices) {
        vecNormalizeSafe(v);
    }
    const mesh = createMesh(meshAttribsLayout);
    const scaledVert = vecBorrow<Vec3>();
    for (let t of triangles) {
        for (let v of t.vertices) {
            vecMulK(vertices[v], scale, scaledVert);
            mesh.addVertex(scaledVert, vertices[v], [material]);
        }
    }
    return mesh;
};


export interface Mesh {
    numVertices: number;
    maxVertices: number;
    primType: number;
    noCull: boolean;
    zOffset: boolean;

    verticesBuffer: ArrayBuffer;
    attribs: VertexAttributes;
    vertices: (number[])[];

    glBuffer: WebGLBuffer;

    addVertex: (...args: (number[])[]) => void;
    upload: () => void;
    render: () => void;
    destroy: () => void;
};

export const createMesh = (layout: VertexAttributesLayout): Mesh => {
    const mesh = {
        numVertices: 0,
        maxVertices: 10000,
        primType: glEnum.TRIANGLES,
    } as unknown as Mesh;

    const allocVertices = () => {
        const bufferNewSize = mesh.maxVertices * layout.sizeBytes;
        const prevBuffer = mesh.verticesBuffer;
        mesh.verticesBuffer = new ArrayBuffer(bufferNewSize);

        if (prevBuffer) {
            (new Uint8Array(mesh.verticesBuffer)).set(new Uint8Array(prevBuffer));
        }
    }

    allocVertices();

    mesh.addVertex = (...args: (number[])[]) => {
        assert(!mesh.glBuffer);

        if (mesh.numVertices == mesh.maxVertices) {
            mesh.maxVertices *= 2;
            allocVertices();
        }

        let idx = (mesh.numVertices++) * layout.sizeBytes;
        const dv = new DataView(mesh.verticesBuffer, idx);
        let runningSize = 0;

        for (let iAttr = 0; iAttr < args.length; iAttr++) {
            const attr = layout.attributes[iAttr];
            const inData = args[iAttr];
            const t = attr.type;
            for (let i = 0; i < attr.components; ++i) {
                dv.setFloat32(runningSize, inData[i], true);
                runningSize += typeByteSizes[t];
            }
        }
    };

    mesh.upload = () => {
        if (!mesh.glBuffer) {
            const buf = mesh.glBuffer = gl.createBuffer() as WebGLBuffer;
            gl.bindBuffer(glEnum.ARRAY_BUFFER, buf);
            gl.bufferData(glEnum.ARRAY_BUFFER, mesh.verticesBuffer, glEnum.STATIC_DRAW);
            mesh.attribs = createVertexAttributes(layout);
        }
    };

    mesh.render = () => {
        assert(!!mesh.glBuffer);
        gl.bindBuffer(glEnum.ARRAY_BUFFER, mesh.glBuffer);
        gl.bindVertexArray(mesh.attribs.vao);
        gl.drawArrays(mesh.primType, 0, mesh.numVertices);
    };

    mesh.destroy = () => {
        gl.deleteBuffer(mesh.glBuffer);
        (mesh.glBuffer as any) = null;
    };

    return mesh;
}

export interface MeshInstance {
    mesh: Mesh;
    modelMatrix: Mat4;
};

export const createMeshInstance = (mesh: Mesh) => {
    mesh.upload();
    return { mesh, modelMatrix: mat4(1) };
};