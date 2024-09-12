import { Vec3 } from "~juvec";
import { unitQuadMesh } from "./renderer";
import { buildTreeProgram, TreeProgramBuilderContext } from "./treeProgram";
import { createFramebuffer, createProgram, deleteProgram, FBAttachRGBA32F, Framebuffer, freeFramebuffer, getUniformLocation, gl, setFramebuffer, setUniform2f } from "./webgl";
import * as glEnum from "./webglEnums";
import { sdfEval_frag, sdfEval_vert, var_VYRADIUS } from "~shaders/bundle";

// Shapes
export const SPHERE = 0;  // (r: number)
export const BOX = 1 // (r: Vec3)
export const PLANE = 2; // (normal: Vec3)

// CurrentValues
export const CUR_POS = 40;

// Operations
export const UNION = 50; // (a:SDFNode[], b:SDFNode[])
export const INTERSECT = 51;  // (a:SDFNode[], b:SDFNode[])
export const DISTORT = 52; // (frequency: number, scale: number, n: SDFNode)
export const EXTRUSION = 53; // (h: number, n:SDFNode);

// Space transformations
export const TRANSLATE = 100; // (t: Vec3, n: SDFNode)
export const SCALE = 101; // (scale: number, n: SDFNode)
export const SYMMETRY = 102; // (n: SDFNode)
export const ROTATE = 103; // (angleRad: number, n: SDFNode)


// Materials
export const SET_MATERIAL = 150; // (material: number, n: SDFNode)

// Internal
const SETUP = 200;

export type SDFNode = any[] | number;

const getBuilder = (ctx: TreeProgramBuilderContext) => {
    const { setReturn, doOp, getStackTop, pushToStack, pushToStackRaw, popStack, addCode, setConstant } = ctx;

    const getCurPos = () => doOp([CUR_POS]);

    const asFloat = (x?: number, def?: number) => {
        return `float(${x ?? def ?? 0})`;
    }

    const asVec4 = (v: Vec3) => {
        return `vec4(${v[0]},${v[1]},${v[2]},0)`;
    }

    const returnDist = (dst: string) => setReturn(`vec4(${dst},${getStackTop("m")},0,0)`);

    return {
        /* Sphere */ 0: (r: number) => {
            const pos = getCurPos();
            returnDist(`length(${pos})-${asFloat(r)}`);
        },
        /* Box */ 1: (r: Vec3) => {
            const pos = getCurPos();
            returnDist(`box(${pos},${asVec4(r)})`);
        },
        /* Plane */ 2: (normal: Vec3) => {
            const pos = getCurPos();
            returnDist(`dot(${pos},normalize(${asVec4(normal)}))`);
        },
        /* CurPos */ 40: () => {
            setReturn(getStackTop("p"));
        },
        /* Union */ 50: (a: SDFNode, b: SDFNode) => {
            const rA = doOp(a);
            const rB = doOp(b);
            setReturn(`${rA}.x<${rB}.x?${rA}:${rB}`);
        },
        /* Intersect */ 51: (a: SDFNode, b: SDFNode) => {
            const rA = doOp(a);
            const rB = doOp(b);
            setReturn(`${rA}.x>${rB}.x?${rA}:${rB}`);
        },
        /* Distort */ 52: (frequency: number, scale: number, n: SDFNode) => {
            const s = asFloat(scale);
            const f = asFloat(frequency);
            const pos = getCurPos();
            const r = doOp(n);
            returnDist(`${r}.x-(sin(${f}*${pos}.x)*sin(${f}*${pos}.y)*sin(${f}*${pos}.z)*${s})`);
        },
        /* Extrusion */ 53: (h: number, n: SDFNode) => {
            const pos = getStackTop("p");
            pushToStack("p", `${pos}.xyww`);
            const d = doOp(n);
            popStack("p");
            const w = setConstant(`vec2(${d}.x,abs(${pos}.z)-${asFloat(h)})`, "vec2");
            returnDist(`min(max(${w}.x,${w}.y),0.0) + length(max(${w},0.0))`);
        },
        /* Translate */ 100: (t: Vec3, n: SDFNode) => {
            pushToStack("p", `${getStackTop("p")}-${asVec4(t)}`);
            const r = doOp(n);
            popStack("p");
            setReturn(r);
        },
        /* Scale */ 101: (s: number, n: SDFNode) => {
            const sf = asFloat(s);
            pushToStack("p", `${getStackTop("p")}/${sf}`);
            const r = doOp(n);
            popStack("p");
            setReturn(`${r}*vec4(${sf},1,1,1)`);
        },
        /* Symmetry */ 102: (t: Vec3, n: SDFNode) => {
            const p = getStackTop("p");
            const a = setConstant(`abs(${p})`);
            pushToStack("p", `vec4(${t[0] == 1 ? a : p}.x,${t[1] == 1 ? a : p}.y,${t[2] == 1 ? a : p}.z,0)`);
            const r = doOp(n);
            popStack("p");
            setReturn(r);
        },
        /* Rotate */ 103: (angleRad: number, n: SDFNode) => {
            const pos = getStackTop("p");
            const rotated = setConstant(`rr(${pos}.xz,${asFloat(-angleRad)})`, "vec2");
            pushToStack("p", `vec4(${rotated}.x,${pos}.y,${rotated}.y, 0)`);
            const r = doOp(n);
            popStack("p");
            setReturn(r);
        },


        /* SetMaterial */ 150: (material: number, n: SDFNode) => {
            pushToStack("m", asFloat(material), "float");
            const r = doOp(n);
            popStack("m");
            setReturn(r);
        },
        /* Setup */ 200: (n: SDFNode) => {
            pushToStackRaw("p", "P");
            pushToStack("m", asFloat(0), "float");
            const r = doOp(n);
            addCode(`return ${r}.xy;`);
        },
    };
};


// Utils

export const union = (...nodes: SDFNode[]) => {
    return nodes.reduce((prev, cur) => [UNION, prev, cur]);
};

export const intersect = (...nodes: SDFNode[]) => {
    return nodes.reduce((prev, cur) => [INTERSECT, prev, cur]);
}

export const cylinder = (r: number, hh: number) => {
    return [EXTRUSION, hh, [SPHERE, r]];
};


const generateProgram = (node: SDFNode) => {
    let str = ``;
    const addCode = (code: string) => { str += code };
    const constPrefix = "c";
    let constCounter = 0;

    const def = {
        getBuilder,
        addCode,
        setConstant: (value: string, type?: string) => {
            const name = constPrefix + (constCounter++);
            addCode(`${type ?? `vec4`} ${name}=${value};`);
            return name;
        },
    };

    buildTreeProgram([SETUP, node], def);
    return str;
}

// rgba in tex is xyz, returns dist, mat in rg
export const renderSDF3dTex = (node: SDFNode, resolution: number, radius: number) => {
    const frag = sdfEval_frag.replace("$", `vec2 _s(vec4 P){${generateProgram(node)}}`);

    const floatsPerEntry = 4;
    const sdfTex = new Float32Array(resolution * resolution * resolution * floatsPerEntry);

    const layerSize = resolution * resolution * floatsPerEntry;
    const layerSizeBytes = layerSize * 4;

    const program = createProgram(sdfEval_vert, frag);
    getUniformLocation(program, var_VYRADIUS);
    program.use();

    const fb = createFramebuffer(resolution, resolution, FBAttachRGBA32F);
    setFramebuffer(fb);
    // For each layer
    for (let i = 0; i < resolution; i++) {
        setUniform2f(program, var_VYRADIUS, radius, 2 * i / (resolution - 1) - 1);
        unitQuadMesh.render();
        gl.readPixels(0, 0, resolution, resolution, glEnum.RGBA, glEnum.FLOAT, new Float32Array(sdfTex.buffer, i * layerSizeBytes, layerSize));
    }

    freeFramebuffer(fb);

    deleteProgram(program);

    return sdfTex;
};