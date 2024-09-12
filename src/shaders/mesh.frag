layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;
layout(location = 2) out vec4 outWorldPos;

flat in float vyMaterial;
in vec2 vyUv;
in vec3 vyNormal;
in vec4 vyWorldPos;  
in vec3 vyLocalPos;
in vec3 vyLocalNormal;

uniform highp sampler2DArray texArray;

void main()
{   
    vec3 ln = normalize(vyLocalNormal);
    vec2 uv = vyUv;
    if(vyMaterial == 8.0) {
        uv = vyLocalPos.xz * 35.0;
    }
    outColor = vec4(ln, vyMaterial);
    outNormal = vec4(normalize(vyNormal), uv.x);
    outWorldPos = vec4(vyWorldPos.xyz, uv.y);
}
