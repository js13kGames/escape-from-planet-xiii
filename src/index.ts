
import { clearRendererMeshes, createMeshInstance, initRenderer, lightColor, lightPos, lightShadowColor, MeshInstance, meshInstances, render, setSepia, viewMatrix } from "./renderer";
import { createAssets, MeshCar, MeshCarPart, MeshCarTofu, meshes, MeshFloor, setLoadingString } from "./assets";
import { InputDown, InputLeft, InputRight, InputUiOk, inputUpdate, isAnyKeyDown, isInputDown, keyHandler, wasAnyKeyPressed, wasInputPressed } from "./input";
import * as InGame from "./inGame";
import { identityMat4, mat4, mat4Copy, mat4FromBasisPlusTranslation, mat4LookAt, mat4Mul, mat4Translate, resetVectorBorrower, Vec3, vec3, vec4, vecBorrow, vecMix, vecSet, zAxis } from "./juvec";
import { createPlanet, destroyPlanet, Planet } from "~planet";
import { arrayPush, cos, mix, sin } from "~aliasedFunctions";
import { audioCtx } from "~zeptofm/zeptofm";
import { settleUnit } from "~utils";

let lastTimestamp = -1;
export let universalTimer = 0;

export const ModeNone = 0;
export const ModeLoading = 1;
export const ModeLoaded = 2;
export const ModeTitleScreen = 3;
export const ModeInGame = 4;
export const ModeChooseNext = 5;
export const ModeGameOver = 6;
export const ModeChooseYourCar = 7;

export let mode = ModeNone;

export let titleDiv: HTMLDivElement;
let winOrLoseDiv: HTMLDivElement;

export let inGameHudDiv: HTMLElement;

export let mainDiv: HTMLElement;
export let chooseNextDiv: HTMLElement;
export let chooseNextOptionsDivs: HTMLElement[];

export let tofuMode: number;

let carSelectionInterpolation: number;

let titleScreenPlanet: Planet;

let carsToChooseInstances: MeshInstance[][];

const createDiv = (hidden?: boolean) => {
    const div = document.createElement("div");
    const style = div.style;
    style.boxSizing = "border-box";
    if (hidden) {
        hideDiv(div);
    }
    return div;
};

export const hideDiv = (div: HTMLElement) => {
    // Only set prevStyleDisplay on first hide call to allow multiple 
    // hideDiv calls without issues
    (div as any).prevStyleDisplay = (div as any).prevStyleDisplay ?? div.style.display;
    div.style.display = "none";
};

export const showDiv = (div: HTMLElement) => {
    div.style.display = (div as any).prevStyleDisplay;
};


export const createHTMLElements = () => {
    {
        mainDiv = createDiv();
        const style = mainDiv.style;
        style.position = "relative";
        style.width = "min(95%,177vh)";
        style.marginInline = "auto";
        style.padding = "5vh";
        document.body.appendChild(mainDiv);
    }

    {
        chooseNextDiv = createDiv(true);
        mainDiv.appendChild(chooseNextDiv);
        const nextOptionsRow = createDiv();
        nextOptionsRow.style.display = "flex";
        nextOptionsRow.style.justifyContent = "center";
        chooseNextOptionsDivs = [];
        for (let i = 0; i < 3; ++i) {
            const d = createDiv();

            const dStyle = d.style;
            dStyle.flex = "1";
            dStyle.border = "#fff 7px solid";
            dStyle.margin = dStyle.padding = "1rem";
            dStyle.maxWidth = "35vw";
            dStyle.backgroundColor = "#900B";
            dStyle.minHeight = "40vh";

            const title = createDiv();

            (d as any)._title = title;
            d.appendChild(title);

            const list = createDiv();
            const listStyle = list.style;
            listStyle.textAlign = "left";
            listStyle.fontSize = "1.4rem";

            (d as any)._list = list;
            d.appendChild(list);

            nextOptionsRow.appendChild(d);
            arrayPush(chooseNextOptionsDivs, d);
        }
        chooseNextDiv.appendChild(nextOptionsRow);
    }

    titleDiv = createDiv();
    {
        const style = titleDiv.style;
        style.marginTop = "27vh";
        style.textAlign = "right";
        style.width = "88%";
        style.fontWeight = "bold";
        style.filter = "drop-shadow(#000 0.1rem 0.2rem)";
        style.fontSize = "2rem";
    }

    mainDiv.appendChild(titleDiv);
    winOrLoseDiv = createDiv(true);
    mainDiv.appendChild(winOrLoseDiv);

    inGameHudDiv = createDiv(true);
    {
        const style = inGameHudDiv.style;
        style.textAlign = "left";
        style.filter = "drop-shadow(0 0 0.4rem #000)";
    }

    mainDiv.appendChild(inGameHudDiv);
};

export const planetNumberToRoman = (n: number): string => {
    if (n >= 10) {
        return "X" + planetNumberToRoman(n - 10);
    } else if (n == 9) {
        return "IX";
    } else if (n >= 5) {
        return "V" + planetNumberToRoman(n - 5);
    } else if (n == 4) {
        return "IV";
    } else if (n > 0) {
        return "I".repeat(n);
    }
    return "";
}

export const setMode = (nextMode: number, argument?: boolean) => {
    console.log("SET MODE", nextMode);

    if (nextMode == ModeChooseNext && InGame.planetNumber == 0) {
        setMode(ModeGameOver, true);
        return;
    }

    switch (mode) {
        case ModeTitleScreen:
            clearRendererMeshes();
            destroyPlanet(titleScreenPlanet);
            break;
        case ModeInGame:
            hideDiv(inGameHudDiv);
            break;
        case ModeChooseNext:
        case ModeGameOver:
            InGame.deInit();
            hideDiv(chooseNextDiv);
            hideDiv(winOrLoseDiv);
            break;
        case ModeChooseYourCar:
            clearRendererMeshes();
            hideDiv(titleDiv);
            break;
    }

    switch (nextMode) {
        case ModeLoading:
            createHTMLElements();
            (async () => {
                await createAssets();
            })().then(x => {
                setMode(ModeLoaded);
            });
            break;
        case ModeLoaded:
            titleDiv.innerHTML = "CLICK TO START";
            break;
        case ModeTitleScreen:
            titleDiv.innerHTML = "<h1>ESCAPE FROM PLANET XIII</h1>js13kGames 2024<br>by Miguel Ángel Pérez Martínez";
            titleScreenPlanet = createPlanet([]);
            arrayPush(meshInstances, ...titleScreenPlanet.meshInstances);
            mat4LookAt(vec3(8, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1), viewMatrix);
            vecSet(lightColor, 1.3, 1.3, 1, 1);
            vecSet(lightShadowColor, 0.45, 0.66, 0.86);
            showDiv(titleDiv);
            break;
        case ModeInGame:
            InGame.init(mode == ModeChooseYourCar);
            break;
        case ModeChooseNext:
            InGame.setInteractiveMode(false);
            InGame.setupChooser();
            break;
        case ModeGameOver:
            InGame.setInteractiveMode(false);
            winOrLoseDiv.innerHTML = argument ? "CONGRATULATIONS YOU ESCAPED!" : "GAME OVER";
            showDiv(winOrLoseDiv);
            break;
        case ModeChooseYourCar: {
            const floorInstance = createMeshInstance(meshes[MeshFloor]);
            carsToChooseInstances = [
                [createMeshInstance(meshes[MeshCar]), createMeshInstance(meshes[MeshCarPart])],
                [createMeshInstance(meshes[MeshCarTofu]), createMeshInstance(meshes[MeshCarPart])]];
            arrayPush(meshInstances,
                ...carsToChooseInstances[0],
                ...carsToChooseInstances[1],
                floorInstance
            );
            carSelectionInterpolation = 0;
            tofuMode = 0;
            break;
        }
    }
    universalTimer = 0;
    setSepia(0);
    mode = nextMode;
};

const mainLoop = (timestamp: number) => {
    resetVectorBorrower();
    let dts = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    universalTimer += dts;

    switch (mode) {
        case ModeLoading:
            setLoadingString();
            break;
        case ModeTitleScreen:
            vecSet(lightPos, 2, -1, 2);

            if (wasInputPressed(InputUiOk)) {
                setMode(ModeChooseYourCar);
            }

            const a = 0.008;
            const matRot = mat4(1);
            const matTmp = mat4(1);
            matRot[0] = matRot[5] = cos(a);
            matRot[1] = sin(a);
            matRot[4] = -sin(a);
            for (let mi of titleScreenPlanet.meshInstances) {
                mat4Copy(matTmp, mi.modelMatrix);
                mat4Mul(matRot, matTmp, mi.modelMatrix);
            }
            break;
        case ModeInGame:
        case ModeChooseNext:
        case ModeGameOver:
            InGame.update(dts);
            break;
        case ModeChooseYourCar: {
            const carPositions = [vecBorrow<Vec3>(), vecBorrow<Vec3>()];
            for (let i = 0; i < 2; ++i) {
                vecSet(carPositions[i], -0.03 * (i * 2 - 1), 0, 0);
                mat4Translate(identityMat4, carPositions[i], carsToChooseInstances[i][0].modelMatrix);
                mat4Translate(identityMat4, carPositions[i], carsToChooseInstances[i][1].modelMatrix);
            }

            const cameraTarget = vecBorrow<Vec3>();
            carSelectionInterpolation = settleUnit(mix(carSelectionInterpolation, tofuMode, 0.2));
            vecMix(carPositions[0], carPositions[1], carSelectionInterpolation, cameraTarget);
            mat4LookAt(vec3(0, 0.18, 0.14), cameraTarget, vec3(0, 0, 1), viewMatrix);
            vecSet(lightColor, 1.3, 1.3, 1, 1);
            vecSet(lightShadowColor, 0.45, 0.66, 0.86);


            vecSet(lightPos, mix(-0.5, 0.5, carSelectionInterpolation), 0, 0.4);

            titleDiv.innerHTML = `<h2>${tofuMode ? "TOFU DRIFTER" : "EASY RIDER"}</h2>`;

            if (wasInputPressed(InputLeft) && tofuMode) {
                tofuMode = 0;
            }
            if (wasInputPressed(InputRight) && !tofuMode) {
                tofuMode = 1;
            }

            if (wasInputPressed(InputUiOk)) {
                setMode(ModeInGame);
            }

            break;
        }
    }

    if (mode != ModeLoading) {
        inputUpdate();
        render();
    }
    window.requestAnimationFrame(mainLoop);
};


window.addEventListener('DOMContentLoaded', () => {
    window.addEventListener("click", () => {
        if (mode == ModeLoaded) {
            audioCtx.resume();
            setMode(ModeTitleScreen);
        }
    });
    window.addEventListener("keydown", (event: KeyboardEvent) => {
        keyHandler(event, true);
    }, true);

    window.addEventListener("keyup", (event: KeyboardEvent) => {
        keyHandler(event, false);
    }, true);

    initRenderer().then(() => {
        setMode(ModeLoading);
        window.requestAnimationFrame(mainLoop);
    });

});