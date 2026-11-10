import { timeScale } from '../core/timescale';
import {
  NeutralToneMapping, Color, DirectionalLight, Group, HemisphereLight, MathUtils, PCFSoftShadowMap,
  PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer, Fog, Object3D,
} from 'three';
import { ISLANDS } from '../data/islands';
import { IslandView } from './island';
import { PALETTES, type Palette } from './palettes';
import { makeSailboat } from './props';
import { Sky } from './sky';
import { Water } from './water';
import { Particles, Snow } from './fx';

export interface ViewRect { x: number; y: number; w: number; h: number }

const ISLAND_SPACING = new Vector3(70, 0, -38);

function lerpPalette(a: Palette, b: Palette, k: number): Palette {
  const c = (x: Color, y: Color) => x.clone().lerp(y, k);
  return {
    skyTop: c(a.skyTop, b.skyTop), skyHorizon: c(a.skyHorizon, b.skyHorizon), skyBottom: c(a.skyBottom, b.skyBottom),
    fog: c(a.fog, b.fog), sunDir: a.sunDir.clone().lerp(b.sunDir, k).normalize(), sunColor: c(a.sunColor, b.sunColor),
    sunIntensity: MathUtils.lerp(a.sunIntensity, b.sunIntensity, k), hemiSky: c(a.hemiSky, b.hemiSky),
    hemiGround: c(a.hemiGround, b.hemiGround), hemiIntensity: MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, k),
    waterDeep: c(a.waterDeep, b.waterDeep), waterShallow: c(a.waterShallow, b.waterShallow), glint: c(a.glint, b.glint),
    stars: MathUtils.lerp(a.stars, b.stars, k), night: MathUtils.lerp(a.night, b.night, k), exposure: MathUtils.lerp(a.exposure, b.exposure, k),
  };
}

/** Owns the renderer and everything 3D: sky, water, islands, boat, camera and effects. */
export class World {
  renderer: WebGLRenderer;
  scene = new Scene();
  camera = new PerspectiveCamera(36, 1, 0.5, 2000);
  private sky = new Sky();
  private water = new Water();
  private sun = new DirectionalLight(0xffffff, 2);
  private hemi = new HemisphereLight(0xffffff, 0x888888, 1);
  private islands = new Map<number, IslandView>();
  private boat: Group;
  private sparkles = new Particles(500, -2.5, true);
  private smoke = new Particles(120, 0.6, false, 0.4);
  private snow = new Snow();
  private current = 0;
  private rect: ViewRect = { x: 0, y: 0, w: 1, h: 1 };
  private time = 0;
  private last = performance.now();
  private focus = 0;
  private focusTarget = 0;
  private palette: Palette = PALETTES.morning;
  private sail: { from: number; to: number; start: number; dur: number; done: () => void } | null = null;
  private camPos = new Vector3();
  private camLook = new Vector3();
  private camInit = false;
  private running = true;
  private smokeTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.scene.add(this.sky.mesh, this.water.mesh, this.hemi, this.sun, this.sun.target);
    this.scene.fog = new Fog(0xffffff, 140, 650);
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.boat = makeSailboat();
    this.boat.scale.setScalar(0.7);
    this.scene.add(this.boat, this.sparkles.points, this.smoke.points, this.snow.points);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.applyPalette(PALETTES.morning);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setRunning(r: boolean) {
    this.running = r;
    this.last = performance.now();
  }

  islandCenter(i: number) {
    return ISLAND_SPACING.clone().multiplyScalar(i);
  }

  private ensureIsland(i: number): IslandView | null {
    if (i < 0 || i >= ISLANDS.length) return null;
    let v = this.islands.get(i);
    if (!v) {
      v = new IslandView(ISLANDS[i], i);
      v.group.position.copy(this.islandCenter(i));
      v.onPop = (o) => {
        const p = new Vector3();
        o.getWorldPosition(p);
        p.y += 1;
        this.sparkles.emit(p, 26, { color: new Color(0xfff0a0), speed: 3, up: 4, size: 1.2 });
        this.onPop?.();
      };
      this.scene.add(v.group);
      this.islands.set(i, v);
    }
    return v;
  }

  onPop?: () => void;

  showIsland(i: number) {
    this.current = i;
    for (const [k, v] of this.islands) if (Math.abs(k - i) > 1) { this.scene.remove(v.group); this.islands.delete(k); }
    const v = this.ensureIsland(i)!;
    this.ensureIsland(i + 1);
    this.water.setIsland(0, v.group.position.x, v.group.position.z, v.shore);
    const nxt = this.islands.get(i + 1);
    this.water.setIsland(1, nxt?.group.position.x ?? 0, nxt?.group.position.z ?? 0, nxt ? nxt.shore : null);
    this.applyPalette(PALETTES[ISLANDS[i].time]);
    this.placeBoat(i);
    this.camInit = false;
  }

  island(i = this.current) {
    return this.islands.get(i) ?? null;
  }

  setProgress(pieces: number, sprouts: number, lush: number, animate: boolean) {
    this.island()?.setProgress(pieces, sprouts, lush, animate, this.time);
  }

  /** Zoom the camera in on the island (level complete) or back out. */
  setFocus(on: boolean) {
    this.focusTarget = on ? 1 : 0;
  }

  /** Celebrate a found word with a burst over the island. */
  celebrate(strength = 1) {
    const v = this.island();
    if (!v) return;
    const p = v.group.position.clone().add(new Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 2, (Math.random() - 0.5) * 4));
    this.sparkles.emit(p, Math.round(18 * strength), { color: new Color(0xfff6c0), speed: 2.5, up: 3, size: 1.1 });
  }

  private dockPoint(i: number): { pos: Vector3; heading: number } {
    const def = ISLANDS[i];
    const c = this.islandCenter(i);
    const pier = def.pieces.find((p) => p.kind === 'pier');
    if (pier) {
      const rot = pier.rot ?? 0;
      const local = new Vector3(2.1, 0, 4.0).applyAxisAngle(new Vector3(0, 1, 0), rot);
      return { pos: c.add(new Vector3(pier.x, 0, pier.z)).add(local), heading: rot };
    }
    const a = 0.5;
    return { pos: c.add(new Vector3(Math.cos(a) * def.radius * 1.5, 0, Math.sin(a) * def.radius * 1.5)), heading: a + Math.PI / 2 };
  }

  private placeBoat(i: number) {
    const d = this.dockPoint(i);
    this.boat.position.copy(d.pos);
    this.boat.rotation.set(0, d.heading, 0);
  }

  /** Sail from the current island to the next; resolves when arrived (or skipped). */
  sailTo(next: number): Promise<void> {
    this.ensureIsland(next);
    const nv = this.islands.get(next)!;
    this.water.setIsland(1, nv.group.position.x, nv.group.position.z, nv.shore);
    return new Promise((resolve) => {
      this.sail = { from: this.current, to: next, start: this.time, dur: 6.5, done: resolve };
    });
  }

  skipSail() {
    if (this.sail) this.sail.start = this.time - this.sail.dur;
  }

  /** The region of the screen (CSS px) where the island should appear. */
  setViewRect(r: ViewRect) {
    this.rect = r;
    this.updateViewOffset();
  }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w * h > 1600 * 900 ? 1.5 : 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.updateViewOffset();
    const scale = this.renderer.domElement.height / (2 * Math.tan(MathUtils.degToRad(this.camera.fov) / 2));
    this.sparkles.material.uniforms.uScale.value = scale * 0.25;
    this.smoke.material.uniforms.uScale.value = scale * 0.25;
    this.snow.material.uniforms.uScale.value = scale * 0.25;
  }

  private updateViewOffset() {
    const W = window.innerWidth, H = window.innerHeight;
    const cx = this.rect.x + this.rect.w / 2, cy = this.rect.y + this.rect.h / 2;
    this.camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    this.camera.updateProjectionMatrix();
  }

  /** Camera distance that makes an island of the given radius fill the view rect. */
  private fitDistance(radius: number) {
    const H = window.innerHeight;
    const tanHalf = Math.tan(MathUtils.degToRad(this.camera.fov) / 2);
    const unitsW = radius * 2.9, unitsH = radius * 1.6;
    const dW = (unitsW * H) / (2 * tanHalf * Math.max(this.rect.w, 1));
    const dH = (unitsH * H) / (2 * tanHalf * Math.max(this.rect.h, 1));
    return MathUtils.clamp(Math.max(dW, dH), 18, 140);
  }

  private applyPalette(p: Palette) {
    this.palette = p;
    this.sky.apply(p);
    this.water.apply(p);
    this.sun.color.copy(p.sunColor);
    this.sun.intensity = p.sunIntensity;
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    (this.scene.fog as Fog).color.copy(p.skyHorizon);
    this.renderer.toneMappingExposure = p.exposure;
    for (const v of this.islands.values()) v.setNight(p.night);
  }

  private frame() {
    const now = performance.now();
    const dt = Math.max(0, Math.min(timeScale.value < 1 ? 1 : 0.05, (now - this.last) / 1000));
    this.last = now;
    if (!this.running) return;
    const sdt = Math.min(0.05, dt * timeScale.value);
    this.time += sdt;
    const t = this.time;
    this.sky.material.uniforms.uTime.value = t;
    this.water.material.uniforms.uTime.value = t;

    let center = this.islandCenter(this.current);
    let radius = ISLANDS[this.current].radius;
    let sailing = false;
    if (this.sail) {
      sailing = true;
      const s = this.sail;
      const k = MathUtils.clamp((t - s.start) / s.dur, 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const a = this.dockPoint(s.from).pos, b = this.dockPoint(s.to).pos;
      const mid = a.clone().lerp(b, 0.5).add(new Vector3(0, 0, 14));
      const p = new Vector3().copy(a).multiplyScalar((1 - e) ** 2).addScaledVector(mid, 2 * (1 - e) * e).addScaledVector(b, e * e);
      const ahead = Math.min(1, e + 0.01);
      const p2 = new Vector3().copy(a).multiplyScalar((1 - ahead) ** 2).addScaledVector(mid, 2 * (1 - ahead) * ahead).addScaledVector(b, ahead * ahead);
      this.boat.position.copy(p);
      if (p2.distanceToSquared(p) > 1e-6) this.boat.rotation.y = Math.atan2(p2.x - p.x, p2.z - p.z);
      const pal = lerpPalette(PALETTES[ISLANDS[s.from].time], PALETTES[ISLANDS[s.to].time], MathUtils.smoothstep(k, 0.2, 0.85));
      this.applyPalette(pal);
      center = p.clone();
      radius = 4.5;
      this.water.material.uniforms.uBoat.value.set(p.x, p.z, 0, Math.sin(k * Math.PI));
      if (k >= 1) {
        this.sail = null;
        this.water.material.uniforms.uBoat.value.set(0, 0, 0, 0);
        this.showIsland(s.to);
        s.done();
      }
    }
    // boat bobbing
    this.boat.position.y = Math.sin(t * 1.4) * 0.08 - 0.05;
    this.boat.rotation.z = Math.sin(t * 1.1) * 0.05;
    this.boat.rotation.x = Math.sin(t * 0.9 + 1) * 0.03;
    const flag = this.boat.getObjectByName('flag');
    if (flag) flag.rotation.y = Math.sin(t * 6) * 0.25;

    for (const v of this.islands.values()) v.update(t, sdt);
    this.sparkles.update(sdt);
    this.smoke.update(sdt);
    // chimney smoke
    const cur = this.island();
    this.smokeTimer -= sdt;
    if (cur && this.smokeTimer <= 0) {
      this.smokeTimer = 0.35;
      cur.group.traverse((o: Object3D) => {
        if (o.name === 'smoke' && isShown(o)) {
          const p = new Vector3();
          o.getWorldPosition(p);
          this.smoke.emit(p, 1, { color: new Color(0x8f97a8), speed: 0.15, up: 0.6, size: 2.2, life: 4, spread: 0.1 });
        }
      });
    }
    this.snow.enabled = ISLANDS[this.current].theme === 'winter' && !sailing;
    this.snow.points.position.copy(this.islandCenter(this.current));
    this.snow.update(t, sdt);
    const night = this.palette.night;
    this.water.material.uniforms.uLights.value.set(center.x - 3, center.z - 3, 0, cur?.hasNightLights && cur.visiblePieces > 0 ? night : 0);

    // camera
    this.focus += (this.focusTarget - this.focus) * Math.min(1, sdt * 2);
    const dist = this.fitDistance(radius) * (1 - this.focus * 0.22) * (sailing ? 1.1 : 1);
    const az = 0.32 + Math.sin(t * 0.08) * 0.1 + this.focus * Math.sin(t * 0.25) * 0.25;
    const highRect = this.rect.y + this.rect.h / 2 < window.innerHeight * 0.36;
    const el = (highRect ? 0.34 : 0.25) + Math.sin(t * 0.11) * 0.02 - this.focus * 0.04;
    const look = center.clone().add(new Vector3(0, sailing ? 0.5 : 1.2, 0));
    const camPos = look.clone().add(new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist));
    if (!this.camInit) { this.camPos.copy(camPos); this.camLook.copy(look); this.camInit = true; }
    const k = Math.min(1, sdt * (sailing ? 3 : 2.2));
    this.camPos.lerp(camPos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.water.mesh.position.set(this.camLook.x, 0, this.camLook.z);
    this.sky.mesh.position.copy(this.camera.position);
    // sun follows focus area so shadows stay crisp
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).addScaledVector(this.palette.sunDir, 40);
    this.renderer.render(this.scene, this.camera);
  }
}

function isShown(o: Object3D) {
  let c: Object3D | null = o;
  while (c) { if (!c.visible || c.scale.x < 0.5) return false; c = c.parent; }
  return true;
}
