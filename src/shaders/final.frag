
out vec3 outFragment;

uniform highp sampler2D texColor;

in vec2 vyUv;

//.x: sepia, 
uniform vec2 settings;

void main()
{   
    vec3 bufferColor = texture(texColor, vyUv.xy).xyz; 
    vec3 sepiaMatrix= mat3(0.39, 0.35, 0.27, 0.77, 0.69, 0.53, 0.19, 0.17, 0.13);
    vec3 sepiaColor = sepiaMatrix * bufferColor;
    outFragment = mix(bufferColor, sepiaColor, settings.x);
}
