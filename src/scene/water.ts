import {
  BufferAttribute, BufferGeometry, ClampToEdgeWrapping, DataTexture, FloatType, LinearFilter, Mesh,
  RedFormat, RepeatWrapping, ShaderMaterial, Vector3, Vector4,
} from 'three';
import type { Palette } from './palettes';
import { NOISE_GLSL } from './glsl';

const SHORE_SAMPLES = 256;

/** Radial grid: dense near the centre (where the camera looks), sparse towards the horizon. */
function radialGrid(rings: number, segs: number, r0: number, r1: number): BufferGeometry {
  const pos: number[] = [0, 0, 0];
  for (let i = 1; i <= rings; i++) {
    const t = i / rings;
    const r = r0 * (Math.pow(r1 / r0, t) - 1) + t * 2;
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segs, a1 = 1 + i * segs;
    for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % segs;
      idx.push(a0 + j, a0 + j1, a1 + j, a0 + j1, a1 + j1, a1 + j);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

export class Water {
  mesh: Mesh;
  material: ShaderMaterial;
  private shore: DataTexture;
  private shoreData = new Float32Array(SHORE_SAMPLES * 2);

  constructor() {
    this.shore = new DataTexture(this.shoreData, SHORE_SAMPLES, 2, RedFormat, FloatType);
    this.shore.wrapS = RepeatWrapping;
    this.shore.wrapT = ClampToEdgeWrapping;
    this.shore.magFilter = LinearFilter;
    this.shore.minFilter = LinearFilter;
    this.shore.needsUpdate = true;

    this.material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new Vector3() },
        uShallow: { value: new Vector3() },
        uSkyTop: { value: new Vector3() },
        uSkyHorizon: { value: new Vector3() },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uGlint: { value: new Vector3(1, 1, 1) },
        uFogColor: { value: new Vector3() },
        uFogRange: { value: new Vector3(110, 650, 0) },
        uNight: { value: 0 },
        uShore: { value: this.shore },
        uIslandA: { value: new Vector4(0, 0, 0, 0) },
        uIslandB: { value: new Vector4(0, 0, 0, 0) },
        uBoat: { value: new Vector4(0, 0, 0, 0) },
        uLights: { value: new Vector4(0, 0, 0, 0) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorld;
        varying vec3 vNormalW;
        vec3 wave(vec2 p, vec2 dir, float amp, float len, float speed, inout vec3 n) {
          float k = 6.2831 / len;
          float f = k * (dot(dir, p) - speed * uTime);
          n.x -= dir.x * k * amp * cos(f);
          n.z -= dir.y * k * amp * cos(f);
          return vec3(0.0, amp * sin(f), 0.0);
        }
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vec3 n = vec3(0.0, 1.0, 0.0);
          float fade = 1.0 - smoothstep(60.0, 160.0, length(w.xz - cameraPosition.xz));
          vec3 d = vec3(0.0);
          d += wave(w.xz, normalize(vec2(1.0, 0.35)), 0.10, 9.0, 1.3, n);
          d += wave(w.xz, normalize(vec2(-0.4, 1.0)), 0.07, 6.0, 1.1, n);
          d += wave(w.xz, normalize(vec2(0.7, -0.8)), 0.04, 3.5, 0.9, n);
          w.xyz += d * fade;
          vWorld = w.xyz;
          vNormalW = normalize(mix(vec3(0.0, 1.0, 0.0), n, fade));
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uNight;
        uniform vec3 uDeep, uShallow, uSkyTop, uSkyHorizon, uSunDir, uGlint, uFogColor, uFogRange;
        uniform sampler2D uShore;
        uniform vec4 uIslandA, uIslandB, uBoat, uLights;
        varying vec3 vWorld;
        varying vec3 vNormalW;
        ${NOISE_GLSL}
        float shoreDist(vec4 isl, float row) {
          if (isl.w < 0.5) return 99.0;
          vec2 d = vWorld.xz - isl.xy;
          float a = atan(d.y, d.x) / 6.28318 + 0.5;
          float r = texture2D(uShore, vec2(a, row)).r;
          return length(d) / max(r, 0.001);
        }
        void main() {
          vec3 V = normalize(cameraPosition - vWorld);
          float t = uTime;
          // small ripples from two scrolling noise layers
          vec2 p = vWorld.xz;
          float e = 0.15;
          float n0 = fbm(p * 0.55 + vec2(t * 0.12, t * 0.05)) + fbm(p * 0.9 - vec2(t * 0.07, t * 0.11));
          float nx = fbm((p + vec2(e, 0.0)) * 0.55 + vec2(t * 0.12, t * 0.05)) + fbm((p + vec2(e, 0.0)) * 0.9 - vec2(t * 0.07, t * 0.11));
          float nz = fbm((p + vec2(0.0, e)) * 0.55 + vec2(t * 0.12, t * 0.05)) + fbm((p + vec2(0.0, e)) * 0.9 - vec2(t * 0.07, t * 0.11));
          float dist = length(cameraPosition - vWorld);
          float rippleFade = 1.0 - smoothstep(25.0, 100.0, dist);
          vec3 N = normalize(vNormalW + vec3((n0 - nx) / e, 0.0, (n0 - nz) / e) * 0.07 * rippleFade);

          float da = shoreDist(uIslandA, 0.25);
          float db = shoreDist(uIslandB, 0.75);
          float nd = min(da, db);
          float shallow = 1.0 - smoothstep(1.0, 1.6, nd);
          vec3 water = mix(uDeep, uShallow, shallow * 0.95);
          // caustic-like sparkle in the shallows
          float caus = pow(vnoise(p * 2.2 + vec2(t * 0.4, -t * 0.3)) * vnoise(p * 2.7 - vec2(t * 0.35, t * 0.2)), 2.0);
          water += caus * shallow * 0.35 * (1.0 - uNight * 0.6);

          float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 R = reflect(-V, N);
          vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.6, R.y));
          vec3 col = mix(water, sky, clamp(fres * 0.85, 0.0, 1.0));
          // light from the sun / moon on the waves
          float diff = max(dot(N, uSunDir), 0.0);
          col *= 0.82 + 0.25 * diff;
          float spec = pow(max(dot(R, uSunDir), 0.0), 520.0) * 1.4;
          float glint = pow(max(dot(R, uSunDir), 0.0), 900.0) * step(0.55, vnoise(p * 6.0 + t * 1.5)) * 10.0;
          col += uGlint * (spec + glint) * mix(1.0, 0.3, uNight);

          // shore foam: a band that breathes with the waves
          float wobble = fbm(p * 1.4 + t * 0.25);
          float band = smoothstep(1.13 + 0.03 * sin(t * 1.1), 1.0, nd + wobble * 0.05);
          float lines = smoothstep(0.55, 0.9, sin((nd * 26.0) - t * 1.6 + wobble * 6.0) * 0.5 + 0.5) * (1.0 - smoothstep(1.0, 1.22, nd));
          float foam = clamp(band * 0.9 + lines * 0.35, 0.0, 1.0) * smoothstep(0.35, 0.6, wobble + 0.25);
          // boat wake
          if (uBoat.w > 0.0) {
            vec2 bd = vWorld.xz - uBoat.xy;
            float br = length(bd);
            foam += uBoat.w * smoothstep(2.4, 1.2, br) * smoothstep(0.4, 0.75, fbm(p * 3.0 - t * 1.2));
          }
          col = mix(col, vec3(1.0) * mix(1.0, 0.7, uNight), clamp(foam, 0.0, 1.0) * 0.85);
          // warm light reflections at night (lighthouse, windows)
          if (uLights.w > 0.0) {
            vec2 ld = vWorld.xz - uLights.xy;
            float lr = length(ld);
            float streak = exp(-lr * 0.12) * (0.6 + 0.4 * vnoise(p * 3.0 + t));
            col += vec3(1.0, 0.75, 0.4) * streak * uLights.w * 0.25;
          }
          float fogF = smoothstep(uFogRange.x, uFogRange.y, dist);
          col = mix(col, uFogColor, fogF);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new Mesh(radialGrid(90, 160, 1.2, 700), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = false;
  }

  /** slot 0/1: island centre and its shoreline radius function */
  setIsland(slot: 0 | 1, x: number, z: number, shore: ((angle: number) => number) | null) {
    const u = slot === 0 ? this.material.uniforms.uIslandA : this.material.uniforms.uIslandB;
    if (!shore) { u.value.set(0, 0, 0, 0); return; }
    u.value.set(x, z, 0, 1);
    for (let i = 0; i < SHORE_SAMPLES; i++) {
      const a = (i / SHORE_SAMPLES - 0.5) * Math.PI * 2;
      this.shoreData[slot * SHORE_SAMPLES + i] = shore(a);
    }
    this.shore.needsUpdate = true;
  }

  apply(p: Palette) {
    const u = this.material.uniforms;
    const v = (c: { r: number; g: number; b: number }) => new Vector3(c.r, c.g, c.b);
    u.uDeep.value = v(p.waterDeep);
    u.uShallow.value = v(p.waterShallow);
    u.uSkyTop.value = v(p.skyTop);
    u.uSkyHorizon.value = v(p.skyHorizon);
    u.uSunDir.value.copy(p.sunDir);
    u.uGlint.value = v(p.glint);
    u.uFogColor.value = v(p.skyHorizon);
    u.uNight.value = p.night;
  }
}
