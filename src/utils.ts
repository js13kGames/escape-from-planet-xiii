export const arrayLast = <T>(x: Array<T>) => x[x.length - 1];
export const arrayFromLast = <T>(x: Array<T>, idx: number) => x[x.length - 1 - idx];

export const arrayIndexWrap = <T>(x: Array<T>, idx: number) => {
    const len = x.length;
    return x[((idx % len) + len) % len];
}


export const padLeftWithZeroes = (n: number, len: number) => {
    return n.toString().padStart(len, "0");
};

export const settleUnit = (n: number) => {
    return (n > 0.99) ? 1 : ((n < 0.01) ? 0 : n);
}

export const physEps = 0.00001;

export const logicXor = (a: boolean, b: boolean) => (a && !b) || (!a && b);