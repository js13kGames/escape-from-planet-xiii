// vec2 h22(vec2 x)
// {
//     x = fract(x * 0.3183099 + 0.1) * 17.0;
//     float a = fract(x.x * x.y * (x.x + x.y)) * 2.0 * 3.14159287;
//     return vec2(sin(a), cos(a));
// }


// float gr(vec2 p){
//     vec2 i = floor(p);
//     vec2 f = fract(p);
//     vec2 u = f * f * (3.0 - 2.0 * f);
//     vec2 n = vec2(0, 1);
//     return mix(
//         mix(dot(h22(i + n.xx),f - n.xx), dot(h22(i + n.yx),f - n.yx), u.x),
//         mix(dot(h22(i + n.xy),f - n.xy), dot(h22(i + n.yy),f - n.yy), u.x),
//         u.y) *0.5 + 0.5;
// }
