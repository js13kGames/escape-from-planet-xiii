import { carLength, MeshCar, MeshCarPart, MeshCarTofu, meshes, MeshPointLightSphere } from "./assets";
import { abs, min, floor, fract, acos, Pi, symmetricClamp, remapClamped, tweenOut, tweenQuad, pow, mix, max, remap, shuffleArray, pickRandomFromArray, Deg, random, arrayPush } from "./aliasedFunctions";
import { isInputDown } from "./input";
import { vec3, vecCopy, vec3CrossNormalize, resetVectorBorrower, vecBorrow, Quaternion, quatFromAxisAngle, quatApplyToVec3Normalize, Vec3, vecMulK, vecFMKA, sphereSegmentIntersection, vecDot, vecLength, vecEq, mat4LookAt, mat4FromBasisPlusTranslation, vecMix, vecNormalizeSafe, vecToStr, mat4Copy, vecSub, vecBorrowerCheckpoint, vecBorrowerRestore, vecSet, vec3Splay, zeroVector, mat4Vec4Mul, Vec4, vecReset } from "./juvec";
import { arcsInUnitSphereIntersection, createPlanet, destroyPlanet, getPlanetDistanceToMainPath, Planet, PlanetAffixEndurance, PlanetAffixExtraLong, PlanetAffixNight, PlanetAffixNoSun, PlanetAffixRainbow, PlanetAffixSlippery, PlanetAffixStrings, PlanetAffixSuperTraction, PlanetAffixTightFences, PlanetAffixZoomedIn, RainbowRoadHW } from "./planet";
import { clearRendererMeshes, createAndPushMeshInstance, createAndPushPointLight, createMeshInstance, lightColor, lightPos, lightShadowColor, MeshInstance, meshInstances, PointLight, setSepia, viewMatrix } from "./renderer";
import { logicXor, padLeftWithZeroes, settleUnit } from "./utils";
import * as Input from "./input";
import { chooseNextDiv, chooseNextOptionsDivs, hideDiv, inGameHudDiv, mode, ModeChooseNext, ModeGameOver, ModeInGame, ModeTitleScreen, planetNumberToRoman, setMode, showDiv, tofuMode, universalTimer } from "./index";
import { MusicMainTheme, MusicReadySetGo, playMusic } from "~sound";

const carPos = vec3Splay();
const carTg = vec3Splay();

let carMaxVel: number;

let carVel: number;
const carVelTg = vec3Splay();
let turnSpeed: number;

let carMeshInstance: MeshInstance;
let carPartMeshInstance: MeshInstance;
let carHeadlights: PointLight[];

let planet: Planet;
let planetAffixes: number[];
let planetOptions: Planet[] = [];

export let planetNumber: number;
let planetNumberStr: string;

let numLap = 1;
let checkpointFlags: boolean[];

let cameraUp = vec3Splay();

const CameraBaseZoom = 1.7;
const CameraOutIncrement = 0.8;
let cameraMinZoom: number;
let cameraMaxZoom: number;
let cameraZoom: number;

let isRainbow: boolean;

let ts: number;
let timer: number;
let timePerLap: number;
let numLaps: number;

let nextOption: number;
let nextOptionAnims: number[];

let interactiveMode: boolean;

const timePerLapLenghtMultiplierBase = 0.95;

const trackLengthLowerBound = 4;
const trackLengthUpperBound = 9.85;

let mainThemeKiller: false | (() => void);

export const setInteractiveMode = (v: boolean) => {
    if (interactiveMode && !v && mainThemeKiller) {
        mainThemeKiller();
        mainThemeKiller = false;
    }
    interactiveMode = v;
}

const resetCheckpointFlags = () => {
    checkpointFlags = planet.checkpoints.map(() => false);
}

export const createLimitedPlanet = (affixes: number[], first?: boolean) => {
    let planet = createPlanet(affixes);

    const extraShort = !first && affixes.length == 0 && random() < 0.25;
    const extraLong = !extraShort && affixes.includes(PlanetAffixExtraLong);

    while (
        logicXor(extraShort, planet.totalDistance < trackLengthLowerBound)
        || logicXor(extraLong, planet.totalDistance > trackLengthUpperBound)
    ) {
        destroyPlanet(planet);
        planet = createPlanet(affixes);
    }

    return planet;
}

export const init = (first?: boolean) => {
    if (first) {
        const firstAffixes: number[] = [];
        planet = createLimitedPlanet(firstAffixes, first);

        // const distances = [];
        // for (let i = 0; i < 10000; ++i) {
        //     const p = createPlanet([]);
        //     distances.push(p.totalDistance);
        //     destroyPlanet(p);
        //     console.log(i);
        // }
        // const percs = [0, 0.15, 0.25, 0.5, 0.75, 0.85, 1];

        // distances.sort((a, b) => a - b);

        // for (let p of percs) {
        //     console.log(p, distances[floor(p * (distances.length - 1))]);
        // }
        planetNumber = 13;
    } else {
        planet = planetOptions[nextOption];
        for (let p of planetOptions) {
            if (p != planet) {
                destroyPlanet(p);
            }
        }
        planetNumber -= nextOption + 1;
        planetOptions.length = 0;
    }

    planetAffixes = planet.affixes;

    console.log("LETS PLAY", planet);

    isRainbow = planetAffixes.includes(PlanetAffixRainbow);
    const noSun = planetAffixes.includes(PlanetAffixNoSun);
    const atNight = planetAffixes.includes(PlanetAffixNight) || noSun;

    if (atNight) {
        if (noSun) {
            vecReset(lightColor);
        } else {
            vecSet(lightColor, 0.17, 0.24, 0.3, 0);
        }
        vecSet(lightShadowColor, 0.1, 0.01, 0.1);
    } else if (isRainbow) {
        vecSet(lightColor, 2, 2, 2, 0);
        vecSet(lightShadowColor, 0.9, 0.9, 0.9);
    } else {
        vecSet(lightColor, 1.3, 1.3, 1, 1);
        vecSet(lightShadowColor, 0.45, 0.66, 0.86);
    }

    carMaxVel = tofuMode ? 1.25 : remap(planetNumber, 13, 1, 0.8, 1.2);

    timePerLap = planet.totalDistance * timePerLapLenghtMultiplierBase * 1.25 / carMaxVel;
    const firstLapExtraTime = remap(isRainbow ? 20 : planetNumber, 1, 13, 1.1, 1.6);
    timer = timePerLap * firstLapExtraTime;

    planetNumberStr = planetNumberToRoman(planetNumber);

    numLaps = planetAffixes.includes(PlanetAffixEndurance) ? 6 : 3;

    // Init car
    vecCopy(carPos, planet.playerStartPos);
    vec3CrossNormalize(carPos, planet.playerStartDir, carTg);
    vecCopy(carVelTg, carTg);
    vecCopy(cameraUp, planet.playerStartDir);

    carMeshInstance = createAndPushMeshInstance(meshes[tofuMode ? MeshCarTofu : MeshCar]);
    carPartMeshInstance = createAndPushMeshInstance(meshes[MeshCarPart]);

    const headlightColor = vec3(1, 1, 0.9);
    const lightRadius = 0.3;

    carHeadlights = [];

    if (atNight) {
        for (let i = 0; i < 2; ++i) {
            arrayPush(carHeadlights, createAndPushPointLight(vec3Splay(0), headlightColor, lightRadius, 0.95, vec3Splay(0)));
        }
    }

    planet.pointLights.forEach(x => createAndPushPointLight(...x));


    arrayPush(meshInstances, ...planet.meshInstances);

    showDiv(inGameHudDiv);

    ts = 0;
    numLap = 1;
    carVel = 0;
    turnSpeed = 0;
    resetCheckpointFlags();
    turnSpeed = 0;

    cameraMaxZoom = planetAffixes.includes(PlanetAffixZoomedIn) ? 0.9 : CameraBaseZoom;
    cameraMinZoom = cameraMaxZoom + CameraOutIncrement;

    cameraZoom = cameraMaxZoom;

    nextOption = 0;
    nextOptionAnims = [0, 0, 0];

    setInteractiveMode(false);

    playMusic(MusicReadySetGo, false, () => {
        setInteractiveMode(true);
        mainThemeKiller = playMusic(MusicMainTheme, true);
    });
};

export const deInit = () => {
    clearRendererMeshes();
    destroyPlanet(planet);
};

const tick = (dt: number) => {
    const maxRotationVel = 0.032;
    let curAccel = 0;

    if (interactiveMode) {

        if (isInputDown(Input.InputDebugA)) {
            setMode(ModeChooseNext);
        }

        const isRight = isInputDown(Input.InputRight);
        if (isRight || isInputDown(Input.InputLeft)) {
            const q = vecBorrow<Quaternion>();
            turnSpeed = min(turnSpeed + 0.006, maxRotationVel);
            quatFromAxisAngle(carPos, turnSpeed * (isRight ? -1 : 1), q);
            quatApplyToVec3Normalize(q, carTg, carTg);
        } else {
            turnSpeed = 0;
        }

        const accel = 3;
        if (isInputDown(Input.InputUp)) {
            curAccel = accel;
        }
    }

    carVel *= 0.987;


    const carDir = vec3CrossNormalize(carTg, carPos, vecBorrow<Vec3>());

    const planarVel = vecBorrow<Vec3>();
    const planarVelDir = vecBorrow<Vec3>();

    vec3CrossNormalize(carVelTg, carPos, planarVelDir);

    // Correct velocity a bit to match car rotation
    {
        // Tofu: 3
        // 0.75 gripper

        const grip = planetAffixes.includes(PlanetAffixSlippery) ? 4 : (planetAffixes.includes(PlanetAffixSuperTraction) ? 0.5 : (tofuMode ? 3 : 0.7));
        vecMix(planarVelDir, carDir, 1 - tweenOut(x => pow(x, grip), (carVel / carMaxVel)), planarVelDir);
        vecNormalizeSafe(planarVelDir);
    }


    vecMulK(planarVelDir, carVel, planarVel);


    if (curAccel != 0) {
        vecFMKA(carDir, curAccel * dt, planarVel, planarVel);
    }

    if (isRainbow) {
        if (interactiveMode && getPlanetDistanceToMainPath(planet, carPos) > RainbowRoadHW) {
            setMode(ModeGameOver);
        }
    } else {
        for (let fi = 0; fi < 2; ++fi) {
            const fence = planet.fences[fi];
            const borrowerChk = vecBorrowerCheckpoint();
            for (let i = 0; i < fence.length - 1; ++i) {
                const t = sphereSegmentIntersection(carPos, carLength / 2, fence[i].pos, fence[i + 1].pos);
                if (t >= 0) {
                    const tDir = vecDot(planarVel, fence[i].curveTangent);
                    const tTg = vecDot(planarVel, fence[i].tg);

                    vecMulK(fence[i].curveTangent, tDir * 0.98, planarVel);
                    vecFMKA(fence[i].tg, -abs(tTg) * 0.7, planarVel, planarVel);
                }
            }
            vecBorrowerRestore(borrowerChk);
        }
    }

    // Go back to tangent+scalar
    if (!isRainbow || mode != ModeGameOver) {
        vec3CrossNormalize(carPos, planarVel, carVelTg);

        carVel = min(vecLength(planarVel), carMaxVel);

        const prevCarPos = vecBorrow<Vec3>();
        vecCopy(prevCarPos, carPos);

        const q = vecBorrow<Quaternion>();
        quatFromAxisAngle(carVelTg, carVel * dt, q);
        quatApplyToVec3Normalize(q, carPos, carPos);
        quatApplyToVec3Normalize(q, carTg, carTg);
        quatApplyToVec3Normalize(q, cameraUp, cameraUp);

        if (!vecEq(prevCarPos, carPos)) {
            const checkpoints = planet.checkpoints;
            for (let i = 0; i < checkpoints.length; ++i) {
                const intersection = arcsInUnitSphereIntersection(prevCarPos, carPos, checkpoints[i][0], checkpoints[i][1]);
                if (intersection) {
                    checkpointFlags[i] = true;
                    if (i == 0 && !checkpointFlags.includes(false)) {
                        ++numLap;
                        if (numLap > numLaps) {
                            setMode(ModeChooseNext);
                        }
                        timer += timePerLap;
                        resetCheckpointFlags();
                    }
                }
            }
        }
    }

    if (interactiveMode) {
        timer -= dt;
        if (timer <= 0) {
            setMode(ModeGameOver);
        }
    }
};

let tickDtRemainder = 0;
const fixedFps = 1 / 120;


export const update = (dts: number) => {
    ts += dts;
    tickDtRemainder = min(tickDtRemainder + dts, 0.5);
    while (tickDtRemainder >= fixedFps) {
        tickDtRemainder -= fixedFps;
        tick(fixedFps);
    }

    const mins = floor(timer / 60);
    const totalSecs = timer - mins * 60;
    const secs = floor(totalSecs);
    const mils = floor(fract(totalSecs) * 1000);
    inGameHudDiv.innerHTML = `PLANET ${planetNumberStr}<br><b>TIME ${padLeftWithZeroes(mins, 2)}:${padLeftWithZeroes(secs, 2)}:${padLeftWithZeroes(mils, 3)}<br>LAPS ${numLap}/${numLaps}</b>`;

    const targetZoom = (carVel / carMaxVel < 0.4) ? cameraMaxZoom : cameraMinZoom;

    cameraZoom = mix(cameraZoom, targetZoom, 0.05);

    const eye = vecBorrow<Vec3>();
    vecFMKA(carPos, cameraZoom, carPos, eye);
    vecFMKA(cameraUp, -cameraZoom / 2, eye, eye);
    mat4LookAt(eye, carPos, cameraUp, viewMatrix);

    const cameraDir = vecBorrow<Vec3>();
    vecSub(carPos, eye, cameraDir);
    vecNormalizeSafe(cameraDir);

    const cameraTg = vec3CrossNormalize(cameraUp, cameraDir, vecBorrow<Vec3>());

    vecFMKA(cameraTg, 3, eye, eye);
    vecCopy(lightPos, eye);

    {
        const carDir = vec3CrossNormalize(carTg, carPos, vecBorrow<Vec3>());

        const modelMatrix = carMeshInstance.modelMatrix;

        mat4FromBasisPlusTranslation(modelMatrix, carTg, carDir, carPos, carPos);
        mat4Copy(carPartMeshInstance.modelMatrix, modelMatrix);

        const tmpVec = vecBorrow<Vec3>();

        for (let i = 0; i < carHeadlights.length; ++i) {
            const hl = carHeadlights[i];
            vecCopy(hl.normal, carDir);
            vecSet(tmpVec, (i == 0 ? 1 : -1) * carLength / 3, carLength / 2, carLength / 4, 1);
            mat4Vec4Mul(modelMatrix, tmpVec as any as Vec4, hl.pos as any as Vec4);
        }
    }

    if (mode == ModeChooseNext) {
        for (let i = 0; i < 3; ++i) {
            const d = chooseNextOptionsDivs[i];
            const dStyle = d.style;
            const k = settleUnit(mix(nextOptionAnims[i], (i == nextOption) ? 1 : 0.8, 0.18));
            dStyle.transform = `scale(${k})`;
            dStyle.filter = `grayscale(${remap(k, 0.8, 1.0, 0.8, 0)})`;
            nextOptionAnims[i] = k;
        }

        if (Input.wasInputPressed(Input.InputLeft)) {
            nextOption = (nextOption + planetOptions.length - 1) % planetOptions.length;
        }

        if (Input.wasInputPressed(Input.InputRight)) {
            nextOption = (nextOption + 1) % planetOptions.length;
        }

        if (Input.wasInputPressed(Input.InputUiOk)) {

            setMode(ModeInGame);
        }
    }

    if (mode == ModeGameOver) {
        const secondsToSepia = 2.5;
        setSepia(min(1, universalTimer / secondsToSepia));
        if (universalTimer >= secondsToSepia && Input.wasAnyKeyPressed()) {
            setMode(ModeTitleScreen);
        }
        if (isRainbow) {
            vecMix(carPos, zeroVector, 0.1, carPos);
        }
    }
};

export const setupChooser = () => {
    let numPlanets = planetNumber == 1 ? 1 : min(3, planetNumber - 1);
    for (let i = 0; i < 3; ++i) {
        const d = chooseNextOptionsDivs[i];
        if (i < numPlanets) {
            const affixesPool = [
                [PlanetAffixEndurance],
                [PlanetAffixZoomedIn],
                [PlanetAffixNight, PlanetAffixNoSun],
                [PlanetAffixTightFences],
                [PlanetAffixSlippery, PlanetAffixSuperTraction],
                [PlanetAffixExtraLong],
            ];
            shuffleArray(affixesPool);

            const affixes = planetNumber == 1 ? [PlanetAffixRainbow] : [];

            for (let ai = 0; ai < i; ++ai) {
                const a = affixesPool.pop();
                arrayPush(affixes, pickRandomFromArray(a as any));
            }

            arrayPush(planetOptions, createLimitedPlanet(affixes));

            if (planetNumber == 1) {
                (d as any)._title.innerHTML = `SYSTEM CORE`;
                (d as any)._list.innerHTML = `• Exit warphole`;
            } else {
                (d as any)._title.innerHTML = `PLANET ${planetNumberToRoman(planetNumber - i - 1)}`;

                const affixesStrings = affixes.map(x => PlanetAffixStrings[x - 1]);
                (d as any)._list.innerHTML = affixesStrings.map(x => `• ` + x).join(`<br>`);
            }
            showDiv(d);
        } else {
            hideDiv(d);
        }
    }
    showDiv(chooseNextDiv);
}