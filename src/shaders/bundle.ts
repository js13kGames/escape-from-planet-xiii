// Generated with Shader Minifier 1.4.0 (https://github.com/laurentlb/Shader_Minifier/)
export const var_INMATERIAL = "i"
export const var_INNORMAL = "m"
export const var_INPOS = "v"
export const var_INUV = "t"
export const var_LIGHTACOSANDNORMAL = "N"
export const var_LIGHTCOLOR = "_"
export const var_LIGHTPOS = "b"
export const var_LIGHTPROJMATRIX = "E"
export const var_LIGHTRADIUSANDCOLOR = "O"
export const var_LIGHTSHADOWCOLOR = "B"
export const var_LIGHTVIEWMATRIX = "C"
export const var_MATERIALCOLOR = "M"
export const var_MODELMATRIX = "l"
export const var_OUTCOLOR = "I"
export const var_OUTCOMPOSITE = "e"
export const var_OUTFRAGMENT = "G"
export const var_OUTMATERIALCOLOR = "g"
export const var_OUTNORMAL = "J"
export const var_OUTWORLDPOS = "K"
export const var_POINT = "y"
export const var_PROJECTIONMATRIX = "z"
export const var_SETTINGS = "H"
export const var_SHADOWDEPTH = "D"
export const var_TEXARRAY = "L"
export const var_TEXCOLOR = "c"
export const var_TEXNORMALS = "w"
export const var_TEXPOS = "A"
export const var_VIEWMATRIX = "x"
export const var_VYFULLSCREENUV = "r"
export const var_VYLOCALNORMAL = "d"
export const var_VYLOCALPOS = "s"
export const var_VYMATERIAL = "n"
export const var_VYMESHORIGIN = "h"
export const var_VYNORMAL = "u"
export const var_VYRADIUS = "a"
export const var_VYUV = "o"
export const var_VYWORLDPOS = "f"

export const mesh_vert = `layout(location=0) in vec3 v;layout(location=1) in vec3 m;layout(location=2) in float i;layout(location=3) in vec2 t;uniform mat4 x,z,l;flat out float n;out vec2 o;out vec3 u;out vec4 f;out vec3 s,d;out vec2 r;out vec3 h;void main(){s=v;f=l*vec4(v,1);h=(l*vec4(0,0,0,1)).xyz;vec4 a=z*x*f;gl_Position=a;r=(vec2(a/a.w)+1.)/2.;d=m;u=transpose(inverse(mat3(l)))*m;n=i;o=t;}`

export const screen_vert = `in vec2 v;out vec2 o;uniform mat4 x,z;void main(){o=vec2(v.xy*.5+.5);gl_Position=vec4(v,0,1);}`

export const sdfEval_vert = `in vec2 v;out vec4 y;uniform vec2 a;void main(){gl_Position=vec4(v,0,1);y=vec4(vec3(v,a.y)*a.x,0);}`

export const defrMainLight_frag = `layout(location=0) out vec3 e;layout(location=1) out vec3 g;uniform highp sampler2D c,w,A,D;uniform vec3 b;uniform vec4 _;uniform vec3 B;uniform mat4 C,E;in vec2 o;float p(float v){return(1.+sin(v))*.5;}float F(vec2 v){v=step(.5,fract(v));return mod(v.x+v.y,2.);}vec4 F(vec2 v,int n){if(n==1)return vec4(F(v));if(n==2){vec3 n=mix(vec3(.18,.56,.15),vec3(.42,.65,.07),p(v.x*120.)),d=mix(vec3(.18,.56,.15),vec3(.42,.65,.07),p(v.y*120.));n=mix(n,d,F(v));return vec4(n,1);}if(n==3){v.x=abs(v.x*2.-1.);float n=min(smoothstep(.75,.76,v.x),smoothstep(.86,.85,v.x));return vec4(mix(vec3(.4),vec3(.97,.71,0),n),1);}if(n==4){vec2 n=vec2(cos(v.x*6.28318),sin(v.x*6.28318));return(1.+vec4(n.x,dot(n,normalize(vec2(-1,1))),dot(n,normalize(vec2(-1))),1))/2.;}return vec4(1);}void main(){vec2 v=vec2(textureSize(c,0));vec4 n=texture(c,o.xy),d=texture(w,o.xy),l=texture(A,o.xy),i;vec3 m=normalize(b);if(length(d.xyz)==0.)e=_.w*vec3(.52,.73,.95),g=vec3(0);else{int v=int(n.w),t=v&31,c=t==0?1:0;vec2 o=vec2(d.w,l.w);float u=t==0?2.5:1.;int s[9]=int[](2,3,0,0,0,0,4,0,1),y=s[t];vec3 a[9]=vec3[](vec3(1),vec3(1),vec3(1,0,0),vec3(.1),vec3(0,.4,0)+float(v>>5)/7.*.5,vec3(.5,.25,0),vec3(1),vec3(.6),vec3(1));if(c==0)i=F(u*o,y);else if(c==1){vec3 v=abs(n.xyz);i=v.x>v.y&&v.x>v.z?F(u*n.xyz.zy/n.xyz.x,y):v.y>v.x&&v.y>v.z?F(u*n.xyz.xz/n.xyz.y,y):F(u*n.xyz.xy/n.xyz.z,y);}i.xyz*=a[t];vec4 f=E*C*vec4(l.xyz,1);f=.5+.5*(f/f.w);u=0.;o=1./vec2(textureSize(D,0));for(int v=-1;1>=v;++v)for(int n=-1;1>=n;++n){float m=texture(D,f.xy+vec2(v,n)*o).x;u+=f.z-.002>m?1.:0.;}u/=9.;g=i.xyz;e=i.xyz*max(_.xyz*max(0.,dot(m,d.xyz))*(1.-u),B*(1.+.2*max(0.,dot(d.xyz,normalize(-l.xyz)))));}}`

export const final_frag = `out vec3 G;uniform highp sampler2D c;in vec2 o;uniform vec2 H;void main(){vec3 v=texture(c,o.xy).xyz;G=mix(v,mat3(.39,.35,.27,.77,.69,.53,.19,.17,.13)*v,H.x);}`

export const light_frag = ``

export const mesh_frag = `layout(location=0) out vec4 I;layout(location=1) out vec4 J;layout(location=2) out vec4 K;flat in float n;in vec2 o;in vec3 u;in vec4 f;in vec3 s,d;uniform highp sampler2DArray L;void main(){vec2 v=o;if(n==8.)v=s.xz*35.;I=vec4(normalize(d),n);J=vec4(normalize(u),v.x);K=vec4(f.xyz,v.y);}`

export const nothing_frag = `void main(){}`

export const pointLight_frag = `out vec3 G;uniform highp sampler2D w,A,M;in vec2 r;in vec3 h;uniform vec4 N,O;void main(){vec3 v=texture(A,r).xyz-h;float n=length(v);v/=n;n=3.*min(1.,1./pow(n/(O.x*sqrt(.01)),2.))*smoothstep(N.x-.05,N.x,dot(N.yzw,v))*max(0.,dot(texture(w,r).xyz,-v));G=texture(M,r).xyz*O.yzw*n;}`

export const sdfEval_frag = `out vec2 G;in vec4 y;vec2 rr(vec2 v,float n){return mat2(cos(n),sin(n),-sin(n),cos(n))*v;}float box(vec4 v,vec4 n){vec3 m=abs(v.xyz)-n.xyz;return length(max(m,0.))+min(max(m.x,max(m.y,m.z)),0.);}$void main(){G=_s(y);}`

export const texBuilder_frag = ``

