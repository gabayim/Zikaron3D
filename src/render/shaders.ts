import { Skia } from '@shopify/react-native-skia';

/** Soft animated god-rays radiating from a light source (premultiplied output, use with screen blend). */
export const lightRays = Skia.RuntimeEffect.Make(`
uniform float2 res;
uniform float2 origin;
uniform float time;
uniform float strength;

half4 main(float2 p) {
  float2 d = p - origin;
  float ang = atan(d.y, d.x);
  float dist = length(d) / res.y;
  float rays = 0.5 + 0.5 * sin(ang * 23.0 + time * 0.35) * sin(ang * 9.0 - time * 0.22 + 1.7);
  rays = pow(rays, 2.2);
  float fall = smoothstep(1.15, 0.0, dist) * smoothstep(0.0, 0.08, dist);
  float a = rays * fall * strength;
  half3 tint = mix(half3(1.0, 0.86, 0.96), half3(1.0, 0.95, 0.8), half(0.5 + 0.5 * sin(time * 0.2)));
  return half4(tint * a, a);
}
`)!;

/** Drifting volumetric mist band plus twinkling stars in the upper sky. */
export const skyAtmosphere = Skia.RuntimeEffect.Make(`
uniform float2 res;
uniform float time;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1, 0)), u.x), mix(hash(i + float2(0, 1)), hash(i + float2(1, 1)), u.x), u.y);
}
float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

half4 main(float2 p) {
  float2 uv = p / res;
  float2 q = float2(uv.x * 2.2, uv.y * 5.0);
  float m = fbm(q + float2(time * 0.035, 0.0)) * 0.6 + fbm(q * 1.7 - float2(time * 0.05, time * 0.01)) * 0.4;
  float band = smoothstep(0.32, 0.5, uv.y) * smoothstep(0.78, 0.58, uv.y);
  float mist = smoothstep(0.42, 0.85, m) * band * 0.55;

  float2 cell = floor(p / 9.0);
  float h = hash(cell);
  float star = step(0.985, h) * smoothstep(0.42, 0.05, uv.y);
  float tw = pow(0.5 + 0.5 * sin(time * (1.5 + h * 4.0) + h * 40.0), 6.0);
  float s = star * tw * smoothstep(2.2, 0.0, length(fract(p / 9.0) * 9.0 - 4.5));

  half3 col = half3(0.86, 0.78, 1.0) * mist + half3(1.0, 0.95, 0.85) * s;
  float a = max(mist, s);
  return half4(col, a);
}
`)!;

/** Warm radial stage glow with a slow breathing pulse. */
export const stageGlow = Skia.RuntimeEffect.Make(`
uniform float2 center;
uniform float2 radius;
uniform float time;
uniform float boost;

half4 main(float2 p) {
  float2 q = (p - center) / radius;
  float d = length(q);
  float a = smoothstep(1.0, 0.0, d);
  a = a * a * (0.42 + 0.06 * sin(time * 1.4)) * (1.0 + boost);
  half3 c = mix(half3(1.0, 0.72, 0.95), half3(1.0, 0.9, 0.7), half(smoothstep(0.0, 0.7, d)));
  return half4(c * a, a);
}
`)!;
