import { addLoadJob } from "~assets";
import { Add, AddCents, ADSR, adsrAR, audioCtx, BiQuadFilter, BiQuadFilterLow, compileSamplerProgram, createZFMGainNode, highPass, initAudioContext, Instrument, mapFrequencyCutoffSamplerNode, Max, Multiply, MultiplyLog2, Noise, oneMinusXSamplerNode, Oscillator, OscillatorSawtooth, OscillatorSine, OscillatorTriangle, playAudioBuffer, pseudoMMLSequencer, renderInstrumentNote, SamplerNode, setupInstrument, Uniform, ZFMAudioNode } from "./zeptofm/zeptofm";
import { arrayPush, max } from "~aliasedFunctions";

let outputSamplingRate: number;


const uFreq: SamplerNode = [Uniform, "f"];
const uVelocity: SamplerNode = [Uniform, "v"];
const uHeldDuration: SamplerNode = [Uniform, "h"];

const kickDrumNode = () => {
    const adsr = adsrAR(0.02, 0.55);
    const sinOsc = [Multiply, [Oscillator, OscillatorSine, [Max, 1, [MultiplyLog2, uFreq, adsr], 0.06]], adsr];
    return sinOsc;
};

const hiHatNode = (release: number) => {
    const adsr = adsrAR(0, release);
    return [Multiply, highPass([Noise], mapFrequencyCutoffSamplerNode(1000, oneMinusXSamplerNode(adsr), outputSamplingRate), 1), adsr];
};

const superSawNode = () => {
    const adsr = [ADSR, uHeldDuration, 0, 0.01, 0.8, 0.08];
    const saws: SamplerNode[] = [];
    for (let i = 0; i < 3; ++i) {
        arrayPush(saws, [Multiply, [Oscillator, OscillatorSawtooth, [AddCents, uFreq, i * 5]], adsr]);
    }
    return [Add, ...saws];
};


const majorChord = [0, 4, 7];
const minorChord = [0, 3, 7];
// const ahhhChord = () => {
//     const adsr = [ADSR, uHeldDuration, 0, 0.01, 0.8, 0.08];
//     // Minor chord
//     const stack = [];
//     for (let i = 0; i < 3; ++i) {
//         const ahh = [Oscillator, OscillatorSine, [AddCents, uFreq, minorChord[i] * 100]];
//         stack.push([Multiply, ahh, adsr, 1 / 3]);
//     }
//     return [Add, ...stack]
// };

const createInstrument = (node: SamplerNode, maxDuration: number) => {
    const program = compileSamplerProgram(node, outputSamplingRate, /* 1 / outputSamplingRate */maxDuration);
    return setupInstrument((freq, noteNumber, duration) => {
        program.setUniform(uFreq[1], freq);
        program.setUniform(uHeldDuration[1], duration);
        return program;
    });
};

const createSequencePlayer = (node: SamplerNode, maxDuration: number, seq: string, gain: number) => {
    const inst = createInstrument(node, maxDuration);
    return pseudoMMLSequencer(inst, seq + "k", gain);
}

export const MusicMainTheme = 0;
export const MusicReadySetGo = 1;

type PatternsPlayer = ReturnType<typeof createSequencePlayer>[];
let musicPatternPlayers: PatternsPlayer[] = [];

export const soundInit = () => {
    initAudioContext();
    outputSamplingRate = audioCtx.sampleRate;

    const r = (s: string, n: number) => s.repeat(n);

    const setTempo = "t150";


    { // Main Theme
        const kdb = r("g4ggg", 3);
        const kickDrumSequence = setTempo + r(kdb + "gggg8g", 3) + kdb + "gggg16ggg";
        const kickDrumPlayer = createSequencePlayer(kickDrumNode(), 0.6, r(kickDrumSequence, 1), 0.5);

        const closedHiHatSequence = setTempo + r("g16ggg", 64);
        const closedHiHatPlayer = createSequencePlayer(hiHatNode(0.03), 0.04, r(closedHiHatSequence, 1), 0.035);

        const openHiHatSequence = setTempo + r("r8g4ggg8", 16);
        const openHiHatPlayer = createSequencePlayer(hiHatNode(0.15), 0.16, r(openHiHatSequence, 1), 0.02);

        const superSawStacks: any[] = [];

        const superSawSequences = [
            setTempo + r("o4a8r2a4r8a8r8r2r4a8r2a4r8r8a8r16a8r16a8r16a8r16r8", 1),
            setTempo + r("o5e8r2f4r8e8r8r2r4e8r2f4r8r1", 1),
            setTempo + r("o5c8r2c4r8c8r8r2r4c8r2c4r8a8r16g#8r16g8r16f#8r16f8e", 1),
        ];

        for (let ss of superSawSequences) {
            arrayPush(superSawStacks, createSequencePlayer(superSawNode(), 2, r(ss, 4), 0.06));
        }

        // const ahhhChordSequence = setTempo + r("o4a1o5c1o4a1g1", 4)
        // const ahhhChordPlayer = createSequencePlayer(ahhhChord(), 2, r(ahhhChordSequence, 1), 0.2);

        const patternPlayers = [
            kickDrumPlayer,
            closedHiHatPlayer,
            openHiHatPlayer,
            ...superSawStacks,
            // ahhhChordPlayer,
        ];

        musicPatternPlayers[MusicMainTheme] = patternPlayers;
    }

    {   // Ready set go!
        //
        musicPatternPlayers[MusicReadySetGo] = [createSequencePlayer(superSawNode(), 2, "t100o5c#4rc#rc#r>>c#2", 0.1)];
    }


    const curTime = audioCtx.currentTime;

    // Prerender

    const noteRenderer = (currentTimestamp: number, instrument: Instrument, note: number, noteDuration: number) => {
        if (instrument.notes[note] && instrument.notes[note][noteDuration]) return;
        renderInstrumentNote(instrument, note, noteDuration);
    }

    musicPatternPlayers.forEach(pp => pp.forEach(x => addLoadJob(() => x(noteRenderer))));
};

export const playMusic = (idx: number, loop?: boolean, onComplete?: () => void) => {


    const playHandler = (currentTimestamp: number, instrument: Instrument, noteNumber: number, noteDuration: number, volume: number, gainNode: ZFMAudioNode<GainNode>) => {
        gainNode.gain.value = volume;
        playAudioBuffer(instrument.notes[noteNumber][noteDuration], currentTimestamp, gainNode);
    };

    let maxDurationTimeMs!: number;

    const music = musicPatternPlayers[idx];
    let gainNodes = music.map(() => createZFMGainNode());

    const playFunction = () => {
        maxDurationTimeMs = music.map((x, i) => x(playHandler, gainNodes[i])).reduce((prev, cur) => max(prev, cur));
    }

    playFunction();

    let intervalIdx: number;
    let timeoutIdx: number;

    if (loop) {
        intervalIdx = setInterval(playFunction, maxDurationTimeMs);
    }

    if (onComplete) {
        timeoutIdx = setTimeout(onComplete, maxDurationTimeMs);
    }

    return () => {
        if (loop) {
            clearInterval(intervalIdx);
        }
        if (onComplete) {
            clearTimeout(timeoutIdx);
            onComplete();
        }
        gainNodes.forEach(x => x.kill());
    };
};
