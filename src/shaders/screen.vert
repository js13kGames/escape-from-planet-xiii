in vec2 inPos;

out vec2 vyUv;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

void main()
{
	vyUv = vec2(inPos.xy * 0.5 + 0.5);
	gl_Position = vec4(inPos, 0.0, 1.0);

	mat4 m = projectionMatrix * viewMatrix;
}
