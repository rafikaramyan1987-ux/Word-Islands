import { Color, Vector3 } from 'three';
import type { TimeOfDay } from '../data/islands';

export interface Palette {
  skyTop: Color;
  skyHorizon: Color;
  skyBottom: Color;
  fog: Color;
  sunDir: Vector3;
  sunColor: Color;
  sunIntensity: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  waterDeep: Color;
  waterShallow: Color;
  glint: Color;
  stars: number;
  /** 0 = day, 1 = night: drives emissive windows, lighthouse etc. */
  night: number;
  exposure: number;
}

const c = (hex: number) => new Color(hex);

export const PALETTES: Record<TimeOfDay, Palette> = {
  morning: {
    skyTop: c(0x2f8be0),
    skyHorizon: c(0xa9dcf7),
    skyBottom: c(0x8fd0ee),
    fog: c(0x9fd3f0),
    sunDir: new Vector3(0.55, 0.62, 0.45).normalize(),
    sunColor: c(0xfff1d6),
    sunIntensity: 2.6,
    hemiSky: c(0xcfeaff),
    hemiGround: c(0xc8b48a),
    hemiIntensity: 1.25,
    waterDeep: c(0x1478b8),
    waterShallow: c(0x3fe0d0),
    glint: c(0xfffbe8),
    stars: 0,
    night: 0,
    exposure: 1.0,
  },
  sunset: {
    skyTop: c(0x4a5fae),
    skyHorizon: c(0xffb07a),
    skyBottom: c(0xf08f7c),
    fog: c(0xf4b08f),
    sunDir: new Vector3(-0.7, 0.22, -0.55).normalize(),
    sunColor: c(0xffc08a),
    sunIntensity: 2.4,
    hemiSky: c(0xffd2b0),
    hemiGround: c(0x8a6a7a),
    hemiIntensity: 1.0,
    waterDeep: c(0x2c4f8f),
    waterShallow: c(0x47b7b0),
    glint: c(0xffd49a),
    stars: 0.15,
    night: 0.3,
    exposure: 1.0,
  },
  night: {
    skyTop: c(0x070d2a),
    skyHorizon: c(0x284878),
    skyBottom: c(0x14284a),
    fog: c(0x1c3358),
    sunDir: new Vector3(0.5, 0.62, 0.6).normalize(), // moon, behind the camera so it lights the island front
    sunColor: c(0xb8d0ff),
    sunIntensity: 1.7,
    hemiSky: c(0x7896d8),
    hemiGround: c(0x2c3c5c),
    hemiIntensity: 1.5,
    waterDeep: c(0x0b2a52),
    waterShallow: c(0x1f6f8f),
    glint: c(0xd8e6ff),
    stars: 1,
    night: 1,
    exposure: 1.15,
  },
  noon: {
    skyTop: c(0x2a86e6),
    skyHorizon: c(0xb2e2fb),
    skyBottom: c(0x94d6f2),
    fog: c(0xb2e2fb),
    sunDir: new Vector3(0.3, 0.88, 0.35).normalize(),
    sunColor: c(0xffffff),
    sunIntensity: 2.8,
    hemiSky: c(0xd8f0ff),
    hemiGround: c(0xb8c48a),
    hemiIntensity: 1.3,
    waterDeep: c(0x1f86c8),
    waterShallow: c(0x58e6c8),
    glint: c(0xffffff),
    stars: 0,
    night: 0,
    exposure: 1.0,
  },
  golden: {
    skyTop: c(0x5a9ed8),
    skyHorizon: c(0xffd9a0),
    skyBottom: c(0xf2c48e),
    fog: c(0xffd9a0),
    sunDir: new Vector3(0.75, 0.35, 0.35).normalize(),
    sunColor: c(0xffd49a),
    sunIntensity: 2.6,
    hemiSky: c(0xffe6c0),
    hemiGround: c(0xa8885a),
    hemiIntensity: 1.15,
    waterDeep: c(0x2a6fa8),
    waterShallow: c(0x56c6b4),
    glint: c(0xffe2a8),
    stars: 0,
    night: 0.1,
    exposure: 1.0,
  },
  dusk: {
    skyTop: c(0x1c1f5a),
    skyHorizon: c(0xb06aa8),
    skyBottom: c(0x6a4a8a),
    fog: c(0xb06aa8),
    sunDir: new Vector3(0.55, 0.45, 0.6).normalize(),
    sunColor: c(0xd8b0ff),
    sunIntensity: 1.6,
    hemiSky: c(0x9a86e0),
    hemiGround: c(0x3a3a5a),
    hemiIntensity: 1.35,
    waterDeep: c(0x1e2a6a),
    waterShallow: c(0x2fb8b0),
    glint: c(0xf2d6ff),
    stars: 0.7,
    night: 0.85,
    exposure: 1.1,
  },
  dawn: {
    skyTop: c(0x6a9ee0),
    skyHorizon: c(0xffcfd8),
    skyBottom: c(0xf2b8c8),
    fog: c(0xffcfd8),
    sunDir: new Vector3(0.65, 0.4, 0.55).normalize(),
    sunColor: c(0xffe0d8),
    sunIntensity: 2.4,
    hemiSky: c(0xffe4f0),
    hemiGround: c(0xb89aa0),
    hemiIntensity: 1.25,
    waterDeep: c(0x3a7ac0),
    waterShallow: c(0x6fd8d0),
    glint: c(0xfff0f0),
    stars: 0,
    night: 0.05,
    exposure: 1.0,
  },
  ember: {
    skyTop: c(0x2a1a3a),
    skyHorizon: c(0xff8a5a),
    skyBottom: c(0xc8584a),
    fog: c(0xff8a5a),
    sunDir: new Vector3(0.6, 0.3, 0.6).normalize(),
    sunColor: c(0xffb07a),
    sunIntensity: 2.0,
    hemiSky: c(0xffb090),
    hemiGround: c(0x4a2e2a),
    hemiIntensity: 1.2,
    waterDeep: c(0x2a2a5a),
    waterShallow: c(0x3a9aa0),
    glint: c(0xffc08a),
    stars: 0.35,
    night: 0.55,
    exposure: 1.05,
  },
};
