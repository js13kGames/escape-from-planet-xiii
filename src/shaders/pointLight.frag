out vec3 outFragment;

uniform highp sampler2D texNormals;
uniform highp sampler2D texPos;
uniform highp sampler2D materialColor;

in vec2 vyFullscreenUv;
in vec3 vyMeshOrigin;

uniform vec4 lightACosAndNormal;
uniform vec4 lightRadiusAndColor;

void main()
{   
    vec3 pos = texture(texPos, vyFullscreenUv).xyz;
    vec3 normal = texture(texNormals,vyFullscreenUv).xyz;
    vec3 lightDir = pos - vyMeshOrigin;
    float lightDistance = length(lightDir);
    lightDir /= lightDistance;
    float lightAcosAngle = lightACosAndNormal.x;
    float inCone = smoothstep(lightAcosAngle - 0.05, lightAcosAngle, dot(lightACosAndNormal.yzw, lightDir));
    float power = 3.0 * min(1.0, 1.0 / pow(lightDistance / (lightRadiusAndColor.x * sqrt(0.01)), 2.0));
    float intensity = power * inCone * max(0.0, dot(normal, -lightDir));
    outFragment = texture(materialColor, vyFullscreenUv).xyz * lightRadiusAndColor.yzw * intensity;
}
