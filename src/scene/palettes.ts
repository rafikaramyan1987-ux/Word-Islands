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
};
