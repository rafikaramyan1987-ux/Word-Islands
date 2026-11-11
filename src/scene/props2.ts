/**
 * Hand-modelled props for islands 3-8 (same rounded low-poly, flat-colour style as props.ts):
 * windmill, sheep, fences, hay, well, cacti, sandstone arch, tent, pots, oasis, hot-air balloon,
 * pumpkins, fox, treehouse, glowing mushrooms, gazebo, fountain, swans, bench, volcano, flamingos.
 */
import {
  BoxGeometry, BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry,
  Float32BufferAttribute, Group, IcosahedronGeometry, LatheGeometry, Mesh, MeshStandardMaterial,
  Object3D, PointLight, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3, CatmullRomCurve3,
} from 'three';
import { rng } from '../core/crossword';
import { mat, mesh, wobble } from './props';

function vcolor(geo: BufferGeometry, fn: (x: number, y: number, z: number) => number) {
  const p = geo.attributes.position;
  const cols: number[] = [];
  const c = new Color();
  for (let i = 0; i < p.count; i++) {
    c.setHex(fn(p.getX(i), p.getY(i), p.getZ(i)));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  return geo;
}
const vmat = (rough = 0.6) => new MeshStandardMaterial({ vertexColors: true, roughness: rough });

// ---------------------------------------------------------------- meadow
export function makeWindmill(): Group {
  const g = new Group();
  const prof: Vector2[] = [];
  for (let i = 0; i <= 10; i++) prof.push(new Vector2(1.35 - i * 0.055, i * 0.42));
  const tower = vcolor(new LatheGeometry(prof, 20), (_x, y) => (y < 0.5 ? 0xb9aa94 : 0xf4ecdc));
  g.add(mesh(tower, vmat(0.7)));
  g.add(mesh(new BoxGeometry(0.6, 0.95, 0.12), mat(0x7a5232), 0, 0.5, 1.3));
  for (const y of [1.9, 3.0]) g.add(mesh(new BoxGeometry(0.42, 0.42, 0.1), mat(0x5b8fb0, { rough: 0.25, emissive: 0xffc46b, ei: 0 }), 0, y, 1.15 - y * 0.05));
  g.add(mesh(wobble(new ConeGeometry(1.25, 1.4, 16, 2), 0.04, 21), mat(0xc4573e, { rough: 0.5 }), 0, 4.85, 0));
  const hub = new Group();
  hub.name = 'spin';
  hub.position.set(0, 4.35, 1.05);
  hub.add(mesh(new CylinderGeometry(0.18, 0.18, 0.3, 10), mat(0x5a3d26), 0, 0, 0).rotateX(Math.PI / 2));
  for (let i = 0; i < 4; i++) {
    const arm = new Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(mesh(new BoxGeometry(0.12, 2.6, 0.08), mat(0x8a5a36), 0, 1.4, 0.12));
    const sail = mesh(new BoxGeometry(0.62, 2.0, 0.03), mat(0xfff7e6, { rough: 0.7 }), 0.38, 1.6, 0.14);
    arm.add(sail);
    for (let k = 0; k < 4; k++) arm.add(mesh(new BoxGeometry(0.66, 0.04, 0.05), mat(0x8a5a36), 0.38, 0.75 + k * 0.55, 0.17));
    hub.add(arm);
  }
  g.add(hub);
  return g;
}

export function makeSheep(): Group {
  const g = new Group();
  const wool = mat(0xfbf8f2, { rough: 0.95 });
  const r = rng(77);
  for (let i = 0; i < 9; i++) g.add(mesh(new IcosahedronGeometry(0.26 + r() * 0.08, 1), wool, (r() - 0.5) * 0.5, 0.62 + (r() - 0.5) * 0.2, (r() - 0.5) * 0.7));
  const head = mesh(new SphereGeometry(0.2, 12, 10), mat(0x3b3330, { rough: 0.6 }), 0, 0.7, 0.55);
  head.scale.set(0.9, 1, 1.2);
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = mesh(new SphereGeometry(0.08, 8, 6), mat(0x3b3330), s * 0.2, 0.8, 0.48);
    ear.scale.set(1.6, 0.6, 1);
    g.add(ear);
  }
  for (const [x, z] of [[-0.18, -0.25], [0.18, -0.25], [-0.18, 0.25], [0.18, 0.25]]) g.add(mesh(new CylinderGeometry(0.05, 0.05, 0.42, 6), mat(0x3b3330), x, 0.21, z));
  g.add(mesh(new SphereGeometry(0.11, 8, 6), wool, 0, 0.92, 0.48));
  return g;
}

export function makeFence(len = 3): Group {
  const g = new Group();
  const wood = mat(0xc69a63, { rough: 0.8 });
  const n = Math.round(len / 0.75);
  for (let i = 0; i <= n; i++) g.add(mesh(new BoxGeometry(0.12, 0.8, 0.12), wood, -len / 2 + (i * len) / n, 0.4, 0));
  for (const y of [0.35, 0.65]) g.add(mesh(new BoxGeometry(len + 0.1, 0.09, 0.06), wood, 0, y, 0.05));
  return g;
}

export function makeHayBale(): Group {
  const g = new Group();
  const b = mesh(new CylinderGeometry(0.55, 0.55, 0.9, 18), mat(0xe8c15a, { rough: 0.9 }), 0, 0.55, 0);
  b.rotation.z = Math.PI / 2;
  g.add(b);
  for (const x of [-0.46, 0.46]) g.add(mesh(new CircleGeometry(0.5, 18), mat(0xd9ab3f, { rough: 0.95, side: true }), x, 0.55, 0).rotateY(Math.PI / 2));
  g.add(mesh(new TorusGeometry(0.56, 0.025, 4, 20), mat(0xb5843a), 0, 0.55, 0).rotateY(Math.PI / 2));
  return g;
}

export function makeWell(): Group {
  const g = new Group();
  g.add(mesh(wobble(new CylinderGeometry(0.75, 0.8, 0.8, 14, 1, true), 0.04, 31), mat(0xa9a29a, { rough: 0.9, side: true }), 0, 0.4, 0));
  g.add(mesh(new CircleGeometry(0.72, 14), mat(0x3d79a8, { rough: 0.15 }), 0, 0.55, 0).rotateX(-Math.PI / 2));
  for (const x of [-0.7, 0.7]) g.add(mesh(new BoxGeometry(0.12, 1.6, 0.12), mat(0x8a5a36), x, 1.2, 0));
  for (const s of [-1, 1]) {
    const r = mesh(new BoxGeometry(1.9, 0.08, 0.75), mat(0xb4553f, { rough: 0.5 }), 0, 2.15, s * 0.27);
    r.rotation.x = s * 0.6;
    g.add(r);
  }
  g.add(mesh(new CylinderGeometry(0.07, 0.07, 1.4, 8), mat(0x6b4226), 0, 1.6, 0).rotateZ(Math.PI / 2));
  g.add(mesh(new CylinderGeometry(0.15, 0.12, 0.22, 10), mat(0x8a5a36), 0, 1.1, 0));
  return g;
}

export function makeFlowerBed(seed = 1, colors = [0xff6b8b, 0xffd23f, 0xffffff, 0xb07cff]): Group {
  const g = new Group();
  const r = rng(seed);
  g.add(mesh(wobble(new SphereGeometry(0.9, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0.05, seed), mat(0x5aa83a, { rough: 0.9 }), 0, -0.25, 0));
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.75;
    const f = mesh(new IcosahedronGeometry(0.1, 0), mat(colors[i % colors.length], { rough: 0.5 }), Math.cos(a) * d, 0.42 + r() * 0.15, Math.sin(a) * d, false);
    g.add(f);
  }
  return g;
}

// ---------------------------------------------------------------- desert
export function makeCactus(seed = 1): Group {
  const g = new Group();
  const green = mat(0x4f9a4a, { rough: 0.5 });
  const capsule = (r: number, h: number) => {
    const prof: Vector2[] = [];
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; prof.push(new Vector2(Math.cos(a) * r, h + Math.sin(a) * r)); }
    prof.unshift(new Vector2(r, 0));
    const geo = new LatheGeometry(prof, 12);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { // ribs
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const k = 1 + 0.08 * Math.cos(a * 8);
      p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    return geo;
  };
  g.add(mesh(capsule(0.32, 1.9), green));
  const r = rng(seed);
  for (const s of [-1, 1]) {
    if (r() < 0.25) continue;
    const h = 0.7 + r() * 0.6;
    const arm = new Group();
    arm.add(mesh(new CylinderGeometry(0.17, 0.17, 0.5, 10), green, s * 0.4, h, 0).rotateZ(Math.PI / 2));
    arm.add(mesh(capsule(0.17, 0.5 + r() * 0.4), green, s * 0.62, h, 0));
    g.add(arm);
  }
  g.add(mesh(new IcosahedronGeometry(0.13, 0), mat(0xff6fa8), 0, 2.25, 0));
  return g;
}

export function makeArch(): Group {
  const g = new Group();
  const geo = wobble(new TorusGeometry(2.1, 0.55, 8, 18, Math.PI), 0.12, 41);
  vcolor(geo, (_x, y) => (y > 1.7 ? 0xe58a4e : y > 0.9 ? 0xd9733f : 0xc6623a));
  const arch = mesh(geo, vmat(0.85));
  arch.scale.set(1, 1.25, 0.9);
  g.add(arch);
  for (const x of [-2.1, 2.1]) g.add(mesh(wobble(new CylinderGeometry(0.75, 0.85, 0.6, 9), 0.08, 3), mat(0xc6623a, { rough: 0.9 }), x, 0.1, 0));
  return g;
}

export function makeTent(): Group {
  const g = new Group();
  const geo = vcolor(new ConeGeometry(1.5, 2.2, 12, 1), (x, _y, z) => (Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 12) % 2 ? 0xf6efe0 : 0xd9534f));
  geo.computeVertexNormals();
  g.add(mesh(geo, vmat(0.7), 0, 1.1, 0));
  g.add(mesh(new BoxGeometry(0.7, 1.0, 0.05), mat(0x5a3820), 0, 0.5, 1.24).rotateX(-0.45));
  g.add(mesh(new CylinderGeometry(0.03, 0.03, 0.6, 6), mat(0x6b4226), 0, 2.4, 0));
  const flag = mesh(new BoxGeometry(0.02, 0.2, 0.35), mat(0xffc93c), 0, 2.6, 0.17);
  flag.name = 'flag';
  g.add(flag);
  return g;
}

export function makePots(): Group {
  const g = new Group();
  const prof = [new Vector2(0.0, 0), new Vector2(0.22, 0.02), new Vector2(0.36, 0.3), new Vector2(0.32, 0.58), new Vector2(0.16, 0.72), new Vector2(0.2, 0.82)];
  [[0, 0, 1], [0.6, 0.2, 0.7], [-0.45, 0.35, 0.8]].forEach(([x, z, s], i) => {
    const m = mesh(new LatheGeometry(prof, 14), mat(i === 1 ? 0x3b7fb3 : 0xc8673d, { rough: 0.55 }), x, 0, z);
    m.scale.setScalar(s);
    g.add(m);
  });
  return g;
}

export function makeOasis(): Group {
  const g = new Group();
  const pond = mesh(new CircleGeometry(1.6, 24), mat(0x2fb8c4, { rough: 0.1, metal: 0.1 }), 0, 0.06, 0);
  pond.rotation.x = -Math.PI / 2;
  pond.receiveShadow = true;
  g.add(pond);
  g.add(mesh(new TorusGeometry(1.6, 0.12, 6, 24), mat(0xd9b26a, { rough: 0.9 }), 0, 0.05, 0).rotateX(Math.PI / 2));
  const r = rng(5);
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2;
    g.add(mesh(new ConeGeometry(0.05, 0.7 + r() * 0.5, 4), mat(0x5b9a3a), Math.cos(a) * 1.6, 0.35, Math.sin(a) * 1.6));
  }
  return g;
}

// ---------------------------------------------------------------- autumn
export function makeBalloon(): Group {
  const g = new Group();
  const float = new Group();
  float.name = 'float';
  const prof: Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const a = -Math.PI / 2 + t * Math.PI;
    const r = Math.cos(a) * 1.5 * (t < 0.3 ? 0.55 + t * 1.5 : 1);
    prof.push(new Vector2(Math.max(0.25, r), 1.5 + Math.sin(a) * 1.7));
  }
  const env = vcolor(new LatheGeometry(prof, 16), (x, _y, z) => [0xff6b4a, 0xffc93c, 0x4fb3e8, 0xfff4e0][Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 16) % 4]);
  env.computeVertexNormals();
  float.add(mesh(env, vmat(0.45), 0, 2.4, 0));
  float.add(mesh(new BoxGeometry(0.8, 0.55, 0.8), mat(0x9a6a3a, { rough: 0.8 }), 0, 0.3, 0));
  for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) {
    const rope = mesh(new CylinderGeometry(0.015, 0.015, 1.5, 4), mat(0x5a3d26), x * 0.9, 1.25, z * 0.9);
    g.add(rope);
    float.add(rope);
  }
  g.add(float);
  g.add(mesh(new CylinderGeometry(0.1, 0.12, 0.3, 8), mat(0x7a5232), 0.9, 0.15, 0.9));
  return g;
}

export function makePumpkin(seed = 1): Group {
  const g = new Group();
  const geo = new SphereGeometry(0.42, 20, 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const k = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * 4)), 3);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * 0.72, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const r = rng(seed);
  g.add(mesh(geo, mat(r() < 0.5 ? 0xf28a1e : 0xe9761a, { rough: 0.45 }), 0, 0.3, 0));
  g.add(mesh(new CylinderGeometry(0.04, 0.06, 0.2, 6), mat(0x5b7a2e), 0, 0.66, 0).rotateZ(0.3));
  return g;
}

export function makeFox(): Group {
  const g = new Group();
  const orange = mat(0xe8742c, { rough: 0.6 });
  const body = mesh(new SphereGeometry(0.3, 14, 10), orange, 0, 0.42, 0);
  body.scale.set(0.8, 0.8, 1.4);
  g.add(body);
  g.add(mesh(new SphereGeometry(0.22, 12, 10), orange, 0, 0.72, 0.38));
  g.add(mesh(new ConeGeometry(0.12, 0.3, 8), orange, 0, 0.66, 0.6).rotateX(Math.PI / 2));
  g.add(mesh(new SphereGeometry(0.04, 6, 6), mat(0x222222), 0, 0.68, 0.76));
  for (const s of [-1, 1]) g.add(mesh(new ConeGeometry(0.08, 0.2, 4), orange, s * 0.12, 0.95, 0.36));
  const chest = mesh(new SphereGeometry(0.17, 10, 8), mat(0xfff4e6), 0, 0.5, 0.3);
  g.add(chest);
  for (const [x, z] of [[-0.12, -0.25], [0.12, -0.25], [-0.12, 0.25], [0.12, 0.25]]) g.add(mesh(new CylinderGeometry(0.04, 0.04, 0.3, 6), mat(0x3a2a20), x, 0.15, z));
  const tail = new Group();
  tail.name = 'tail';
  tail.position.set(0, 0.5, -0.4);
  const t1 = mesh(new SphereGeometry(0.16, 10, 8), orange, 0, 0.1, -0.25);
  t1.scale.set(1, 1, 2);
  tail.add(t1, mesh(new SphereGeometry(0.1, 8, 6), mat(0xfff4e6), 0, 0.14, -0.55));
  g.add(tail);
  return g;
}

export function makeLeafPile(seed = 2): Group {
  const g = new Group();
  const geo = wobble(new SphereGeometry(0.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0.12, seed);
  vcolor(geo, (x, y) => (Math.sin(x * 9 + y * 7) > 0.3 ? 0xd9532b : Math.sin(x * 5) > 0 ? 0xf2a33a : 0xc9772a));
  const m = mesh(geo, vmat(0.9));
  m.scale.y = 0.55;
  g.add(m);
  return g;
}

// ---------------------------------------------------------------- firefly lagoon
export function makeTreehouse(): Group {
  const g = new Group();
  const trunk = mesh(wobble(new CylinderGeometry(0.45, 0.8, 4.2, 10, 3), 0.08, 51), mat(0x7a5232, { rough: 0.85 }), 0, 2.1, 0);
  g.add(trunk);
  const leaf = [0x2f7a4c, 0x3f9c5a, 0x2a6a46];
  const r = rng(9);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(mesh(new IcosahedronGeometry(1.0 + r() * 0.4, 1), mat(leaf[i % 3], { rough: 0.8 }), Math.cos(a) * 1.3, 5.0 + r() * 0.8, Math.sin(a) * 1.3));
  }
  g.add(mesh(new IcosahedronGeometry(1.5, 1), mat(leaf[1], { rough: 0.8 }), 0, 6.0, 0));
  g.add(mesh(new CylinderGeometry(1.6, 1.6, 0.14, 12), mat(0xb98352, { rough: 0.8 }), 0, 2.8, 0));
  g.add(mesh(new BoxGeometry(1.6, 1.1, 1.3), mat(0xd9a46a, { rough: 0.7 }), 0.2, 3.42, 0.3));
  for (const s of [-1, 1]) {
    const rr = mesh(new BoxGeometry(1.9, 0.08, 0.95), mat(0x6b8f4a, { rough: 0.7 }), 0.2, 4.15, 0.3 + s * 0.35);
    rr.rotation.x = s * 0.55;
    g.add(rr);
  }
  const win = mat(0x3a2a1a, { emissive: 0xffc46b, ei: 0.3 });
  win.name = 'window';
  g.add(mesh(new BoxGeometry(0.42, 0.36, 0.05), win, 0.2, 3.5, 0.96));
  for (let i = 0; i < 7; i++) g.add(mesh(new BoxGeometry(0.5, 0.05, 0.08), mat(0x8a5a36), 1.1, 0.2 + i * 0.4, 1.0));
  for (const x of [0.88, 1.32]) g.add(mesh(new BoxGeometry(0.05, 2.8, 0.05), mat(0x8a5a36), x, 1.4, 1.0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const glow = mat(0xfff0b0, { emissive: 0xffb347, ei: 1.5 });
    glow.name = 'lantern';
    g.add(mesh(new SphereGeometry(0.09, 8, 6), glow, Math.cos(a) * 1.5, 2.65, Math.sin(a) * 1.5, false));
  }
  const l = new PointLight(0xffb86b, 0, 10, 1.6);
  l.position.set(0.2, 3.5, 1.4);
  g.add(l);
  return g;
}

export function makeGlowMushrooms(seed = 1, color = 0x5ff2e8): Group {
  const g = new Group();
  const r = rng(seed);
  for (let i = 0; i < 4; i++) {
    const s = 0.5 + r() * 0.6;
    const x = (r() - 0.5) * 0.8, z = (r() - 0.5) * 0.8;
    g.add(mesh(new CylinderGeometry(0.05 * s, 0.07 * s, 0.5 * s, 6), mat(0xf2eadc), x, 0.25 * s, z));
    const cap = mat(color, { emissive: color, ei: 0.6, rough: 0.4 });
    cap.name = 'lantern';
    g.add(mesh(new SphereGeometry(0.22 * s, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), cap, x, 0.48 * s, z, false));
  }
  return g;
}

// ---------------------------------------------------------------- blossom
export function makeGazebo(): Group {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(1.7, 1.8, 0.3, 6), mat(0xf2ece2, { rough: 0.6 }), 0, 0.15, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(mesh(new CylinderGeometry(0.09, 0.1, 2.2, 8), mat(0xffffff, { rough: 0.4 }), Math.cos(a) * 1.45, 1.4, Math.sin(a) * 1.45));
  }
  g.add(mesh(new CylinderGeometry(1.75, 1.75, 0.18, 6), mat(0xffffff, { rough: 0.4 }), 0, 2.55, 0));
  g.add(mesh(wobble(new ConeGeometry(2.1, 1.4, 6, 1), 0.03, 7), mat(0xe87fa8, { rough: 0.45 }), 0, 3.3, 0));
  g.add(mesh(new SphereGeometry(0.14, 10, 8), mat(0xffd23f, { rough: 0.3, metal: 0.3 }), 0, 4.08, 0));
  const lamp = mat(0xfff0c8, { emissive: 0xffc46b, ei: 0.3 });
  lamp.name = 'lantern';
  g.add(mesh(new SphereGeometry(0.2, 10, 8), lamp, 0, 2.2, 0, false));
  return g;
}

export function makeFountain(): Group {
  const g = new Group();
  const stone = mat(0xd9d4cc, { rough: 0.7 });
  g.add(mesh(new CylinderGeometry(1.1, 1.2, 0.4, 18), stone, 0, 0.2, 0));
  g.add(mesh(new CylinderGeometry(0.98, 0.98, 0.05, 18), mat(0x5ec4e8, { rough: 0.1 }), 0, 0.38, 0));
  g.add(mesh(new CylinderGeometry(0.12, 0.18, 1.0, 10), stone, 0, 0.8, 0));
  g.add(mesh(new CylinderGeometry(0.5, 0.25, 0.18, 14), stone, 0, 1.3, 0));
  const water = new MeshStandardMaterial({ color: 0xa8e6ff, transparent: true, opacity: 0.6, roughness: 0.1 });
  const spray = new Mesh(new ConeGeometry(0.45, 0.7, 14, 1, true), water);
  spray.position.y = 1.15;
  spray.rotation.x = Math.PI;
  spray.name = 'spray';
  g.add(spray);
  return g;
}

export function makeSwan(): Group {
  const g = new Group();
  const white = mat(0xffffff, { rough: 0.45 });
  const body = mesh(new SphereGeometry(0.3, 14, 10), white, 0, 0.18, 0);
  body.scale.set(0.8, 0.6, 1.3);
  g.add(body);
  const curve = new CatmullRomCurve3([new Vector3(0, 0.25, 0.25), new Vector3(0, 0.55, 0.35), new Vector3(0, 0.8, 0.22), new Vector3(0, 0.88, 0.35)]);
  g.add(mesh(new TubeGeometry(curve, 12, 0.06, 6), white));
  g.add(mesh(new ConeGeometry(0.04, 0.16, 6), mat(0xff8c2a), 0, 0.86, 0.48).rotateX(Math.PI / 2));
  return g;
}

export function makeBench(): Group {
  const g = new Group();
  const wood = mat(0xb07a4a, { rough: 0.7 });
  for (let i = 0; i < 3; i++) g.add(mesh(new BoxGeometry(1.5, 0.06, 0.14), wood, 0, 0.45, -0.16 + i * 0.16));
  for (let i = 0; i < 2; i++) g.add(mesh(new BoxGeometry(1.5, 0.12, 0.05), wood, 0, 0.72 + i * 0.18, -0.26).rotateX(-0.15));
  for (const x of [-0.65, 0.65]) g.add(mesh(new BoxGeometry(0.07, 0.45, 0.4), mat(0x3a3f4a), x, 0.22, -0.05));
  return g;
}

export function makeBlossomTree(seed = 1): Group {
  const g = new Group();
  const r = rng(seed);
  g.add(mesh(wobble(new CylinderGeometry(0.16, 0.26, 2.0, 8, 2), 0.06, seed), mat(0x6b4a3a, { rough: 0.85 }), 0, 1.0, 0));
  const pinks = [0xf7a8c8, 0xf28cb4, 0xffd0e2];
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    g.add(mesh(new IcosahedronGeometry(0.6 + r() * 0.35, 1), mat(pinks[i % 3], { rough: 0.7 }), Math.cos(a) * 0.6, 2.2 + r() * 0.7, Math.sin(a) * 0.6));
  }
  return g;
}

// ---------------------------------------------------------------- volcano
export function makeVolcano(): Group {
  const g = new Group();
  const prof: Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    prof.push(new Vector2(3.6 * (1 - t) + 0.9 * t + Math.sin(t * 9) * 0.08, Math.pow(t, 0.75) * 5.2));
  }
  prof.push(new Vector2(0.6, 4.7));
  const geo = wobble(new LatheGeometry(prof, 22), 0.18, 61);
  vcolor(geo, (_x, y) => (y > 4.6 ? 0x3a2e2a : y > 2.5 ? 0x5a4a42 : 0x6e5a4a));
  g.add(mesh(geo, vmat(0.9)));
  const lava = new MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff4a10, emissiveIntensity: 1.6, roughness: 0.4 });
  lava.name = 'lava';
  g.add(mesh(new CircleGeometry(0.75, 16), lava, 0, 4.75, 0, false).rotateX(-Math.PI / 2));
  // glowing lava streams
  for (const a of [0.4, 2.3]) {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const rr = 0.9 + t * 2.6;
      pts.push(new Vector3(Math.cos(a + Math.sin(t * 4) * 0.12) * rr, 4.75 - Math.pow(t, 0.9) * 4.4, Math.sin(a + Math.sin(t * 4) * 0.12) * rr));
    }
    g.add(mesh(new TubeGeometry(new CatmullRomCurve3(pts), 20, 0.13, 6), lava, 0, 0.05, 0, false));
  }
  const l = new PointLight(0xff6a2a, 0, 16, 1.4);
  l.name = 'lavaLight';
  l.position.y = 5.6;
  g.add(l);
  const smoke = new Object3D();
  smoke.name = 'smoke';
  smoke.position.y = 5.2;
  g.add(smoke);
  return g;
}

export function makeLavaRock(seed = 1): Group {
  const g = new Group();
  g.add(mesh(wobble(new DodecahedronGeometry(0.55, 1), 0.15, seed), mat(0x2e2a28, { rough: 0.95 }), 0, 0.3, 0));
  const glow = new MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff4a10, emissiveIntensity: 1.2 });
  glow.name = 'lava';
  for (let i = 0; i < 3; i++) g.add(mesh(new BoxGeometry(0.5, 0.04, 0.05), glow, 0, 0.32 + i * 0.12, 0.42 - i * 0.05, false).rotateZ(0.3 * (i - 1)));
  return g;
}

export function makeFlamingo(): Group {
  const g = new Group();
  const pink = mat(0xff8fb1, { rough: 0.5 });
  const body = mesh(new SphereGeometry(0.25, 12, 10), pink, 0, 1.0, 0);
  body.scale.set(0.8, 0.75, 1.3);
  g.add(body);
  const neck = new CatmullRomCurve3([new Vector3(0, 1.05, 0.25), new Vector3(0, 1.4, 0.3), new Vector3(0, 1.55, 0.1), new Vector3(0, 1.7, 0.2)]);
  g.add(mesh(new TubeGeometry(neck, 12, 0.05, 6), pink));
  g.add(mesh(new SphereGeometry(0.09, 8, 6), pink, 0, 1.72, 0.24));
  g.add(mesh(new ConeGeometry(0.035, 0.16, 6), mat(0x222222), 0, 1.66, 0.36).rotateX(2.2));
  for (const x of [-0.06, 0.06]) g.add(mesh(new CylinderGeometry(0.02, 0.02, 0.85, 4), mat(0xe86a8f), x, 0.42, 0));
  return g;
}

