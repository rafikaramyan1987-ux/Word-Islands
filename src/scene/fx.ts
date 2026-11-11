import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, NormalBlending, Points,
  ShaderMaterial, Vector3,
} from 'three';

function softDot(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  // 4-point star glint
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillRect(30, 4, 4, 56);
  g.fillRect(4, 30, 56, 4);
  return new CanvasTexture(c);
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
  }`;

/** CPU particle pool rendered as one Points object. */
export class Particles {
  points: Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private color: Float32Array;
  private baseSize: Float32Array;
  private next = 0;
  material: ShaderMaterial;

  constructor(private count: number, private gravity = -3, additive = true, private drag = 1.5) {
    const g = new BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count).fill(1);
    this.size = new Float32Array(count);
    this.baseSize = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.color = new Float32Array(count * 3).fill(1);
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1));
    g.setAttribute('aColor', new BufferAttribute(this.color, 3));
    this.material = new ShaderMaterial({
      uniforms: { uMap: { value: softDot() }, uScale: { value: 400 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    this.points = new Points(g, this.material);
    this.points.frustumCulled = false;
  }

  emit(at: Vector3, n: number, opts: { color?: Color; speed?: number; up?: number; size?: number; life?: number; spread?: number } = {}) {
    const col = opts.color ?? new Color(0xfff2a8);
    for (let i = 0; i < n; i++) {
      const k = this.next;
      this.next = (this.next + 1) % this.count;
      const sp = opts.spread ?? 0.3;
      this.pos[k * 3] = at.x + (Math.random() - 0.5) * sp;
      this.pos[k * 3 + 1] = at.y + (Math.random() - 0.5) * sp;
      this.pos[k * 3 + 2] = at.z + (Math.random() - 0.5) * sp;
      const a = Math.random() * Math.PI * 2;
      const s = (opts.speed ?? 3) * (0.4 + Math.random() * 0.6);
      this.vel[k * 3] = Math.cos(a) * s;
      this.vel[k * 3 + 1] = (opts.up ?? 3) * (0.5 + Math.random());
      this.vel[k * 3 + 2] = Math.sin(a) * s;
      this.maxLife[k] = (opts.life ?? 1.2) * (0.6 + Math.random() * 0.6);
      this.life[k] = this.maxLife[k];
      this.baseSize[k] = (opts.size ?? 1) * (0.6 + Math.random() * 0.8);
      const c = col.clone().offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.1);
      this.color[k * 3] = c.r; this.color[k * 3 + 1] = c.g; this.color[k * 3 + 2] = c.b;
    }
  }

  update(dt: number) {
    for (let k = 0; k < this.count; k++) {
      if (this.life[k] <= 0) { this.alpha[k] = 0; continue; }
      this.life[k] -= dt;
      const f = Math.max(0, this.life[k] / this.maxLife[k]);
      this.vel[k * 3 + 1] += this.gravity * dt;
      const d = Math.exp(-this.drag * dt);
      this.vel[k * 3] *= d; this.vel[k * 3 + 1] *= d; this.vel[k * 3 + 2] *= d;
      this.pos[k * 3] += this.vel[k * 3] * dt;
      this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt;
      this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      this.alpha[k] = Math.min(1, f * 2.5) * (f > 0.9 ? (1 - f) * 10 : 1);
      this.size[k] = this.baseSize[k] * (0.6 + 0.4 * f);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
  }
}

export interface DriftStyle {
  colors: number[];
  /** fall speed (negative = rise) */
  fall: number;
  sway: number;
  size: number;
  /** fireflies: hover and blink instead of falling */
  hover?: boolean;
  additive?: boolean;
}

export const DRIFT_STYLES: Record<string, DriftStyle> = {
  snow: { colors: [0xffffff], fall: 1, sway: 0.4, size: 1 },
  petals: { colors: [0xffc0d8, 0xff9cc2, 0xffffff], fall: 0.6, sway: 0.9, size: 0.9 },
  leaves: { colors: [0xf28a2a, 0xe0562a, 0xf2c03a], fall: 0.7, sway: 1.0, size: 1.0 },
  fireflies: { colors: [0xfff27a, 0xc8ff7a], fall: 0, sway: 0.5, size: 0.8, hover: true, additive: true },
  embers: { colors: [0xffa040, 0xff6a20], fall: -0.8, sway: 0.5, size: 0.6, additive: true },
};

/** Ambient particles in a box around a centre: snow, petals, leaves, fireflies or embers. */
export class Snow {
  points: Points;
  private pos: Float32Array;
  private seed: Float32Array;
  material: ShaderMaterial;
  enabled = false;
  private style: DriftStyle = DRIFT_STYLES.snow;
  private alpha0: Float32Array;
  constructor(private n = 700, private box = 34) {
    this.pos = new Float32Array(n * 3);
    this.seed = new Float32Array(n);
    const size = new Float32Array(n);
    const alpha = new Float32Array(n);
    const color = new Float32Array(n * 3).fill(1);
    for (let i = 0; i < n; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * box;
      this.pos[i * 3 + 1] = Math.random() * 16;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * box;
      this.seed[i] = Math.random() * 100;
      size[i] = 0.25 + Math.random() * 0.35;
      alpha[i] = 0.55 + Math.random() * 0.4;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    g.setAttribute('aAlpha', new BufferAttribute(alpha, 1));
    g.setAttribute('aColor', new BufferAttribute(color, 3));
    this.material = new ShaderMaterial({
      uniforms: { uMap: { value: softDot() }, uScale: { value: 400 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.points = new Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.alpha0 = alpha.slice();
  }

  setStyle(name: string | null) {
    this.enabled = !!name;
    if (!name) return;
    const st = DRIFT_STYLES[name];
    if (st === this.style) return;
    this.style = st;
    const g = this.points.geometry;
    const col = g.attributes.aColor.array as Float32Array;
    const size = g.attributes.aSize.array as Float32Array;
    const c = new Color();
    for (let i = 0; i < this.n; i++) {
      c.setHex(st.colors[i % st.colors.length]);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = (0.25 + (this.seed[i] % 1) * 0.35) * st.size * (st.hover ? 1.4 : 1);
    }
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    this.material.blending = st.additive ? AdditiveBlending : NormalBlending;
    this.material.needsUpdate = true;
  }

  update(t: number, dt: number) {
    this.points.visible = this.enabled;
    if (!this.enabled) return;
    const h = this.box / 2;
    const st = this.style;
    const alpha = this.points.geometry.attributes.aAlpha.array as Float32Array;
    const count = st.hover ? Math.floor(this.n * 0.18) : this.n;
    for (let i = 0; i < this.n; i++) {
      const s = this.seed[i];
      if (i >= count) { alpha[i] = 0; continue; }
      if (st.hover) {
        this.pos[i * 3] += Math.sin(t * 0.6 + s * 3) * dt * st.sway;
        this.pos[i * 3 + 1] = 1.2 + (s % 3) + Math.sin(t * 0.8 + s) * 0.6;
        this.pos[i * 3 + 2] += Math.cos(t * 0.5 + s * 2) * dt * st.sway;
        if (Math.abs(this.pos[i * 3]) > h * 0.55 || Math.abs(this.pos[i * 3 + 2]) > h * 0.55) {
          this.pos[i * 3] = (Math.random() - 0.5) * h;
          this.pos[i * 3 + 2] = (Math.random() - 0.5) * h;
        }
        alpha[i] = Math.max(0, Math.sin(t * (1.5 + (s % 1)) + s * 7)) * this.alpha0[i];
        continue;
      }
      alpha[i] = this.alpha0[i];
      this.pos[i * 3 + 1] -= dt * (0.7 + (s % 1) * 0.6) * st.fall;
      this.pos[i * 3] += Math.sin(t * 0.7 + s) * dt * st.sway;
      this.pos[i * 3 + 2] += Math.cos(t * 0.5 + s) * dt * st.sway * 0.75;
      if (this.pos[i * 3 + 1] < 0 || this.pos[i * 3 + 1] > 16) {
        this.pos[i * 3 + 1] = st.fall > 0 ? 16 : 0;
        this.pos[i * 3] = (Math.random() - 0.5) * 2 * h;
        this.pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * h;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

export const tmpV = new Vector3();
