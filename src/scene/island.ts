import {
  BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial, Object3D,
  type PointLight, type Material, type ShaderMaterial,
} from 'three';
import type { IslandDef, PieceDef } from '../data/islands';
import { rng } from '../core/crossword';
import { models } from './models';
import {
  makeCabin, makeCampfire, makeCrab, makeGull, makeHut, makeLanternPost, makeLighthouse, makePebble,
  makePenguin, makePier, makeSnowman,
} from './props';
import {
  makeArch, makeBalloon, makeBench, makeBlossomTree, makeCactus, makeFence, makeFlamingo, makeFlowerBed, makeFountain, makeFox,
  makeGazebo, makeGlowMushrooms, makeHayBale, makeLavaRock, makeLeafPile, makeOasis, makePots, makePumpkin, makeSheep, makeSwan,
  makeTent, makeTreehouse, makeVolcano, makeWell, makeWindmill,
} from './props2';

const RINGS = 46;
/** Number of small plants that sprout as words are found (spread over the whole island). */
export const SPROUTS = 26;
const SEGS = 120;
const OUTER = 1.5; // mesh extends to 1.5x the shoreline radius, below water

interface Anim {
  obj: Object3D;
  start: number;
  delay: number;
  target: number;
}

/** Island terrain + its decorations; grows as the player completes levels. */
export class IslandView {
  group = new Group();
  private ground: Mesh;
  private groundMat: MeshStandardMaterial;
  private lushUniform = { value: 0 };
  private wobbleA: number;
  private wobbleB: number;
  private pieces: Object3D[] = [];
  private sprouts: Object3D[] = [];
  private anims: Anim[] = [];
  private animated: Array<(t: number, dt: number) => void> = [];
  private nightLevel = 0;
  private lit: { lamps: Material[]; lava: Material[]; beams: Object3D[]; lights: PointLight[] } = { lamps: [], lava: [], beams: [], lights: [] };
  visiblePieces = 0;
  visibleSprouts = 0;
  onPop?: (worldPos: Object3D, index: number) => void;

  constructor(public def: IslandDef, public index: number) {
    const r = rng(def.seed * 977);
    this.wobbleA = r() * 6.28;
    this.wobbleB = r() * 6.28;
    this.groundMat = this.makeGroundMaterial();
    this.ground = new Mesh(this.buildGround(), this.groundMat);
    this.ground.receiveShadow = true;
    this.group.add(this.ground);
    for (const p of def.base) this.group.add(this.place(this.build(p), p, 0));
    // shore pebbles
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const rr = this.shore(a) * (0.93 + r() * 0.08);
      const peb = makePebble(def.ground.pebble, i + def.seed);
      peb.scale.multiplyScalar(0.6 + r() * 0.9);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      peb.position.set(x, this.heightAt(x, z) - 0.05, z);
      peb.rotation.y = r() * 6;
      this.group.add(peb);
    }
    this.pieces = def.pieces.map((p, i) => {
      const o = this.place(this.build(p), p, i);
      o.visible = false;
      this.group.add(o);
      return o;
    });
    // sprout positions: random points on the grassy plateau, away from pieces
    const sr = rng(def.seed * 31);
    const taken = [...def.pieces, ...def.base].map((p) => [p.x, p.z]);
    let guard = 0;
    while (this.sprouts.length < SPROUTS && guard++ < 2000) {
      const a = sr() * Math.PI * 2;
      const d = Math.sqrt(sr()) * 0.72;
      const x = Math.cos(a) * d * this.shore(a), z = Math.sin(a) * d * this.shore(a);
      if (taken.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.6)) continue;
      taken.push([x, z]);
      const kind = def.sprouts[this.sprouts.length % def.sprouts.length];
      const o = this.place(this.build({ kind, x, z, rot: sr() * 6, s: 0.3 + sr() * 0.2 }), { kind, x, z }, this.sprouts.length);
      o.visible = false;
      this.group.add(o);
      this.sprouts.push(o);
    }
  }

  /** Shoreline radius for a given angle (world units). */
  shore = (a: number): number => {
    const R = this.def.radius;
    return R * (1 + 0.09 * Math.sin(3 * a + this.wobbleA) + 0.06 * Math.sin(5 * a + this.wobbleB) + 0.03 * Math.sin(9 * a));
  };

  /** Terrain height at local x,z. */
  heightAt(x: number, z: number): number {
    const a = Math.atan2(z, x);
    const d = Math.hypot(x, z) / this.shore(a);
    let h: number;
    if (d < 0.68) h = 1.05 + 0.18 * Math.sin(x * 0.9 + this.wobbleA) * Math.cos(z * 0.8 + this.wobbleB) * (1 - d);
    else if (d < 1.0) {
      const k = (d - 0.68) / 0.32;
      const s = k * k * (3 - 2 * k);
      const top = 1.05 + 0.18 * Math.sin(x * 0.9 + this.wobbleA) * Math.cos(z * 0.8 + this.wobbleB) * (1 - d);
      h = top * (1 - s) + 0.1 * s;
    } else {
      const k = Math.min(1, (d - 1.0) / (OUTER - 1.0));
      h = 0.1 - 2.8 * Math.pow(k, 0.8);
    }
    const hill = this.def.hill;
    if (hill) {
      const [hx, hz, hh, hw] = hill;
      h += hh * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (hw * hw));
    }
    return h;
  }

  private grassAt(x: number, z: number) {
    const a = Math.atan2(z, x);
    const d = Math.hypot(x, z) / this.shore(a);
    const n = 0.04 * Math.sin(a * 7 + this.wobbleA) + 0.03 * Math.sin(a * 13);
    const e = d + n;
    return 1 - Math.min(1, Math.max(0, (e - 0.6) / 0.14));
  }

  private buildGround(): BufferGeometry {
    const pos: number[] = [];
    const col: number[] = [];
    const grass: number[] = [];
    const gc = this.def.ground;
    const sand = new Color(gc.sand);
    const wet = new Color(gc.wet);
    const under = new Color(gc.under);
    const r = rng(this.def.seed);
    const push = (x: number, z: number) => {
      const y = this.heightAt(x, z);
      pos.push(x, y, z);
      const c = y > 0.35 ? sand.clone() : y > -0.1 ? wet.clone().lerp(sand, (y + 0.1) / 0.45) : under.clone().lerp(wet, Math.max(0, 1 + y / 1.5));
      c.offsetHSL(0, 0, (r() - 0.5) * 0.03);
      col.push(c.r, c.g, c.b);
      grass.push(this.grassAt(x, z), r());
    };
    push(0, 0);
    for (let i = 1; i <= RINGS; i++) {
      const t = i / RINGS;
      for (let j = 0; j < SEGS; j++) {
        const a = (j / SEGS) * Math.PI * 2;
        const rr = Math.pow(t, 0.85) * OUTER * this.shore(a);
        push(Math.cos(a) * rr, Math.sin(a) * rr);
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < SEGS; j++) idx.push(0, 1 + ((j + 1) % SEGS), 1 + j);
    for (let i = 1; i < RINGS; i++) {
      const a0 = 1 + (i - 1) * SEGS, a1 = 1 + i * SEGS;
      for (let j = 0; j < SEGS; j++) {
        const j1 = (j + 1) % SEGS;
        idx.push(a0 + j, a0 + j1, a1 + j, a0 + j1, a1 + j1, a1 + j);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
    g.setAttribute('aGrass', new BufferAttribute(new Float32Array(grass), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  private makeGroundMaterial() {
    const gc = this.def.ground;
    const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    const dry = new Color(gc.dry);
    const lush = new Color(gc.lush);
    const lush2 = new Color(gc.lush2);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLush = this.lushUniform;
      sh.uniforms.uDry = { value: dry };
      sh.uniforms.uLushA = { value: lush };
      sh.uniforms.uLushB = { value: lush2 };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aGrass;\nvarying vec2 vGrass;\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrass = aGrass;\nvWPos = (modelMatrix * vec4(position,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uLush;\nuniform vec3 uDry, uLushA, uLushB;\nvarying vec2 vGrass;\nvarying vec3 vWPos;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float patchN = sin(vWPos.x * 1.7) * sin(vWPos.z * 1.3) * 0.5 + 0.5;
          vec3 lushC = mix(uLushA, uLushB, patchN * 0.6 + vGrass.y * 0.25);
          vec3 g = mix(uDry * (0.9 + vGrass.y * 0.2), lushC, uLush);
          diffuseColor.rgb = mix(diffuseColor.rgb, g, smoothstep(0.15, 0.6, vGrass.x));`,
        );
    };
    return m;
  }

  private build(p: PieceDef): Object3D {
    const winter = this.def.theme === 'winter';
    switch (p.kind) {
      case 'hut': return makeHut();
      case 'pier': return makePier(winter);
      case 'lighthouse': return this.track(makeLighthouse());
      case 'cabin': return this.track(makeCabin());
      case 'campfire': return this.track(makeCampfire());
      case 'snowman': return makeSnowman();
      case 'crab': return this.animate(makeCrab(), (o, t) => {
        o.position.x = o.userData.x + Math.sin(t * 0.6) * 0.8;
        o.getObjectByName('clawL')!.rotation.z = Math.sin(t * 6) * 0.3;
        o.getObjectByName('clawR')!.rotation.z = -Math.sin(t * 6 + 1) * 0.3;
      });
      case 'penguins': {
        const g = new Group();
        [[0, 0, 1], [0.8, 0.5, 0.8], [-0.6, 0.7, 0.65]].forEach(([x, z, s], i) => {
          const pg = makePenguin();
          pg.position.set(x, 0, z);
          pg.scale.setScalar(s);
          g.add(pg);
          this.animate(pg, (o, t) => {
            o.rotation.z = Math.sin(t * 5 + i) * 0.08;
            o.getObjectByName('wingL')!.rotation.z = -0.25 - Math.max(0, Math.sin(t * 3 + i)) * 0.5;
            o.getObjectByName('wingR')!.rotation.z = 0.25 + Math.max(0, Math.sin(t * 3 + i)) * 0.5;
          });
        });
        return g;
      }
      case 'gulls': {
        const g = new Group();
        for (let i = 0; i < 3; i++) {
          const gull = makeGull();
          g.add(gull);
          const rad = 5 + i * 1.6, h = 6 + i * 0.9, sp = 0.25 + i * 0.05, ph = i * 2.1;
          this.animate(gull, (o, t) => {
            const a = t * sp + ph;
            o.position.set(Math.cos(a) * rad, h + Math.sin(t * 0.8 + i) * 0.4, Math.sin(a) * rad);
            o.rotation.y = -a;
            const f = Math.sin(t * 6 + i) * 0.5;
            o.getObjectByName('wingL')!.rotation.z = f;
            o.getObjectByName('wingR')!.rotation.z = -f;
          });
        }
        g.userData.noGround = true;
        return g;
      }
      case 'lanterns': {
        const g = new Group();
        g.userData.noGround = true;
        const r = rng(5);
        for (let i = 0; i < 5; i++) {
          const a = -0.4 + i * 0.55 + r() * 0.1;
          const rr = this.shore(a) * 0.62;
          const lp = makeLanternPost();
          const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
          lp.position.set(x, this.heightAt(x, z), z);
          g.add(lp);
        }
        return g;
      }
      case 'windmill': {
        const w = makeWindmill();
        const hub = w.getObjectByName('spin')!;
        this.animated.push((t) => { hub.rotation.z = -t * 0.8; });
        return this.track(w);
      }
      case 'sheep': return this.animate(makeSheep(), (o, t) => { o.rotation.y = Math.sin(t * 0.3 + p.x) * 0.5; o.position.y = Math.abs(Math.sin(t * 2 + p.z)) * 0.03; });
      case 'fence': return makeFence(3);
      case 'haybale': return makeHayBale();
      case 'well': return makeWell();
      case 'bench': return makeBench();
      case 'flowerbed': return makeFlowerBed(Math.round(p.x * 10));
      case 'flowerbed_pink': return makeFlowerBed(Math.round(p.x * 10), [0xff8fb8, 0xffd0e2, 0xffffff, 0xe86aa0]);
      case 'flowerbed_small': { const f = makeFlowerBed(Math.round(p.x * 13), [0xff8fb8, 0xffffff]); f.scale.setScalar(0.6); return f; }
      case 'Clover': { const f = makeFlowerBed(Math.round(p.z * 13), [0xffffff, 0xffd23f]); f.scale.setScalar(0.5); return f; }
      case 'cactus': return makeCactus(Math.round(p.x * 7 + p.z));
      case 'cactus_small': { const c = makeCactus(Math.round(p.x * 5 + p.z)); c.scale.setScalar(0.8); return c; }
      case 'arch': return makeArch();
      case 'tent': {
        const tnt = makeTent();
        const flag = tnt.getObjectByName('flag')!;
        this.animated.push((t) => { flag.rotation.y = Math.sin(t * 5) * 0.3; });
        return tnt;
      }
      case 'pots': return makePots();
      case 'oasis': return makeOasis();
      case 'flamingo': return this.animate(makeFlamingo(), (o, t) => { o.rotation.z = Math.sin(t * 0.8) * 0.03; });
      case 'flamingos': {
        const g = new Group();
        [[0, 0], [0.7, 0.5], [-0.6, 0.6]].forEach(([x, z], i) => {
          const f = makeFlamingo();
          f.position.set(x, 0, z);
          f.rotation.y = i * 0.9;
          g.add(f);
        });
        return g;
      }
      case 'balloon': {
        const b = makeBalloon();
        const fl = b.getObjectByName('float')!;
        this.animated.push((t) => { fl.position.y = 0.6 + Math.sin(t * 0.8) * 0.25; fl.rotation.y = t * 0.1; });
        return b;
      }
      case 'pumpkins': {
        const g = new Group();
        [[0, 0, 1], [0.7, 0.3, 0.75], [-0.5, 0.55, 0.85], [0.2, -0.6, 0.6]].forEach(([x, z, sc], i) => {
          const pk = makePumpkin(i + 3);
          pk.position.set(x, 0, z);
          pk.scale.setScalar(sc);
          g.add(pk);
        });
        return g;
      }
      case 'fox': return this.animate(makeFox(), (o, t) => { const tail = o.getObjectByName('tail')!; tail.rotation.y = Math.sin(t * 3) * 0.4; });
      case 'leafpile': return makeLeafPile(Math.round(p.x * 10));
      case 'leafpile_small': { const l = makeLeafPile(Math.round(p.z * 10)); l.scale.setScalar(0.5); return l; }
      case 'treehouse': return this.track(makeTreehouse());
      case 'glowshrooms': return this.track(makeGlowMushrooms(Math.round(p.x * 10)));
      case 'glowshrooms_small': { const gm = this.track(makeGlowMushrooms(Math.round(p.z * 10), 0x9b7cff)); gm.scale.setScalar(0.6); return gm; }
      case 'gazebo': return this.track(makeGazebo());
      case 'fountain': {
        const f = makeFountain();
        const spray = f.getObjectByName('spray')!;
        this.animated.push((t) => { spray.scale.set(1 + Math.sin(t * 7) * 0.05, 1 + Math.sin(t * 9) * 0.08, 1 + Math.cos(t * 7) * 0.05); });
        return f;
      }
      case 'swans': {
        const g = new Group();
        g.userData.noGround = true;
        for (let i = 0; i < 2; i++) {
          const sw = makeSwan();
          g.add(sw);
          this.animate(sw, (o, t) => {
            const a = t * 0.12 + i * Math.PI;
            o.position.set(p.x + Math.cos(a) * 2.2, -0.05 + Math.sin(t * 1.4 + i) * 0.04, p.z + Math.sin(a) * 1.2);
            o.rotation.y = -a;
          });
        }
        return g;
      }
      case 'blossomtree': return makeBlossomTree(Math.round(p.x * 10 + p.z));
      case 'volcano': return this.track(makeVolcano());
      case 'lavarock': return this.track(makeLavaRock(Math.round(p.x * 10)));
      default: {
        const m = models.clone(p.kind);
        if (m) {
          if (winter) frost(m);
          else if (this.def.leafTint !== undefined) tintLeaves(m, this.def.leafTint);
          return m;
        }
        return makePebble(0x9aa1a8, 3);
      }
    }
  }

  private place(o: Object3D, p: PieceDef, _i: number) {
    const wrap = new Group();
    wrap.add(o);
    const y = o.userData.noGround ? 0 : this.heightAt(p.x, p.z);
    if (!o.userData.noGround) wrap.position.set(p.x, y - 0.02, p.z);
    o.userData.x = 0;
    wrap.rotation.y = p.rot ?? 0;
    wrap.userData.scale = p.s ?? 1;
    wrap.scale.setScalar(p.s ?? 1);
    if (p.kind === 'pier') wrap.position.y = -0.1;
    return wrap;
  }

  private animate(o: Object3D, fn: (o: Object3D, t: number) => void) {
    this.animated.push((t) => { if (o.parent && isVisible(o)) fn(o, t); });
    return o;
  }

  private track(o: Object3D) {
    o.traverse((c) => {
      const m = c as Mesh;
      if (m.isMesh) {
        const mm = m.material as MeshStandardMaterial;
        if (mm.name === 'lamp' || mm.name === 'window' || mm.name === 'lantern') this.lit.lamps.push(mm);
        if (mm.name === 'lava') this.lit.lava.push(mm);
      }
      if (c.name === 'beam') this.lit.beams.push(c);
      if ((c as PointLight).isPointLight) this.lit.lights.push(c as PointLight);
    });
    const flame = o.getObjectByName('flame');
    if (flame) this.animated.push((t) => { flame.scale.set(1 + Math.sin(t * 13) * 0.08, 1 + Math.sin(t * 9) * 0.15, 1 + Math.cos(t * 11) * 0.08); });
    return o;
  }

  /** Light up lamps, windows and the lighthouse according to time of day. */
  setNight(n: number) {
    this.nightLevel = n;
  }

  /** Show `pieces` decorations and `sprouts` small plants. `animate` pops new ones in. */
  setProgress(pieces: number, sprouts: number, lush: number, animate: boolean, now: number) {
    pieces = Math.min(pieces, this.pieces.length);
    sprouts = Math.min(sprouts, this.sprouts.length);
    let delay = 0;
    this.pieces.forEach((o, i) => {
      const show = i < pieces;
      if (show && !o.visible && animate) {
        this.pop(o, now, delay, i);
        delay += 0.45;
      } else {
        o.visible = show;
        o.scale.setScalar(o.userData.scale);
      }
    });
    this.sprouts.forEach((o, i) => {
      const show = i < sprouts;
      if (show && !o.visible && animate) this.pop(o, now, 0.1 * (i - this.visibleSprouts), i);
      else { o.visible = show; o.scale.setScalar(o.userData.scale); }
    });
    this.visiblePieces = pieces;
    this.visibleSprouts = sprouts;
    this.lushTarget = lush;
    if (!animate) this.lushUniform.value = lush;
  }

  private lushTarget = 0;

  private pop(o: Object3D, now: number, delay: number, index: number) {
    o.visible = true;
    o.scale.setScalar(0.0001);
    this.anims.push({ obj: o, start: now, delay, target: o.userData.scale });
    o.userData.popIndex = index;
  }

  update(t: number, dt: number) {
    for (const f of this.animated) f(t, dt);
    this.lushUniform.value += (this.lushTarget - this.lushUniform.value) * Math.min(1, dt * 1.5);
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      const k = (t - a.start - a.delay) / 0.7;
      if (k < 0) { a.obj.scale.setScalar(0.0001); continue; }
      if (!a.obj.userData.popped) {
        a.obj.userData.popped = true;
        this.onPop?.(a.obj, a.obj.userData.popIndex ?? 0);
      }
      if (k >= 1) { a.obj.scale.setScalar(a.target); this.anims.splice(i, 1); a.obj.userData.popped = false; continue; }
      // elastic overshoot
      const s = 1 - Math.pow(2, -10 * k) * Math.cos(k * Math.PI * 2.4);
      a.obj.scale.setScalar(Math.max(0.0001, a.target * s));
    }
    // night lights
    const n = this.nightLevel;
    for (const m of this.lit.lamps) (m as MeshStandardMaterial).emissiveIntensity = 0.15 + n * 2.2;
    for (const m of this.lit.lava) (m as MeshStandardMaterial).emissiveIntensity = 1.4 + Math.sin(t * 1.7) * 0.4;
    for (const b of this.lit.beams) {
      b.rotation.y = t * 0.7;
      const mm = (b.children[0] as Mesh).material as ShaderMaterial;
      mm.uniforms.uOpacity.value = n * 0.55;
    }
    for (const l of this.lit.lights) {
      const fire = l.name === 'fireLight';
      if (l.name === 'lavaLight') l.intensity = 10 + Math.sin(t * 2) * 2;
      else l.intensity = fire ? (1.5 + n * 6) * (0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7)) : n * 14;
    }
  }

  /** World position of an island point (for camera focus, particles). */
  get hasNightLights() {
    return this.lit.lamps.length > 0;
  }
}

function isVisible(o: Object3D): boolean {
  let c: Object3D | null = o;
  while (c) { if (!c.visible) return false; c = c.parent; }
  return true;
}

/** Winter look: blend upward-facing surfaces of a model towards snow white. */
const frostCache = new WeakMap<Material, Material>();
function frost(o: Object3D) {
  o.traverse((c) => {
    const m = c as Mesh;
    if (!m.isMesh) return;
    const src = m.material as MeshStandardMaterial;
    let f = frostCache.get(src) as MeshStandardMaterial | undefined;
    if (!f) {
      f = src.clone();
      f.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vUp;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = normalize(mat3(modelMatrix) * objectNormal).y;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vUp;')
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.8, 0.88, 0.95), vec3(0.95, 0.97, 1.0), smoothstep(0.25, 0.65, vUp));');
      };
      f.customProgramCacheKey = () => 'frost';
      frostCache.set(src, f);
    }
    m.material = f;
  });
}

/** Autumn / blossom look: tint the leafy (alpha-tested) materials of a CC0 model. */
const tintCache = new Map<string, Material>();
function tintLeaves(o: Object3D, color: number) {
  o.traverse((c) => {
    const m = c as Mesh;
    if (!m.isMesh) return;
    const src = m.material as MeshStandardMaterial;
    if (!(src.alphaTest > 0) || !/leaf|leaves|flower|grass/i.test(src.name + (src.map?.name ?? ''))) return;
    const key = src.uuid + color;
    let f = tintCache.get(key) as MeshStandardMaterial | undefined;
    if (!f) {
      f = src.clone();
      const tint = new Color(color);
      f.onBeforeCompile = (sh) => {
        sh.uniforms.uTint = { value: tint };
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uTint;')
          .replace('#include <color_fragment>', '#include <color_fragment>\nfloat lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));\ndiffuseColor.rgb = mix(diffuseColor.rgb, uTint * (0.55 + lum * 1.3), 0.82);');
      };
      f.customProgramCacheKey = () => 'tint' + color;
      tintCache.set(key, f);
    }
    m.material = f;
  });
}
