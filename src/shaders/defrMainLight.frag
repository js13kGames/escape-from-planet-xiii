layout(location = 0) out vec3 outComposite;
layout(location = 1) out vec3 outMaterialColor;

uniform highp sampler2D texColor;
uniform highp sampler2D texNormals;
uniform highp sampler2D texPos;
uniform highp sampler2D shadowDepth;


uniform vec3 lightPos; 
uniform vec4 lightColor; 
uniform vec3 lightShadowColor; 
uniform mat4 lightViewMatrix;
uniform mat4 lightProjMatrix;

in vec2 vyUv;

float unitSine(float x) {
    return (1.0 + sin(x))*0.5;
}

float checkers(vec2 uv) {
    uv = step(0.5, fract(uv));
    return mod(uv.x + uv.y, 2.0);
}

vec4 procTex(vec2 uv, int layer)  {
    if (layer == 1) {
        return vec4(checkers(uv));    
    } else if (layer == 2) {
        vec3 colA = vec3(0.18, 0.56 , 0.15);
        vec3 colB = vec3(0.42, 0.65, 0.07);
        vec3 mixA = mix(colA, colB, unitSine(uv.x * 120.0));
        vec3 mixB = mix(colA, colB, unitSine(uv.y * 120.0));
        vec3 c = mix(mixA, mixB, checkers(uv));        
        return vec4(c,1);
    } else if (layer == 3) {
        vec3 roadColor = vec3(0.4);
        vec3 lineColor = vec3(0.97, 0.71, 0);
        uv.x = abs(uv.x * 2.0 - 1.0);
        float lineK = min(smoothstep(0.75, 0.76, uv.x),smoothstep( 0.86, 0.85, uv.x));
        return vec4(mix(roadColor, lineColor, lineK),1);
    } else if (layer == 4) {
        float twoPi = 2.0 * 3.14159;
        vec2 d = vec2(cos(uv.x * twoPi), sin(uv.x * twoPi));
        return (1.0 + vec4(d.x, dot(d, normalize(vec2(-1, 1))), dot(d,normalize(vec2(-1, -1)) ), 1)) / 2.0;
    }
    return vec4(1);
}



void main()
{
    vec2 destSize = vec2(textureSize(texColor, 0));
    vec4 texColorV = texture(texColor, vyUv.xy);
    vec4 texNormalV = texture(texNormals, vyUv.xy);
    vec4 texWorldPosV = texture(texPos, vyUv.xy);
    vec4 finalColor;

    vec3 ld = normalize(lightPos);
    vec3 normal = texNormalV.xyz;
    vec3 ln = texColorV.xyz;

    if(length(normal) == 0.0) {
        outComposite = lightColor.w * vec3(0.52, 0.73, 0.95);
        outMaterialColor = vec3(0);
    } else {
        int material = int(texColorV.w);
        int matId = material & 0x1F;
        int matParam = material >> 5;
        float matParamF = float(matParam) / 7.0;

        // 0) material coords. 1) cubic to spherical
        int uvMapStyle = matId == 0 ? 1 : 0;  
        vec2 uv = vec2(texNormalV.w, texWorldPosV.w);

        float texScale = matId == 0 ? 2.5 : 1.0;

        int texLayers[9] = int[](2, 3, 0, 0, 0, 0, 4, 0, 1);
        int texLayer = texLayers[matId];

        vec3 defC = vec3(1);
        vec3 colors[9] = vec3[](defC, defC, vec3(1, 0, 0), vec3(0.1), vec3(0.0, 0.4, 0.0) + matParamF * 0.5, vec3(0.5, 0.25, 0), defC, vec3(0.6), defC);
        vec3 color = colors[matId];

        if(uvMapStyle == 0) {
            finalColor = procTex(texScale * uv, texLayer);
        } else if (uvMapStyle == 1) {
            vec4 x = procTex(texScale * ln.zy / ln.x, texLayer);
            vec4 y = procTex(texScale * ln.xz / ln.y, texLayer);
            vec4 z = procTex(texScale * ln.xy / ln.z, texLayer);
        
            //select face
            vec3 p = abs(ln);
            if (p.x > p.y && p.x > p.z) finalColor = x;
            else if (p.y > p.x && p.y > p.z) finalColor = y;
            else finalColor = z;
        }

        finalColor.xyz *= color;

        // TRIPLANAR
        // float scale = 0.15;
        // 	vec4 x = texture(texArray, vec3(scale*(ln.yz),2));
        // 	vec4 y = texture(texArray, vec3(scale*(ln.zx),2));
        // 	vec4 z = texture(texArray, vec3(scale*(ln.xy),2));    
            // vec3 p = normalize(max(vec3(0),abs(ln)-.4));
            // color = x*p.x + y*p.y + z*p.z;

        vec3 posInWorld = texWorldPosV.xyz;

        vec3 mainLight = lightColor.xyz * max(0.0, dot(ld, normal));
        vec4 posInLight = lightProjMatrix * lightViewMatrix * vec4(posInWorld, 1);
        posInLight /= posInLight.w;

        // Fit into 0..1
        posInLight = 0.5 + 0.5 * posInLight;

        // float lightDepth = texture(shadowDepth, posInLight.xy).x;
        
        float bias = 0.002;//0.005;//max(0.01 * (1.0 - dot(normal, ld)), 0.005);  

        float shadow = 0.0;
        vec2 texelSize = 1.0 / vec2(textureSize(shadowDepth, 0));
        for(int x = -1; 1>=x; ++x)
        {
            for(int y = -1; 1 >= y; ++y)
            {
                float pcfDepth = texture(shadowDepth, posInLight.xy + vec2(x, y) * texelSize).x; 
                shadow += (posInLight.z - bias > pcfDepth) ? 1.0 : 0.0;        
            }    
        }

        shadow /= 9.0;

        outMaterialColor = finalColor.xyz;
        outComposite =  finalColor.xyz * max(mainLight * (1.0 - shadow), lightShadowColor * (1.0 + 0.2 * max(0.0, dot(normal, normalize(-posInWorld)))));
    }
}