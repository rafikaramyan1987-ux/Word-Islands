/**
 * Hand-modelled low-poly props (everything the CC0 packs don't provide): sailboat, hut, pier,
 * lighthouse, cabin, campfire, snowman and small animals. Smooth, rounded, glossy shapes with
 * flat colour materials so they sit well next to the Quaternius models.
 */
import {
  BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, DoubleSide,
  Float32BufferAttribute, FrontSide, Group, IcosahedronGeometry, LatheGeometry, Mesh, MeshStandardMaterial,
  Object3D, PointLight, SphereGeometry, TorusGeometry, Vector2, AdditiveBlending, MeshBasicMaterial, ShaderMaterial,
} from 'three';
import { rng } from '../core/crossword';

const matCache = new Map<string, MeshStandardMaterial>();
export function mat(color: number, opts: { rough?: number; metal?: number; emissive?: number; ei?: number; side?: boolean } = {}) {
  const key = `${color}-${opts.rough}-${opts.metal}-${opts.emissive}-${opts.ei}-${opts.side}`;
  let m = matCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.62,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.ei ?? 1,
      side: opts.side ? DoubleSide : FrontSide,
    });
    matCache.set(key, m);
  }
  return m;
}

function mesh(geo: BufferGeometry, m: MeshStandardMaterial | MeshBasicMaterial, x = 0, y = 0, z = 0, shadow = true) {
  const o = new Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
}

/** Jitter vertices a little so primitives look hand-made (keeps shared vertices together). */
function wobble(geo: BufferGeometry, amount: number, seed: number) {
  const r = rng(seed);
  const p = geo.attributes.position;
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let d = seen.get(k);
    if (!d) { d = [(r() - 0.5) * amount, (r() - 0.5) * amount, (r() - 0.5) * amount]; seen.set(k, d); }
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- sailboat
export function makeSailboat(): Group {
  const g = new Group();
  // hull: half capsule squashed and pinched at the bow, painted with vertex colours
  const hullGeo = new SphereGeometry(1, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const pos = hullGeo.attributes.position;
  const colors: number[] = [];
  const white = new Color(0xfdf8ef), red = new Color(0xe2574c), navy = new Color(0x274a78);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    z *= 2.4;
    if (z > 0) x *= 1 - Math.pow(z / 2.4, 2) * 0.85;
    y *= 0.75;
    pos.setXYZ(i, x * 0.95, y, z);
    const c = y > -0.12 ? red : y > -0.5 ? white : navy;
    colors.push(c.r, c.g, c.b);
  }
  hullGeo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  hullGeo.computeVertexNormals();
  const hull = mesh(hullGeo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, side: DoubleSide }));
  hull.position.y = 0.25;
  g.add(hull);
  // deck
  const deckShape: Vector2[] = [];
  const deckGeo = new CylinderGeometry(0.93, 0.93, 0.08, 28);
  const dp = deckGeo.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    let x = dp.getX(i), z = dp.getZ(i);
    z *= 2.4;
    if (z > 0) x *= 1 - Math.pow(z / 2.4, 2) * 0.85;
    dp.setXYZ(i, x * 0.95, dp.getY(i), z);
  }
  void deckShape;
  deckGeo.computeVertexNormals();
  g.add(mesh(deckGeo, mat(0xc89058, { rough: 0.7 }), 0, 0.22, 0));
  // cabin
  const cabin = mesh(new BoxGeometry(0.9, 0.42, 1.0), mat(0xfdf8ef, { rough: 0.4 }), 0, 0.45, -0.7);
  g.add(cabin);
  g.add(mesh(new BoxGeometry(1.0, 0.08, 1.1), mat(0x3d7bbf, { rough: 0.4 }), 0, 0.7, -0.7));
  for (const sx of [-0.46, 0.46]) g.add(mesh(new CylinderGeometry(0.1, 0.1, 0.02, 12), mat(0x9fd8ff, { rough: 0.1, emissive: 0x335577, ei: 0.3 }), sx, 0.5, -0.6).rotateZ(Math.PI / 2));
  // mast & boom
  const mast = mesh(new CylinderGeometry(0.05, 0.06, 3.6, 8), mat(0x8a5a36), 0, 2.0, 0.25);
  g.add(mast);
  g.add(mesh(new CylinderGeometry(0.04, 0.04, 1.8, 8), mat(0x8a5a36), 0, 0.85, -0.6).rotateX(Math.PI / 2));
  // sails: curved triangles
  const sail = (pts: [number, number, number][], belly: number) => {
    const geo = new BufferGeometry();
    const [a, b, c] = pts;
    const N = 8;
    const verts: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N - i; j++) {
        const u = i / N, v = j / N, w = 1 - u - v;
        const x = a[0] * w + b[0] * u + c[0] * v;
        const y = a[1] * w + b[1] * u + c[1] * v;
        const z = a[2] * w + b[2] * u + c[2] * v;
        verts.push(x + belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * (u + v)) * 1.0, y, z);
      }
    }
    let k = 0;
    const rowStart: number[] = [];
    for (let i = 0; i <= N; i++) { rowStart.push(k); k += N - i + 1; }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N - i; j++) {
        const p0 = rowStart[i] + j, p1 = rowStart[i + 1] + j, p2 = rowStart[i] + j + 1;
        idx.push(p0, p1, p2);
        if (j < N - i - 1) idx.push(p1, rowStart[i + 1] + j + 1, p2);
      }
    }
    geo.setAttribute('position', new Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return mesh(geo, mat(0xfffaf0, { rough: 0.55, side: true }));
  };
  const main = sail([[0, 0.95, 0.15], [0, 3.7, 0.2], [0, 0.95, -1.45]], 0.35);
  main.name = 'sail';
  g.add(main);
  g.add(sail([[0, 3.4, 0.3], [0, 0.6, 2.05], [0, 0.95, 0.4]], 0.25));
  // flag
  const flag = mesh(new BoxGeometry(0.02, 0.22, 0.4), mat(0xffc93c), 0, 3.7, 0.05);
  flag.name = 'flag';
  g.add(flag);
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------- tropical hut
export function makeHut(): Group {
  const g = new Group();
  // stilt platform
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(mesh(new CylinderGeometry(0.09, 0.11, 0.7, 7), mat(0x8a5a36), x * 1.05, 0.35, z * 1.05));
  g.add(mesh(wobble(new BoxGeometry(2.6, 0.14, 2.6, 4, 1, 4), 0.03, 2), mat(0xc08a52, { rough: 0.75 }), 0, 0.72, 0));
  // walls: bamboo cylinder ring
  const walls = new CylinderGeometry(1.0, 1.05, 1.25, 18, 1, true);
  const wc: number[] = [];
  const wp = walls.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    const a = Math.atan2(wp.getZ(i), wp.getX(i));
    const stripe = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 18) % 2;
    const c = new Color(stripe ? 0xe9c48a : 0xd9ae70);
    wc.push(c.r, c.g, c.b);
  }
  walls.setAttribute('color', new Float32BufferAttribute(wc, 3));
  g.add(mesh(walls, new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: DoubleSide }), 0, 1.42, 0));
  // door & windows
  g.add(mesh(new BoxGeometry(0.5, 0.82, 0.08), mat(0x6b4226), 0, 1.24, 1.0));
  const win = mat(0x5b8fb0, { rough: 0.2, emissive: 0xffc46b, ei: 0 });
  win.name = 'window';
  g.add(mesh(new BoxGeometry(0.34, 0.3, 0.06), win, 0.72, 1.55, 0.72).rotateY(Math.PI / 4));
  g.add(mesh(new BoxGeometry(0.34, 0.3, 0.06), win, -0.72, 1.55, 0.72).rotateY(-Math.PI / 4));
  // thatched roof: two jagged cones
  const roof1 = wobble(new ConeGeometry(1.75, 1.25, 14, 2), 0.08, 5);
  g.add(mesh(roof1, mat(0xe6c068, { rough: 0.85 }), 0, 2.55, 0));
  const roof2 = wobble(new ConeGeometry(1.25, 0.9, 12, 1), 0.06, 6);
  g.add(mesh(roof2, mat(0xd4a94f, { rough: 0.85 }), 0, 2.95, 0));
  g.add(mesh(new SphereGeometry(0.12, 8, 6), mat(0xc0563d), 0, 3.42, 0));
  // little steps
  g.add(mesh(new BoxGeometry(0.6, 0.1, 0.35), mat(0xa77445), 0, 0.42, 1.45));
  g.add(mesh(new BoxGeometry(0.6, 0.1, 0.35), mat(0xa77445), 0, 0.18, 1.75));
  return g;
}

// ---------------------------------------------------------------- pier
export function makePier(snow = false): Group {
  const g = new Group();
  const plank = mat(snow ? 0x9b7a5e : 0xb98352, { rough: 0.8 });
  const plank2 = mat(snow ? 0x8a6c52 : 0xa87245, { rough: 0.8 });
  const r = rng(snow ? 17 : 13);
  for (let i = 0; i < 12; i++) {
    const p = mesh(new BoxGeometry(1.5, 0.1, 0.32), i % 2 ? plank : plank2, 0, 0.55, i * 0.36);
    p.rotation.y = (r() - 0.5) * 0.04;
    g.add(p);
    if (snow) g.add(mesh(new BoxGeometry(1.42, 0.04, 0.26), mat(0xf4f8ff, { rough: 0.9 }), 0, 0.62, i * 0.36));
  }
  for (let i = 0; i < 4; i++) {
    for (const x of [-0.7, 0.7]) {
      g.add(mesh(new CylinderGeometry(0.09, 0.1, 2.2, 8), mat(0x6e4a2c), x, -0.3 + (i === 0 ? 0.0 : 0), i * 1.3 + 0.1));
    }
  }
  // lantern post at the end
  const post = mesh(new CylinderGeometry(0.05, 0.05, 1.1, 6), mat(0x4a3324), 0.62, 1.1, 4.0);
  g.add(post);
  const glow = mat(0xffe2a0, { emissive: 0xffb347, ei: 0.4 });
  glow.name = 'lantern';
  g.add(mesh(new SphereGeometry(0.13, 10, 8), glow, 0.62, 1.72, 4.0, false));
  return g;
}

// ---------------------------------------------------------------- lighthouse
export function makeLighthouse(): Group {
  const g = new Group();
  // stone base
  g.add(mesh(wobble(new CylinderGeometry(1.25, 1.45, 0.6, 12, 1), 0.06, 3), mat(0x9aa3ad, { rough: 0.9 }), 0, 0.3, 0));
  // tower: lathe with stripes
  const prof: Vector2[] = [];
  for (let i = 0; i <= 12; i++) prof.push(new Vector2(0.95 - i * 0.03, 0.6 + i * 0.36));
  const tower = new LatheGeometry(prof, 24);
  const tc: number[] = [];
  const tp = tower.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const band = Math.floor((tp.getY(i) - 0.6) / 1.08 + 0.001) % 2;
    const c = new Color(band ? 0xe0463d : 0xfaf6ee);
    tc.push(c.r, c.g, c.b);
  }
  // hard stripe edges: duplicate rows at band boundaries are approximated by many rows
  tower.setAttribute('color', new Float32BufferAttribute(tc, 3));
  g.add(mesh(tower, new MeshStandardMaterial({ vertexColors: true, roughness: 0.4 })));
  // gallery
  g.add(mesh(new CylinderGeometry(0.95, 0.85, 0.14, 20), mat(0x2f3b4c, { rough: 0.5 }), 0, 4.98, 0));
  g.add(mesh(new TorusGeometry(0.9, 0.03, 6, 28), mat(0x2f3b4c), 0, 5.32, 0).rotateX(Math.PI / 2));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.add(mesh(new CylinderGeometry(0.02, 0.02, 0.34, 4), mat(0x2f3b4c), Math.cos(a) * 0.9, 5.15, Math.sin(a) * 0.9));
  }
  // lantern room
  const glass = new MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd36b, emissiveIntensity: 0.15, roughness: 0.1, transparent: true, opacity: 0.85 });
  glass.name = 'lamp';
  g.add(mesh(new CylinderGeometry(0.55, 0.55, 0.75, 12), glass, 0, 5.45, 0, false));
  g.add(mesh(new SphereGeometry(0.62, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe0463d, { rough: 0.35 }), 0, 5.82, 0));
  g.add(mesh(new SphereGeometry(0.09, 8, 6), mat(0x2f3b4c), 0, 6.45, 0));
  // door
  g.add(mesh(new BoxGeometry(0.42, 0.75, 0.1), mat(0x4a6a8c), 0, 0.95, 0.92));
  // rotating beam (visible at night): soft additive cone fading along its length and at its edges
  const beamGeo = new ConeGeometry(1.8, 14, 24, 1, true);
  beamGeo.translate(0, -7, 0);
  beamGeo.rotateZ(Math.PI / 2);
  const beamMat = new ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uOpacity; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float along = pow(vUv.y, 1.6);
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.7), along * edge * uOpacity);
      }`,
  });
  beamMat.name = 'beam';
  const beam = new Group();
  beam.name = 'beam';
  const b1 = new Mesh(beamGeo, beamMat);
  const b2 = new Mesh(beamGeo, beamMat);
  b2.rotation.y = Math.PI;
  beam.add(b1, b2);
  beam.position.y = 5.45;
  g.add(beam);
  const light = new PointLight(0xffd27a, 0, 18, 1.6);
  light.name = 'lampLight';
  light.position.y = 5.45;
  g.add(light);
  return g;
}

// ---------------------------------------------------------------- winter cabin
export function makeCabin(): Group {
  const g = new Group();
  const log = mat(0x9a6438, { rough: 0.7 });
  const logD = mat(0x86552e, { rough: 0.7 });
  const W = 2.4, D = 1.9;
  for (let i = 0; i < 6; i++) {
    const y = 0.18 + i * 0.27;
    const m = i % 2 ? log : logD;
    g.add(mesh(new CylinderGeometry(0.15, 0.15, W + 0.4, 8), m, 0, y, D / 2).rotateZ(Math.PI / 2));
    g.add(mesh(new CylinderGeometry(0.15, 0.15, W + 0.4, 8), m, 0, y, -D / 2).rotateZ(Math.PI / 2));
    g.add(mesh(new CylinderGeometry(0.15, 0.15, D + 0.4, 8), m, W / 2, y + 0.13, 0).rotateX(Math.PI / 2));
    g.add(mesh(new CylinderGeometry(0.15, 0.15, D + 0.4, 8), m, -W / 2, y + 0.13, 0).rotateX(Math.PI / 2));
  }
  g.add(mesh(new BoxGeometry(W, 1.6, D), mat(0x7a4a28), 0, 0.85, 0));
  // gable roof with snow
  for (const s of [-1, 1]) {
    const roof = mesh(new BoxGeometry(W + 0.7, 0.14, 1.45), mat(0x6b3b2a, { rough: 0.6 }), 0, 2.15, s * 0.55);
    roof.rotation.x = s * 0.62;
    g.add(roof);
    const snow = mesh(wobble(new BoxGeometry(W + 0.8, 0.16, 1.5, 6, 1, 3), 0.05, 9 + s), mat(0xf6f9ff, { rough: 0.95 }), 0, 2.27, s * 0.6);
    snow.rotation.x = s * 0.62;
    g.add(snow);
  }
  // gable triangles
  const tri = new BufferGeometry();
  tri.setAttribute('position', new Float32BufferAttribute([-W / 2, 0, 0, W / 2, 0, 0, 0, 0.75, 0], 3));
  tri.computeVertexNormals();
  for (const z of [D / 2 + 0.01, -D / 2 - 0.01]) g.add(mesh(tri, mat(0x86552e, { side: true }), 0, 1.65, z));
  // chimney
  g.add(mesh(new BoxGeometry(0.4, 1.1, 0.4), mat(0x8c8f99, { rough: 0.9 }), 0.7, 2.5, -0.45));
  g.add(mesh(new BoxGeometry(0.48, 0.12, 0.48), mat(0xf6f9ff, { rough: 0.95 }), 0.7, 3.08, -0.45));
  // warm windows & door
  const win = mat(0x3a2a1a, { emissive: 0xffb347, ei: 0.2 });
  win.name = 'window';
  g.add(mesh(new BoxGeometry(0.5, 0.45, 0.06), win, -0.6, 1.0, D / 2 + 0.16));
  g.add(mesh(new BoxGeometry(0.06, 0.45, 0.5), win, W / 2 + 0.16, 1.0, 0));
  g.add(mesh(new BoxGeometry(0.55, 0.95, 0.06), mat(0x5a3820), 0.45, 0.6, D / 2 + 0.16));
  const smoke = new Object3D();
  smoke.name = 'smoke';
  smoke.position.set(0.7, 3.2, -0.45);
  g.add(smoke);
  return g;
}

// ---------------------------------------------------------------- campfire
export function makeCampfire(): Group {
  const g = new Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.add(mesh(new DodecahedronGeometry(0.16, 0), mat(0x8d939c, { rough: 0.9 }), Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55));
  }
  for (let i = 0; i < 3; i++) {
    const l = mesh(new CylinderGeometry(0.07, 0.07, 0.9, 6), mat(0x6b4226), 0, 0.14, 0);
    l.rotation.set(Math.PI / 2 - 0.25, (i / 3) * Math.PI, 0);
    g.add(l);
  }
  const flame = new Group();
  flame.name = 'flame';
  const f1 = new Mesh(new ConeGeometry(0.28, 0.75, 8), new MeshBasicMaterial({ color: 0xff8a2b }));
  f1.position.y = 0.45;
  const f2 = new Mesh(new ConeGeometry(0.16, 0.5, 8), new MeshBasicMaterial({ color: 0xffe066 }));
  f2.position.y = 0.38;
  flame.add(f1, f2);
  g.add(flame);
  const light = new PointLight(0xff9a3c, 3, 9, 1.5);
  light.name = 'fireLight';
  light.position.y = 0.8;
  g.add(light);
  // logs to sit on
  for (const s of [-1, 1]) g.add(mesh(new CylinderGeometry(0.16, 0.16, 1.1, 8), mat(0x8a5a36), s * 1.2, 0.16, 0.3).rotateX(Math.PI / 2).rotateZ(0.3 * s));
  return g;
}

// ---------------------------------------------------------------- snowman
export function makeSnowman(): Group {
  const g = new Group();
  const snow = mat(0xf7fbff, { rough: 0.85 });
  g.add(mesh(new SphereGeometry(0.62, 18, 14), snow, 0, 0.5, 0));
  g.add(mesh(new SphereGeometry(0.45, 18, 14), snow, 0, 1.2, 0));
  g.add(mesh(new SphereGeometry(0.32, 18, 14), snow, 0, 1.75, 0));
  g.add(mesh(new ConeGeometry(0.07, 0.4, 8), mat(0xff7a1a), 0, 1.75, 0.45).rotateX(Math.PI / 2));
  for (const x of [-0.11, 0.11]) g.add(mesh(new SphereGeometry(0.04, 6, 6), mat(0x222222), x, 1.85, 0.28));
  for (const y of [1.1, 1.3]) g.add(mesh(new SphereGeometry(0.05, 6, 6), mat(0x222222), 0, y, 0.44));
  g.add(mesh(new CylinderGeometry(0.22, 0.22, 0.32, 14), mat(0x2b2f3a, { rough: 0.5 }), 0, 2.16, 0));
  g.add(mesh(new CylinderGeometry(0.34, 0.34, 0.04, 14), mat(0x2b2f3a, { rough: 0.5 }), 0, 2.01, 0));
  g.add(mesh(new TorusGeometry(0.3, 0.07, 8, 16), mat(0xd94848), 0, 1.5, 0).rotateX(Math.PI / 2));
  for (const s of [-1, 1]) {
    const arm = mesh(new CylinderGeometry(0.025, 0.035, 0.75, 5), mat(0x6b4226), s * 0.65, 1.35, 0);
    arm.rotation.z = s * 1.0;
    g.add(arm);
  }
  return g;
}

// ---------------------------------------------------------------- animals
export function makePenguin(): Group {
  const g = new Group();
  const body = mesh(new SphereGeometry(0.32, 16, 12), mat(0x1f2633, { rough: 0.35 }), 0, 0.42, 0);
  body.scale.set(1, 1.35, 0.95);
  g.add(body);
  const belly = mesh(new SphereGeometry(0.27, 16, 12), mat(0xfafafa, { rough: 0.4 }), 0, 0.4, 0.09);
  belly.scale.set(0.9, 1.25, 0.9);
  g.add(belly);
  g.add(mesh(new SphereGeometry(0.21, 14, 10), mat(0x1f2633, { rough: 0.35 }), 0, 0.92, 0.02));
  g.add(mesh(new ConeGeometry(0.06, 0.18, 6), mat(0xffa21f), 0, 0.9, 0.24).rotateX(Math.PI / 2));
  for (const x of [-0.08, 0.08]) g.add(mesh(new SphereGeometry(0.03, 6, 6), mat(0xffffff), x, 0.98, 0.17));
  for (const x of [-0.1, 0.1]) g.add(mesh(new BoxGeometry(0.12, 0.04, 0.18), mat(0xffa21f), x, 0.02, 0.08));
  for (const s of [-1, 1]) {
    const w = mesh(new SphereGeometry(0.12, 8, 6), mat(0x1f2633), s * 0.3, 0.5, 0);
    w.scale.set(0.35, 1.4, 0.8);
    w.rotation.z = s * 0.25;
    w.name = s < 0 ? 'wingL' : 'wingR';
    g.add(w);
  }
  return g;
}

export function makeCrab(): Group {
  const g = new Group();
  const red = mat(0xf0573b, { rough: 0.35 });
  const body = mesh(new SphereGeometry(0.3, 14, 10), red, 0, 0.22, 0);
  body.scale.set(1.3, 0.6, 1);
  g.add(body);
  for (const x of [-0.1, 0.1]) {
    g.add(mesh(new CylinderGeometry(0.02, 0.02, 0.18, 5), red, x, 0.38, 0.12));
    g.add(mesh(new SphereGeometry(0.05, 8, 6), mat(0xffffff), x, 0.48, 0.12));
    g.add(mesh(new SphereGeometry(0.025, 6, 6), mat(0x111111), x, 0.49, 0.16));
  }
  for (const s of [-1, 1]) {
    const claw = mesh(new SphereGeometry(0.12, 10, 8), red, s * 0.48, 0.28, 0.18);
    claw.scale.set(1, 0.8, 0.7);
    claw.name = s < 0 ? 'clawL' : 'clawR';
    g.add(claw);
    for (let i = 0; i < 3; i++) {
      const leg = mesh(new CylinderGeometry(0.02, 0.02, 0.3, 4), red, s * 0.38, 0.1, -0.12 + i * 0.12);
      leg.rotation.z = s * 1.0;
      g.add(leg);
    }
  }
  return g;
}

export function makeGull(): Group {
  const g = new Group();
  const white = mat(0xffffff, { rough: 0.5 });
  const body = mesh(new SphereGeometry(0.16, 10, 8), white, 0, 0, 0, false);
  body.scale.set(0.8, 0.7, 1.8);
  g.add(body);
  g.add(mesh(new ConeGeometry(0.04, 0.14, 6), mat(0xffb020), 0, 0.02, 0.33, false).rotateX(Math.PI / 2));
  for (const s of [-1, 1]) {
    const wing = new Group();
    wing.name = s < 0 ? 'wingL' : 'wingR';
    const w = mesh(new BoxGeometry(0.6, 0.02, 0.2), white, s * 0.3, 0, 0, false);
    const tip = mesh(new BoxGeometry(0.2, 0.02, 0.14), mat(0x5c6470), s * 0.65, 0, -0.02, false);
    wing.add(w, tip);
    g.add(wing);
  }
  return g;
}

/** A small rounded rock for decoration. */
export function makePebble(color = 0x9aa1a8, seed = 1): Mesh {
  const geo = wobble(new IcosahedronGeometry(0.3, 1), 0.12, seed);
  const m = mesh(geo, mat(color, { rough: 0.85 }));
  m.scale.y = 0.6;
  return m;
}

export function makeLanternPost(): Group {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.05, 0.06, 1.3, 6), mat(0x3a3f4a), 0, 0.65, 0));
  const glow = mat(0xfff0c0, { emissive: 0xffb347, ei: 1.6 });
  glow.name = 'lantern';
  g.add(mesh(new BoxGeometry(0.2, 0.26, 0.2), glow, 0, 1.38, 0, false));
  g.add(mesh(new ConeGeometry(0.18, 0.14, 4), mat(0x3a3f4a), 0, 1.58, 0).rotateY(Math.PI / 4));
  return g;
}
