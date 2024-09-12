/*
# ZeptoFM

 Mono synth for sounds modelling. 
 Even if it's in the name, it's not specifically focused on fm synthesis but can be used for it.

 Instruments and patterns created with code. Good fit for procedural stuff.
 Pre rendered instruments in two steps compile and render. Realtime patterns.
 Intended for use with a minifier. Not golfed or anything.
 Practically no error checking.
 See example folder for an example

----------------
 
# Sound Programs
 
 Program nodes are just arrays with positional parameters in them. For example:
    const frequency: SamplerNode = [Uniform, "frequency"];
    const graph: SamplerNode = [Add,
        [Multiply, [KarplusStrong, frequency, 1], 0.75],
        [Multiply, [Oscillator, OscillatorSawtooth, frequency], 0.25]
    ];
 A node can be a number instead of an array, and it will be treated as [Constant, N]
 
 Non-sine waves are band limited by additive synthesis by default
 "pure square" is the no band limited version of square
 
----------------

    Copyright 2024 Miguel Ángel Pérez Martínez

    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
    THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 
----------------
*/

const ENABLE_KARPUS_STRONG = false;

export const OscillatorSine = 0;
// export const OscillatorSquare = 1;
export const OscillatorTriangle = 2;
export const OscillatorSawtooth = 3;
export const OscillatorPureSquare = 4;
export const OscillatorPureTriangle = 5;
export const OscillatorPureSaw = 6;

// OP: (oscillatorType: number, freq: Sampler, phaseOffset?: number)
export const Oscillator = 0;

// OP: (freq: number, initialAmplitude: number)
export const KarplusStrong = 2;
// OP: (...nodes: SamplerNode)
export const Multiply = 3;
// OP: (...nodes: SamplerNode)
export const Add = 4;

export const BiQuadFilterHigh = 0;
export const BiQuadFilterLow = 1;

// OP: (src:SamplerNode, filterType: number, centerFreq: SamplerNode, Q: SamplerNode)
export const BiQuadFilter = 5;

// OP: (heldDuration:SamplerNode, aTime:SamplerNode, dTime:number, susLevel:number, rTime:number)
export const ADSR = 6;

// OP: ()
export const Noise = 7;

// OP: (value: number)
export const Constant = 8;

// OP: (name: string)
export const Uniform = 9;

// OP: (a: SamplerNode, b: SamplerNode, k: SamplerNode)
export const Mix = 10;

//OP: (freq:SamplerNode, cents:SamplerNode)
export const AddCents = 11;

//OP: (x: SamplerNode, min: SamplerNode)
export const Min = 12;

//OP: (x: SamplerNode, max: SamplerNode)
export const Max = 13;

//OP: (a: SamplerNode, b: SamplerNode)
// 2 ^ (log2(a) *b)
export const MultiplyLog2 = 14;

export type SamplerNode = any[] | number;

export let audioCtx: AudioContext;

type PrefilledBuffer = [pos: number, buf: Float32Array];

// Parametrs sn and sr are sample number and sample rate respectively.
// Heap is zeroed before run?
const generateSamplerProgramSrc = (sampler: SamplerNode, samplerate: number, numSamples: number) => {
    const doubleLiteral = (x: number) => `(${x.toFixed(50)})`;
    const indexBuffer = (idx: string) => `o[(((${idx})|0)<<2)>>2]`;
    const doubleToInt = (x: string) => `((~~floor(${x}))|0)`;
    const indexBufferWithDouble = (idx: string) => indexBuffer(doubleToInt(idx));

    const randomRange = (a: number, b: number) => a + Math.random() * (b - a);

    const samplerateJs = doubleLiteral(samplerate);
    let heapSizeInFloats = numSamples;

    const prefilledBuffers = [] as PrefilledBuffer[];
    const uniforms = {} as { [k: string]: number };
    const globalVarScope = ['v', 0] as any[];
    const variables: [string, string][] = [];


    const alloc = (sizeInFloats: number) => {
        const pos = heapSizeInFloats;
        heapSizeInFloats += sizeInFloats;
        return pos;
    };

    const addPrefilledBuffer = (sizeInFloats: number) => {
        const pb: PrefilledBuffer = [alloc(sizeInFloats), new Float32Array(sizeInFloats)];
        prefilledBuffers.push(pb);
        return pb;
    }

    const allocFloat = (val: number) => {
        const pb = addPrefilledBuffer(1);
        pb[1][0] = val;
        return pb[0];
    }

    const randomBuffer = addPrefilledBuffer(numSamples);
    for (let i = 0; i < numSamples; ++i) {
        randomBuffer[1][i] = randomRange(-1, 1);
    }
    let functionBody = `"use asm";var o=new s.Float32Array(b);`;

    ["min", "max", "cos", "sin", "fround", "floor", "abs", "pow", "log", "PI"].forEach(x => functionBody += `var ${x}=s.Math.${x};`);

    functionBody += `function log2(x){x=+x;return +(log(x)/log(2.));}function fct(x){x=+x;return +(x-floor(x))}function rnd(sn){sn=+sn;return +${indexBuffer(`${doubleToInt(`sn`)}+${randomBuffer[0]}`)}}function m(sn){sn=+sn;`;

    let js = ``;

    let tmpCounter = 0;
    const getTmpVar = (val: any, initVal?: any) => {
        const v = `m${tmpCounter++}`;
        variables.push([v, initVal ?? '0.0']);
        js += `${v}=${val};`;
        return v;
    };

    const doOp: any = (op: number | SamplerNode) => doOpInternal(...(op instanceof Array ? op : [Constant, op]));
    const doOpInternal: any = (id: any, ...rest: any[]) => {

        // Begin scope
        // Declares the current variable, increments it, and appends a new value
        ++globalVarScope[globalVarScope.length - 1];
        const curScopeVar = globalVarScope.join('_');

        variables.push([curScopeVar, '0.0']);
        globalVarScope.push(0);

        const setReturn = (s: string) => {
            js += `${curScopeVar}=${s};`;
        };

        const mixJs = (a: string, b: string, k: string) => `((1.0-(${k}))*(${a})+(${k})*(${b}))`;
        const clampJs = (x: string, minVal: string, maxVal: string) => `min(max(${x},${minVal}),${maxVal})`;
        const invLerpJs = (a: string, b: string, k: string) => `((${a}==${b})?(1.0):(((${k})-(${a}))/((${b})-(${a}))))`;

        (({
            /* 
             Important implementation detail: 
             It might be tempting to derive the current phase of the wave directly from the sample number
             but when the frequency is modulated the frequency change also introduces an instantaneous phase change
             that breaks completelly the behavior of the wave. The more correct way is to keep a "free-wheeling"
             phase counter that is incremented in proportion of the current frequency.
            */
            /*Oscillator*/ 0: (type: number, freq_: SamplerNode, phaseOffset?: number) => {
                const freq = doOp(freq_);
                const phaseHIdx = allocFloat(phaseOffset ?? 0.0);
                const phase = getTmpVar(`+${indexBuffer(`${phaseHIdx}`)}`);
                const circularPhase = ``;
                const phaseIncrement = getTmpVar(`${freq}/${samplerateJs}`);
                js += `${phase}=+fct(${phase}+${phaseIncrement});`;
                js += `${indexBuffer(`${phaseHIdx}`)}=fround(${phase});`;

                const pureSaw = `(${phase}*2.0-1.0)`;
                if (type == OscillatorSine) {
                    setReturn(`sin(${phase}*2.0*PI)`);
                } else if (type == OscillatorPureSquare) {
                    setReturn(`${pureSaw}>0.0?1.0:-1.0`);
                } else if (type == OscillatorPureSaw) {
                    setReturn(pureSaw);
                } else if (type == OscillatorPureTriangle) {
                    setReturn(`1.0-2.0*abs(${pureSaw})`);
                } else {
                    const a = getTmpVar(`0.0`);
                    for (let i = 0; i < 32; ++i) {
                        const oddHarmNumber = 2 * i + 1;
                        const alternating = i == 0 ? 1 : -1;
                        if (type == OscillatorSawtooth) {
                            js += `${a}=${a}+${doubleLiteral(alternating)}*sin(${doubleLiteral(i)}*${phase}*2.0*PI)/(${doubleLiteral(i + 1)});`;
                        } else if (type == OscillatorTriangle) {
                            js += `${a}=${a}+${doubleLiteral(alternating)}*sin(${doubleLiteral(oddHarmNumber)}*${phase}*2.0*PI)/(${doubleLiteral(oddHarmNumber * oddHarmNumber)});`;
                        }
                    }
                    setReturn(a);
                }
            },
            // /*KarplusStrong*/ 2: (freq_: SamplerNode, initialAmplitude: number) => {
            //     if (ENABLE_KARPUS_STRONG) {
            //         const freq = doOp(freq_);
            //         // Lower bound for table (1Hz) is sampleRate.
            //         const tableHIdx = alloc(samplerate);
            //         const N = getTmpVar(`(${samplerateJs} / ${freq})`);
            //         const i = getTmpVar(`0`, `0`);
            //         // Table init
            //         js += `if(sn==0.0){for(;(${i}|0)<${doubleToInt(N)};${i}=(${i}+1)|0){${indexBuffer(`${i}+${tableHIdx}`)}=fround(+rnd(+(${i}|0))*${doubleLiteral(initialAmplitude)})}}`;
            //         const idx = getTmpVar(`sn%${N}`);
            //         const curIdxBufferAccess = indexBufferWithDouble(`${idx}+${doubleLiteral(tableHIdx)}`);
            //         const retVal = getTmpVar(`+${curIdxBufferAccess}`);
            //         js += `${curIdxBufferAccess}=(${retVal}+(+${indexBufferWithDouble(`((${idx}+1.0)%${N})+${doubleLiteral(tableHIdx)}`)})+(+${indexBufferWithDouble(`((${idx}+2.0)%${N})+${doubleLiteral(tableHIdx)}`)}))/3.0;`
            //         setReturn(retVal);
            //     } else {
            //         setReturn(doubleLiteral(0));
            //     }
            // },
            /*Multiply*/ 3: (...args: SamplerNode[]) => {
                setReturn(args.map(x => doOp(x)).join(`*`));
            },
            /*Add*/ 4: (...args: SamplerNode[]) => {
                setReturn(args.map(x => doOp(x)).join(`+`));
            },
            // Parameters for specializations from: 
            // https://shepazu.github.io/Audio-EQ-Cookbook/audio-eq-cookbook.html
            // I think it's a 12db per octave filter, but I don't really know.
            // 
            /*BiQuadFilter*/ 5: (src_: SamplerNode, filterType: number, centerFreq_: SamplerNode, Q_: SamplerNode) => {
                const src = doOp(src_);
                const centerFreq = doOp(centerFreq_);
                const Q = doOp(Q_);
                const w0 = getTmpVar(`2.0*PI*${centerFreq}/${samplerateJs}`);
                const cosW0 = getTmpVar(`cos(${w0})`);
                const sinW0 = getTmpVar(`sin(${w0})`);
                const alpha = getTmpVar(`${Q}==0.0?0.0:(${sinW0}/(2.0*${Q}))`);
                const lhpfSign = filterType == BiQuadFilterHigh ? `1.0` : `(-1.0)`;
                const b0 = getTmpVar(`(1.0+${lhpfSign}*${cosW0})/2.0`);
                const b1 = getTmpVar(`-${lhpfSign}-${cosW0}`);
                const b2 = getTmpVar(`${b0}`);
                const a0 = getTmpVar(`1.0+${alpha}`);
                const a1 = getTmpVar(`-2.0*${cosW0}`);
                const a2 = getTmpVar(`1.0-${alpha}`);
                const heap = addPrefilledBuffer(4);
                const x0 = getTmpVar(`+${indexBuffer(`${heap[0]}`)}`);
                const x1 = getTmpVar(`+${indexBuffer(`${heap[0] + 1}`)}`);
                const y0 = getTmpVar(`+${indexBuffer(`${heap[0] + 2}`)}`);
                const y1 = getTmpVar(`+${indexBuffer(`${heap[0] + 3}`)}`);
                const out = getTmpVar(`(${b0}/${a0})*${src}+(${b1}/${a0})*${x0}+(${b2}/${a0})*${x1}-(${a1}/${a0})*${y0}-(${a2}/${a0})*${y1}`);
                js += `${out}=${clampJs(out, `-1.0`, `1.0`)};`
                js += `${indexBuffer(`${heap[0]}`)}=${src};`;
                js += `${indexBuffer(`${heap[0] + 1}`)}=${x0};`;
                js += `${indexBuffer(`${heap[0] + 2}`)}=${out};`;
                js += `${indexBuffer(`${heap[0] + 3}`)}=${y0};`;
                setReturn(out);
            },
            /*ADSR*/ 6: (heldDuration_: SamplerNode, aTime_: SamplerNode, dTime: number, susLevel: number, rTime: number) => {
                const aTime = doOp(aTime_);
                const heldDuration = doOp(heldDuration_);
                const eps = 0.0001;
                // Add always the tiniest bit of decay time to avoid divisions by zero later 
                const beforeSustainTime = getTmpVar(`${aTime} + ${doubleLiteral(dTime + eps)}`);
                const releaseTime = getTmpVar(`${heldDuration}`);
                const t = getTmpVar(`sn/${samplerateJs}`);
                // Add always the tiniest bit of relay time to avoid divisions by zero later 
                const SR = getTmpVar(`${doubleLiteral(susLevel)}*(1.0-${clampJs(invLerpJs(releaseTime, `${releaseTime} + ${doubleLiteral(rTime + eps)}`, t), `0.0`, `1.0`)})`);
                const A = getTmpVar(clampJs(invLerpJs(`0.0`, aTime, t), `0.0`, `1.0`));
                const remapK = getTmpVar(clampJs(invLerpJs(aTime, beforeSustainTime, t), `0.0`, `1.0`));
                setReturn(`${beforeSustainTime} == 0.0 ? ${SR} : (${mixJs(A, SR, remapK)})`);
            },
            /*Noise*/ 7: () => {
                setReturn(`+rnd(sn)`);
            },
            /*Constant*/ 8: (value: number) => {
                setReturn(doubleLiteral(value));
            },
            /*Uniform*/ 9: (name: string) => {
                if (!uniforms[name]) {
                    uniforms[name] = alloc(1);
                }
                setReturn(`+${indexBuffer(`${uniforms[name]}`)}`);
            },
            /*Mix*/ 10: (a_: SamplerNode, b_: SamplerNode, k_: SamplerNode) => {
                const a = doOp(a_);
                const b = doOp(b_);
                const k = doOp(k_);
                setReturn(mixJs(a, b, k));
            },
            /*AddCents*/ 11: (freq_: SamplerNode, cents_: SamplerNode) => {
                const freq = doOp(freq_);
                const cents = doOp(cents_);
                setReturn(`${freq}*pow(2.0,${cents}/1200.0)`);
            },
            /*Min*/ 12: (x_: SamplerNode, min_: SamplerNode) => {
                const x = doOp(x_);
                const min = doOp(min_);
                setReturn(`min(${x},${min})`);
            },
            /*Max*/ 13: (x_: SamplerNode, max_: SamplerNode) => {
                const x = doOp(x_);
                const max = doOp(max_);
                setReturn(`max(${x},${max})`);
            },
            /*MultiplyLog2*/ 14: (a_: SamplerNode, b_: SamplerNode) => {
                const a = doOp(a_);
                const b = doOp(b_);
                setReturn(`pow(2.0,+log2(${a})*${b})`);
            },

        } as any)[id])(...rest);

        globalVarScope.pop();
        return curScopeVar;
    };
    doOp(sampler);
    functionBody += `var ` + variables.map(x => `${x[0]}=${x[1]}`).join(`,`) + `;`;
    functionBody += `${js}return fround(${globalVarScope.join('_')});}`;
    functionBody += `function r(){var i=0;for(;(i|0)<${numSamples};i=(i+1)|0){${indexBuffer(`i`)}=fround(m(+(i|0)))}}return {r:r};`;
    return { functionBody, heapSizeInFloats, prefilledBuffers, uniforms };
};

export const compileSamplerProgram = (sampler: SamplerNode, samplerate: number, seconds: number) => {
    const numSamples = (samplerate * seconds) | 0;
    const src = generateSamplerProgramSrc(sampler, samplerate, numSamples);
    const compiler = new Function('s', 'f', 'b', src.functionBody);
    //console.log(compiler.toString());
    const byteArraySize = Math.pow(2, Math.ceil(Math.log2(src.heapSizeInFloats * 4)));
    const heap = new Float32Array(byteArraySize);

    const module = compiler(window, null, heap.buffer);

    return {
        init: () => {
            for (let pb of src.prefilledBuffers) {
                heap.set(pb[1], pb[0]);
            }
        },
        render: module['r'],
        setUniform: (name: string, value: number) => {
            heap[src.uniforms[name]] = value;
        },
        heap,
        numSamples,
        samplerate,
        ...src,
    };
};

export type SamplerProgram = ReturnType<typeof compileSamplerProgram>;


// Higher level structures that might be util to have around


export const clamp = (x: SamplerNode, min: SamplerNode, max: SamplerNode) => {
    return [Min, [Max, x, max], min];
}

// Maps k from 0:1 to baseFreq:nyquist using a power of 2
export const mapFrequencyCutoffSamplerNode = (baseFreq: SamplerNode, k: SamplerNode, samplerate: number) => {
    return clamp([AddCents, baseFreq, [Multiply, 18000, k]], 0, samplerate / 2);
};

export const oneMinusXSamplerNode = (x: SamplerNode) => {
    return [Add, 1, [Multiply, -1, x]];
};

export const lowPass = (src: SamplerNode, cutOff: SamplerNode, Q: SamplerNode) => {
    return [BiQuadFilter, src, BiQuadFilterLow, cutOff, Q];
};

export const highPass = (src: SamplerNode, cutOff: SamplerNode, Q: SamplerNode) => {
    return [BiQuadFilter, src, BiQuadFilterHigh, cutOff, Q];
};

export const adsrAR = (attack: number, release: number) => {
    return [ADSR, 0, attack, 0, 1, release];
};

// Doesn't return a copy! Don't modify output!
export const renderToFloatArray = (program: SamplerProgram) => {
    program.init();
    program.render();
    return program.heap.subarray(0, program.numSamples);
}

export const renderToAudioBuffer = (program: SamplerProgram) => {
    const samples = renderToFloatArray(program);
    //console.log(samples);
    const buffer = audioCtx.createBuffer(1, samples.length, program.samplerate);
    buffer.copyToChannel(samples, 0);
    return buffer;
};

export const playAudioBuffer = (buffer: AudioBuffer, when: number, dest: ZFMAudioNode<AudioNode>, rate?: number) => {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    dest.addInput(source);
    source.playbackRate.value = rate ?? 1;
    source.start(when);
}


export const initAudioContext = () => {
    audioCtx = audioCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
};

// MIDI tuning standard that puts A440 at 69
export const noteNumberToFreq = (note: number) => Math.pow(2, (note - 69) / 12) * 440;

// programSetup should return an already compiled program. It should set uniforms in this function accordingly
export const setupInstrument = (programSetup: (frequency: number, noteNumber: number, duration: number) => SamplerProgram) => {
    return {
        programSetup,
        notes: [] as AudioBuffer[][],
    };
};

export type Instrument = ReturnType<typeof setupInstrument>;

export const renderInstrumentNote = (instrument: Instrument, noteNumber: number, duration: number) => {
    if (!instrument.notes[noteNumber]) {
        instrument.notes[noteNumber] = [];
    }
    instrument.notes[noteNumber][duration] = renderToAudioBuffer(instrument.programSetup(noteNumberToFreq(noteNumber), noteNumber, duration));
}


/*
    A sequence is a string similar to MML
    renderedInstrument is a rendered instrument that will be used with PlayNote
    Letters from "a" to "g" set the note. Use # to for sharp
    "r" means a rest
    A number after a note or a rest sets the current note duration denominator (ie  4 = 1/4)
    "o" followed by a number sets the octave
    ">" and "<" raises and lowers octave
    "t" followed by a number sets BPM
    "v" followed by a number sets volume (0 to 10)
    

    Returns a function f(lookaheadSeconds:number, playHandler?: (instrument:Instrument, noteNumber: number) => void)
    that might be called periodically to schedule new beats in the sound context.
    lookaheadSeconds specifies how many seconds of scheduling buffernodes are desired. Can be negative to schedule all at once and reset the sequence after it.
    playHandler is an optional callback that will be called instead of playing nodes. It's particularly useful for prerendering notes.
*/

export type ZFMAudioNode<T extends AudioNode> = T & {
    addInput: (input: AudioBufferSourceNode) => void;
    kill: () => void;
};

export const createZFMGainNode = (): ZFMAudioNode<GainNode> => {
    const gainNode = audioCtx.createGain() as ZFMAudioNode<GainNode>;
    gainNode.connect(audioCtx.destination);

    const inputs: AudioBufferSourceNode[] = [];
    gainNode.addInput = (input: AudioBufferSourceNode) => {
        input.connect(gainNode);
        inputs.push(input);
    };

    gainNode.kill = () => {
        if (inputs.length) {
            gainNode.disconnect();
            for (let i of inputs) {
                i.stop();
            }
        }
    }

    return gainNode;
};


export const pseudoMMLSequencer = (instrument: Instrument, originalSequence: string, trackGain: number) => {
    let sequence: string;

    const getCommand = () => {
        const commands = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b", "r", "o", ">", "<", "t", "v", "k"];
        const cmd = commands.findLastIndex(x => sequence.startsWith(x));
        sequence = sequence.slice((commands[cmd] ?? "").length);
        return cmd;
    };

    const getNumber = () => {
        const n = parseInt(sequence, 10);
        if (isNaN(n)) {
            return 0;
        }
        sequence = sequence.slice(`${n}`.length);
        return n;
    };

    trackGain *= 0.6;

    return (playHandler: (currentTimestamp: number, instrument: Instrument, noteNumber: number, noteDuration: number, volume: number, ...extra: any[]) => void, ...playHandlerExtraArgs: any[]) => {
        sequence = "v10" + originalSequence;
        let bpm = 120;
        let octave = 4;
        let noteValue = 4;
        let volume = 0;
        const ctxTime = audioCtx.currentTime;
        let currentTimestamp = ctxTime;
        while (sequence != "") {
            let cmd = getCommand();
            if (cmd <= 12) {

                const newNoteValue = getNumber();
                if (newNoteValue) {
                    noteValue = newNoteValue;
                }

                const noteDurationSeconds = 240 / (bpm * noteValue);

                if (cmd == 12) {
                    // Rest
                } else {
                    const noteNumber = 12 * octave + cmd;
                    playHandler(currentTimestamp, instrument, noteNumber, noteDurationSeconds, trackGain * volume / 10, ...playHandlerExtraArgs);
                }

                currentTimestamp += noteDurationSeconds;
            }

            switch (cmd) {
                case 13: //o
                    octave = getNumber();
                    break;
                case 14: //">"
                    ++octave;
                    break;
                case 15: //"<"
                    --octave;
                    break;
                case 16: //t
                    bpm = getNumber();
                    break;
                case 17://volume
                    volume = getNumber();
                    break;
                case 18:
                    break;

            }
        }
        return (currentTimestamp - ctxTime) * 1000;
    }
};
