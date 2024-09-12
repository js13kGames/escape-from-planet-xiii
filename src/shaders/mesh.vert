layout(location = 0) in vec3 inPos;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in float inMaterial;
layout(location = 3) in vec2 inUv;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;

flat out float vyMaterial;
out vec2 vyUv;
out vec3 vyNormal;
out vec4 vyWorldPos;
out vec3 vyLocalPos;
out vec3 vyLocalNormal;
out vec2 vyFullscreenUv;
out vec3 vyMeshOrigin;

void main()
{
	vyLocalPos = inPos;
	vyWorldPos = modelMatrix * vec4(inPos, 1);
	vyMeshOrigin =  (modelMatrix * vec4(0,0,0,1)).xyz; 
	vec4 ndcPos = projectionMatrix * viewMatrix * vyWorldPos;
	gl_Position = ndcPos;
	vyFullscreenUv = (vec2(ndcPos / ndcPos.w) + 1.0) / 2.0;
	vyLocalNormal = inNormal;
	vyNormal = transpose(inverse(mat3(modelMatrix))) * inNormal;  
	vyMaterial = inMaterial;
	vyUv = inUv;
}
