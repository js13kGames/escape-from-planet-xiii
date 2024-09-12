in vec2 inPos;

out vec4 point;

uniform vec2 vyRadius;

void main() {
    gl_Position = vec4(inPos, 0, 1);
    point = vec4(vec3(inPos, vyRadius.y) * vyRadius.x, 0);
}