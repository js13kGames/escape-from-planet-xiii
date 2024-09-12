const nb = parseInt(process.argv[2])

const func = () => { 
    let k = nb / 1024; 
    let i=0;
    let f=0;
    let s = "";
    for (; i < 6; f = 6 * k / 13 - i, s += f <= 0 ? "🌑" : ["🌘", "🌗", "🌖", "🌕"][((f > 1 ? 1 : f) * 3) | 0], i++); 
    return `${s} ${(k * 1000 | 0) / 1000} KiB / 13 KiB #js13k`; 
};


console.log(func());