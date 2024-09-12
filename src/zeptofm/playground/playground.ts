
import { Instrument, SamplerNode, Uniform, Add, Multiply, KarplusStrong, OscillatorSawtooth, compileSamplerProgram, BiQuadFilterLow, setupInstrument, initAudioContext, audioCtx, Oscillator, ADSR, BiQuadFilter, renderInstrumentNote, playAudioBuffer, SamplerProgram, Mix, renderToFloatArray, OscillatorTriangle, OscillatorSine, OscillatorPureTriangle, AddCents, mapFrequencyCutoffSamplerNode, oneMinusXSamplerNode, Noise, lowPass, MultiplyLog2, adsrAR, highPass, ZFMAudioNode } from "../zeptofm";

let outputSamplingRate: number;
let instrument: Instrument;
let renderingDiv: HTMLElement;

const octaveNumber = 4;

const uniformControls: [SamplerNode, initialValue: number, min: number, max: number, step: number][] = [];

const addDebugSamplerNodePlot = (sn: SamplerNode, samplerate: number, seconds: number, scale: number, uniforms?: any) => {
    const prog = compileSamplerProgram(sn, samplerate, seconds);

    if (uniforms) {
        for (let k in uniforms) {
            prog.setUniform(k, uniforms[k]);
        }
    }

    const samples = renderToFloatArray(prog);
    const canvas = document.createElement("canvas");
    const w = 1000;
    const h = 300;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.fillStyle = "#888888";
    ctx.fillRect(0, 0, w, h);

    // Grid
    {
        const margin = 20;
        const xLabelSize = 9;
        const gridW = w - margin * 2;
        const gridH = h - margin * 2 - xLabelSize;
        const numY = 9;
        const numX = 21;
        ctx.fillStyle = `rgba(0,0,0,0);`
        ctx.strokeStyle = `#FFFFFF`;
        ctx.lineWidth = 1;

        // Ys
        for (let i = 0; i < numY; ++i) {
            const y = margin + gridH * i / (numY - 1);
            ctx.beginPath();
            ctx.moveTo(margin, y);
            ctx.lineTo(margin + gridW, y);
            ctx.stroke();
        }

        // Xs
        for (let i = 0; i < numX; ++i) {
            const x = margin + gridW * i / (numX - 1);
            ctx.beginPath();
            ctx.moveTo(x, margin);
            ctx.lineTo(x, margin + gridH);
            ctx.stroke();
            ctx.textAlign = "center";
            ctx.font = `${xLabelSize}px sans-serif`;
            ctx.fillStyle = `#FFFFFF`;
            ctx.fillText(`${(seconds * i / (numX - 1)).toFixed(3)}s`, x, margin + gridH + xLabelSize);
        }

        // Plot
        ctx.strokeStyle = `#7EF1E7`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < gridW; ++i) {
            const sampleValue = samples[(samplerate * seconds * i / (gridW - 1)) | 0] / scale;
            const y = (1 - ((sampleValue + 1) / 2)) * gridH + margin;
            if (i == 0) {
                ctx.moveTo(margin + i, y);
            } else {
                ctx.lineTo(margin + i, y);
            }
        }
        ctx.stroke();
    }
    document.body.appendChild(canvas);
}

//Instruments with inspiration from Gordon Reid's Synth Secrets and Fred Welsh's Patches

// const trumpet = (freq: SamplerNode, velocity: SamplerNode, durationSeconds: number, samplerate: number) => {


//     const transientInAdsr = [ADSR, durationSeconds, 0.6, 0, 1, 0.19];

//     const vibrato = [AddCents, freq, [Multiply, transientInAdsr, 20, [Oscillator, OscillatorPureTriangle, 5]]];

//     const osc = [Oscillator, OscillatorSawtooth, [Multiply, vibrato, 2]];

//     const growl = [Multiply, 0.4, [ADSR, 0, 0, 0.1, 0, 0], [Oscillator, OscillatorPureTriangle, 80]];

//     const lpfCutoffAdsr = mapFrequencyCutoffSamplerNode([Multiply, freq, 0.5], [Add, growl, transientInAdsr], samplerate);

//     const filtered = [BiQuadFilter, osc, BiQuadFilterLow, lpfCutoffAdsr, 0.4];
//     return [Multiply, filtered, [ADSR, durationSeconds, 0.1, 0, 0.8, 0.19]];
// };


const Sound = (freq: SamplerNode) => {
    const adsr = [ADSR, 0.2, 0, 0, 1, 0.05];
    return [Multiply, [Oscillator, OscillatorSawtooth, freq], adsr];
};

// Create instrument here
const createInstrument = (): [SamplerProgram, Instrument] => {
    const durationSeconds = 0.3;

    const freq: SamplerNode = [Uniform, "freq"];
    const velocity: SamplerNode = [Uniform, "velocity"];
    const heldDuration: SamplerNode = [Uniform, "heldDuration"];
    const finalGain: SamplerNode = [Uniform, "finalGain"];


    // const vibratoAmplitude: SamplerNode = [Uniform, "vibratoAmplitude"];

    // const adsr = [ADSR, 1, [Mix, 0.4, 0.01, velocity], 0.3, 0.5, 0.1];

    // const vibrato: SamplerNode = [AddCents, freq, [Multiply, vibratoAmplitude, [Oscillator, OscillatorPureTriangle, 5]]];


    // const saw: SamplerNode = [Oscillator, OscillatorSawtooth, vibrato];

    // const lowPassAdsr = [ADSR, 10, 0.05, 0.05, 0.5, 0];
    // const graph = [BiQuadFilter, saw, BiQuadFilterLow, [Multiply, lowPassAdsr, freq, 2], 2];

    // const gain = [Multiply, [Mix, 0.5, 1, velocity], finalGain];

    addDebugSamplerNodePlot(Sound(freq), 44100, durationSeconds, 1, { freq: 440 });

    const finalNode = [Multiply, Sound(freq), finalGain];

    // Setup uniform controls
    //uniformControls.push([velocity, 0.5, 0, 1, 0.01]);
    uniformControls.push([finalGain, 0.4, 0, 1, 0.01]);


    const program = compileSamplerProgram(finalNode, outputSamplingRate, durationSeconds);
    return [program,
        setupInstrument((freq, noteNumber) => {
            program.setUniform("freq", freq);
            return program;
        })];

};

const render = () => {
    renderingDiv.innerText = "RENDERING...";
    setTimeout(() => {
        console.time("Rendering");

        for (let i = 0; i < 12; ++i) {
            renderInstrumentNote(instrument, 12 + octaveNumber * 12 + i, 0.3);
        }

        console.timeEnd("Rendering");
        renderingDiv.innerText = "";
    }, 0);
};


let triggerRenderTimeout = -1;
const triggerRender = () => {
    if (triggerRenderTimeout >= 0) {
        clearTimeout(triggerRenderTimeout);
    }
    triggerRenderTimeout = setTimeout(() => {
        render();
        triggerRenderTimeout = -1;
    }, 600);
};

const init = async () => {
    initAudioContext();
    outputSamplingRate = audioCtx.sampleRate;

    console.log("Samplerate:", outputSamplingRate);

    let program: SamplerProgram;
    [program, instrument] = createInstrument();

    const controlsPanel = document.getElementById("controls-panel");

    renderingDiv = document.createElement("div");
    renderingDiv.id = "rendering-div";
    controlsPanel?.appendChild(renderingDiv);

    // Setup controls
    for (let ctrl of uniformControls) {
        const controlBlock = document.createElement("div");
        controlBlock.classList.add("control");

        const controlLabel = document.createElement("div");

        {
            const title = document.createElement("span");
            title.id = "title";
            title.innerText = (ctrl as any)[0][1];
            controlLabel.appendChild(title);
        }

        const valueLabel = document.createElement("span");
        valueLabel.id = "value";
        valueLabel.innerText = `${ctrl[1]}`;
        controlLabel.appendChild(valueLabel);

        controlBlock.appendChild(controlLabel);

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = `${ctrl[2]}`;
        slider.max = `${ctrl[3]}`;
        slider.step = `${ctrl[4]}`;
        slider.value = `${ctrl[1]}`;

        slider.oninput = () => {
            valueLabel.innerText = slider.value;
            program.setUniform((ctrl as any)[0][1], parseFloat(slider.value));
            triggerRender();
        }

        controlBlock.appendChild(slider);

        controlsPanel?.appendChild(controlBlock);

        program.setUniform((ctrl[0] as any)[1], ctrl[1]);
    }

    render();

    const pianoPanel = document.getElementById("piano-panel");

    const noteInOctaveToString = (n: number) => String.fromCharCode("A".charCodeAt(0) + ((n + 2) % 7));

    const keySize = 40;

    const blacksRow = document.createElement("div");
    const whitesRow = document.createElement("div");
    pianoPanel?.append(blacksRow);
    pianoPanel?.append(whitesRow);

    const blacks = [1, 3, 6, 8, 10];

    for (let i = 0; i < 12; ++i) {
        const isBlack = blacks.includes(i);

        // Black spacers
        if (i == 1 || i == 6) {
            const spacer = document.createElement("span");
            spacer.classList.add(`spacer`);
            spacer.style.width = `${keySize / (i == 1 ? 2 : 1)}px`;
            blacksRow.appendChild(spacer);
        }

        const baseNoteIdx = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][i];

        const keyButton = document.createElement("button");
        keyButton.classList.add(isBlack ? "black-key" : "white-key");
        keyButton.innerText = `${noteInOctaveToString(baseNoteIdx)}${isBlack ? `#` : ``}${octaveNumber}`;
        keyButton.style.width = `${keySize}px`;
        keyButton.style.height = `${keySize}px`;



        keyButton.onclick = () => {
            playAudioBuffer(instrument.notes[12 + octaveNumber * 12 + i][0.3], 0, audioCtx.destination as ZFMAudioNode<AudioDestinationNode>);
        }

        (isBlack ? blacksRow : whitesRow).appendChild(keyButton);
    }


    const keys = ["A", "Q", "S", "W", "D", "F", "R", "G", "T", "H", "Y", "J"].map(x => `Key${x}`);
    window.addEventListener('keydown', (event: KeyboardEvent) => {
        const noteIdx = keys.indexOf(event.code);
        if (noteIdx >= 0) {
            playAudioBuffer(instrument.notes[12 + octaveNumber * 12 + noteIdx][0.3], 0, audioCtx.destination as ZFMAudioNode<AudioDestinationNode>);
        }
    }, true);
}

const button = document.createElement("button");
button.innerText = "Click to begin";

button.onclick = () => {
    init();
    document.body.removeChild(button);
};

document.body.appendChild(button);
