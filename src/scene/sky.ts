import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { Palette } from './palettes';
import { NOISE_GLSL } from './glsl';

/** Gradient sky dome with sun/moon disc, soft clouds, twinkling stars and an aurora at night. */
export class Sky {
  mesh: Mesh;
  material: ShaderMaterial;

  constructor() {
    this.material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new Vector3() },
        uHorizon: { value: new Vector3() },
        uBottom: { value: new Vector3() },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunColor: { value: new Vector3(1, 1, 1) },
        uStars: { value: 0 },
        uNight: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * p;
          gl_Position.z = gl_Position.w; // always at the far plane
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor;
        uniform float uStars, uNight, uTime;
        varying vec3 vDir;
        ${NOISE_GLSL}
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.45, h), 0.65)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.2, h));
          float sd = max(dot(d, normalize(uSunDir)), 0.0);
          // sun (day) or moon (night)
          float disc = smoothstep(mix(0.9993, 0.9990, uNight), mix(0.9997, 0.9995, uNight), sd);
          col += uSunColor * (pow(sd, 260.0) * 0.55 + pow(sd, 12.0) * mix(0.28, 0.12, uNight));
          col = mix(col, mix(vec3(1.0, 0.98, 0.9), vec3(0.92, 0.95, 1.0), uNight), disc);
          // soft clouds
          vec2 cuv = d.xz / max(h + 0.12, 0.05) * 0.9 + vec2(uTime * 0.006, 0.0);
          float cl = smoothstep(0.5, 0.8, fbm(cuv)) * smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.55, 0.9, h));
          vec3 cloudCol = mix(vec3(1.0), uHorizon * 1.15, 0.35) * mix(1.0, 0.35, uNight);
          col = mix(col, cloudCol, cl * mix(0.75, 0.35, uNight));
          // stars
          if (uStars > 0.0 && h > 0.0) {
            vec2 sp = d.xz / (h + 0.6) * 140.0;
            vec2 cell = floor(sp);
            float r = hash12(cell);
            vec2 off = vec2(hash12(cell + 7.1), hash12(cell + 3.7)) - 0.5;
            float dist = length(fract(sp) - 0.5 - off * 0.6);
            float tw = 0.6 + 0.4 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
            float star = step(0.94, r) * smoothstep(0.12, 0.0, dist) * tw;
            col += vec3(star) * uStars * smoothstep(0.0, 0.25, h) * (1.0 - cl);
            // aurora ribbons
            float a = sin(d.x * 3.0 + uTime * 0.05 + fbm(d.xz * 3.0 + uTime * 0.02) * 4.0);
            float band = smoothstep(0.65, 1.0, a) * smoothstep(0.1, 0.35, h) * (1.0 - smoothstep(0.45, 0.8, h));
            col += vec3(0.15, 0.85, 0.6) * band * 0.28 * uStars * (0.6 + 0.4 * fbm(vec2(d.x * 8.0, uTime * 0.1)));
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new Mesh(new SphereGeometry(900, 32, 16), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  apply(p: Palette) {
    const u = this.material.uniforms;
    u.uTop.value.set(p.skyTop.r, p.skyTop.g, p.skyTop.b);
    u.uHorizon.value.set(p.skyHorizon.r, p.skyHorizon.g, p.skyHorizon.b);
    u.uBottom.value.set(p.skyBottom.r, p.skyBottom.g, p.skyBottom.b);
    u.uSunDir.value.copy(p.sunDir);
    u.uSunColor.value.set(p.sunColor.r, p.sunColor.g, p.sunColor.b);
    u.uStars.value = p.stars;
    u.uNight.value = p.night;
  }
}
