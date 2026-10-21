// Giger-style biomechanical corridor: a fly-through of a ribbed, vertebrate tunnel.
// Recursive rib levels + gyroid pitting (both driven by u_fold) give the fractal detail.
export const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;     // accumulated drag: x = yaw, y = pitch
uniform float u_time;
uniform float u_zoom;     // 3.2 default; smaller = tighter field of view
uniform float u_travel;   // distance flown down the tunnel
uniform float u_fold;     // fractal depth 0..4
uniform float u_tint;     // 0..1 palette: grey-green -> sepia -> cold blue
uniform vec4 u_shape;     // x tunnel radius, y rib period, z spine scale, w cable count
uniform vec4 u_form;      // x rib thickness, y cable thickness, z twist per unit, w breathing
uniform vec4 u_look;      // x surface detail, y fog density, z lamp intensity, w pulse glow
uniform vec4 u_extra;     // x spine curve, y spine height (0 floor .. 1 centre), z cable weave
uniform float u_hue;      // pulse colour hue 0..1

#define PI 3.14159265
#define MAX_STEPS 90
#define SURF_DIST 0.0015
#define MAX_DIST 30.0

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// Rings of bone around the tunnel; each level halves period and thickness.
float ribs(vec3 p, float R, float P) {
  float r = length(p.xy);
  float ang = atan(p.y, p.x);
  float d = 1e5;
  float per = P;
  float amp = 1.0;
  for (int i = 0; i < 3; i++) {
    if (float(i) > u_fold) break;
    float dz = (i == 0) ? mod(p.z + per * 0.5, per) - per * 0.5
                        : mod(p.z, per) - per * 0.5;
    float tube = (0.16 + 0.04 * cos(ang * 2.0)) * amp * u_form.x;
    d = smin(d, length(vec2(r - R, dz * 0.8)) - tube, 0.07 * amp);
    per *= 0.5;
    amp *= 0.55;
  }
  return d;
}

// Vertebral column along the tunnel floor: bulging bodies, transverse and spinous processes.
float spine(vec3 p, float R, float P, float s) {
  // centreline is a sinusoidal spline so the column snakes through the corridor
  vec3 q = p - vec3(sin(p.z * 0.45) * u_extra.x, -R * mix(0.8, 0.0, u_extra.y) + cos(p.z * 0.3) * u_extra.x * 0.35, 0.0);
  float dz = mod(q.z + P * 0.5, P) - P * 0.5;
  float c = cos(dz / P * PI);
  float body = length(q.xy * vec2(1.0, 1.15)) - (0.14 + 0.13 * c * c * c) * s;
  vec3 l = vec3(abs(q.x), q.y, dz);
  float arm = sdCapsule(l, vec3(0.1 * s, 0.05 * s, 0.0), vec3(0.55 * s, 0.32 * s, 0.0), 0.04 * s);
  float spinous = sdCapsule(l, vec3(0.0, 0.1 * s, 0.0), vec3(0.0, 0.5 * s, -0.12 * s), 0.035 * s);
  return smin(smin(body, arm, 0.06), spinous, 0.05);
}

// Segmented hoses running the length of the tunnel, repeated around the wall.
float cables(vec3 p, float R, float n) {
  float r = length(p.xy);
  float sec = 2.0 * PI / n;
  float a0 = atan(p.y, p.x) + sec * 0.5;
  float side = mod(floor(a0 / sec), 2.0) * 2.0 - 1.0;
  a0 += side * sin(p.z * 1.1) * u_extra.z * sec * 0.45;   // neighbouring hoses weave in opposite directions
  float aa = mod(a0, sec) - sec * 0.5;
  vec2 cp = vec2(cos(aa), sin(aa)) * r;
  return length(vec2(cp.x - (R - 0.22), cp.y)) - (0.05 + 0.012 * sin(p.z * 38.0)) * u_form.y;
}

// Gyroid-based pitting; each octave rotates and doubles frequency.
float detail(vec3 p) {
  float a = 0.5, d = 0.0;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= u_fold) break;
    float g = sin(p.x) * cos(p.y) + sin(p.y) * cos(p.z) + sin(p.z) * cos(p.x);
    d += a * abs(g);
    p.xy = rot(0.7) * p.xy;
    p = p.yzx * 2.03 + 1.3;
    a *= 0.5;
  }
  return d;
}

// returns (distance, material id): 0 wall, 1 rib, 2 spine, 3 cable
vec2 map(vec3 p) {
  p.xy = rot((p.z - u_travel) * u_form.z) * p.xy;      // spiral the corridor around the camera
  float R = u_shape.x * (1.0 + u_form.w * sin(p.z * 0.9 + u_time * 0.4));
  float P = u_shape.y;
  float wall = (R + 0.22) - length(p.xy);
  float rb = ribs(p, R, P);
  float sp = u_shape.z > 0.01 ? spine(p, R, P, u_shape.z) : 1e5;
  float cb = cables(p, R, u_shape.w);

  float bone = smin(wall, rb, 0.12);
  bone = smin(bone, sp, 0.1);
  float id = 0.0;
  if (rb < wall) id = 1.0;
  if (sp < min(wall, rb)) id = 2.0;
  float d = bone;
  if (d < 0.3) d -= 0.03 * u_look.x * detail(p * 5.0);
  if (cb < d) { d = cb; id = 3.0; }
  return vec2(d * 0.8, id);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.0015;
  return normalize(
    e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x +
    e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 4; i++) {
    float h = 0.02 + 0.13 * float(i);
    occ += (h - map(p + n * h).x) * sca;
    sca *= 0.75;
  }
  return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

vec3 palette(float t) {
  vec3 a = vec3(0.40, 0.48, 0.40);
  vec3 b = vec3(0.56, 0.45, 0.33);
  vec3 c = vec3(0.32, 0.44, 0.58);
  return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  vec3 ro = vec3(sin(u_time * 0.3) * 0.08, u_shape.x * 0.03 + sin(u_time * 0.5) * 0.04, u_travel);
  float focal = 1.15 * 3.2 / u_zoom;
  vec3 rd = normalize(vec3(uv, focal));
  rd.yz = rot(-clamp(u_mouse.y * 1.2, -1.1, 1.1)) * rd.yz;
  rd.xz = rot(u_mouse.x * PI) * rd.xz;

  vec3 tint = palette(u_tint);
  vec3 fogCol = tint * 0.10;
  float glow = pow(max(rd.z, 0.0), 6.0);

  float d = 0.0;
  float id = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec2 res = map(ro + rd * d);
    id = res.y;
    if (res.x < SURF_DIST || d > MAX_DIST) break;
    d += res.x;
  }

  vec3 col = fogCol + tint * glow * 0.35;

  if (d < MAX_DIST) {
    vec3 p = ro + rd * d;
    vec3 n = calcNormal(p);
    float ao = calcAO(p, n);

    vec3 base; float shine; float metal = 0.0;
    if (id < 0.5)      { base = tint * 0.35;               shine = 12.0; }
    else if (id < 1.5) { base = tint * 0.9 + 0.12;         shine = 24.0; }
    else if (id < 2.5) { base = tint * 0.8 + 0.25;         shine = 40.0; }
    else               { base = vec3(0.05, 0.055, 0.06);   shine = 90.0; metal = 1.0; }

    // headlamp riding just above the camera
    vec3 lp = ro + vec3(0.0, 0.35, -0.3);
    vec3 ld = lp - p;
    float dist = length(ld);
    ld /= dist;
    float atten = 1.0 / (1.0 + 0.35 * dist * dist);
    float diff = max(dot(n, ld), 0.0);
    float spec = pow(max(dot(reflect(-ld, n), -rd), 0.0), shine);

    // distant glow at the end of the tunnel lights the ribs from behind
    vec3 farDir = normalize(vec3(0.0, 0.15, 1.0));
    float back = max(dot(n, farDir), 0.0);

    vec3 refl = reflect(rd, n);
    float fres = pow(1.0 + dot(rd, n), 3.0);
    vec3 env = tint * (0.05 + 0.9 * pow(max(refl.z, 0.0), 3.0) + 0.3 * max(refl.y, 0.0));

    col = base * (diff * atten * 1.6 * u_look.z + back * 0.22 + 0.04) * ao;
    col += vec3(1.0, 0.97, 0.9) * spec * atten * (0.5 + metal);
    col += env * (0.15 + 0.6 * metal) * (0.25 + fres) * ao;

    // bioluminescent pulses travelling along the hoses
    if (id > 2.5) {
      float pulse = smoothstep(0.82, 1.0, sin(p.z * 5.0 - u_time * 3.0));
      vec3 hue = 0.5 + 0.5 * cos(6.2831853 * (u_hue + vec3(0.0, 0.33, 0.67)));
      col += hue * pulse * u_look.w;
    }

    float fog = 1.0 - exp(-d * u_look.y);
    col = mix(col, fogCol + tint * glow * 0.35, fog);
  }

  col *= 1.0 - dot(uv, uv) * 0.55;
  col = col / (1.0 + col);
  col = pow(col, vec3(0.85));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
