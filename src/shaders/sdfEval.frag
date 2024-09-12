out vec2 outFragment;

in vec4 point;

vec2 rr(vec2 p, float a) {
    return mat2(cos(a), sin(a), -sin(a), cos(a)) * p;
}

float box(vec4 p, vec4 b)
{
  vec3 q = abs(p.xyz) - b.xyz;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

//[$//]

void main() {
    outFragment = _s(point);
}