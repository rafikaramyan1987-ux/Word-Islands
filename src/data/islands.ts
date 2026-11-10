import type { StringKey } from '../i18n';

export type Theme = 'tropical' | 'winter';
export type TimeOfDay = 'morning' | 'sunset' | 'night';

/** One decoration that appears when the island is restored. `kind` is a key of the prop factory. */
export interface PieceDef {
  kind: string;
  x: number;
  z: number;
  rot?: number;
  s?: number;
}

export interface IslandDef {
  name: StringKey;
  theme: Theme;
  time: TimeOfDay;
  seed: number;
  /** shoreline radius in world units */
  radius: number;
  /** optional hill: [x, z, height, width] */
  hill?: [number, number, number, number];
  /** always visible (the "unrestored" island) */
  base: PieceDef[];
  /** pieces added in order as levels are completed (spread evenly across the island's levels) */
  pieces: PieceDef[];
  /** small sprouts that pop up for every word found */
  sprouts: string[];
}

export const ISLANDS: IslandDef[] = [
  {
    name: 'island0',
    theme: 'tropical',
    time: 'morning',
    seed: 3,
    radius: 9,
    hill: [-2.5, -2.5, 1.1, 3.5],
    base: [
      { kind: 'Rock_Medium_1', x: -6.2, z: 3.2, rot: 0.4, s: 0.45 },
      { kind: 'Rock_Medium_2', x: 6.6, z: -2.4, rot: 1.2, s: 0.5 },
      { kind: 'Pebble_Round_1', x: 2.2, z: 6.4, rot: 0.3, s: 1.2 },
      { kind: 'Pebble_Round_3', x: -3.6, z: 6.0, rot: 2.0, s: 1.1 },
      { kind: 'Environment_PalmTree_2', x: -4.6, z: -1.4, rot: 0.6, s: 0.9 },
    ],
    pieces: [
      // level 1
      { kind: 'Environment_PalmTree_1', x: 3.8, z: -2.8, rot: 2.2, s: 1.0 },
      { kind: 'hut', x: -1.2, z: -1.6, rot: 0.35, s: 1.0 },
      { kind: 'Bush_Common_Flowers', x: 1.5, z: 1.6, rot: 0.2, s: 0.7 },
      { kind: 'Flower_3_Group', x: -3.2, z: 2.2, rot: 1.0, s: 0.9 },
      { kind: 'RockPath_Round_Wide', x: 0.2, z: 1.0, rot: 0.3, s: 0.9 },
      { kind: 'crab', x: 3.2, z: 5.6, rot: 0.2, s: 1.0 },
      // level 2
      { kind: 'pier', x: 5.7, z: 3.7, rot: 1.0, s: 1.0 },
      { kind: 'Environment_PalmTree_3', x: -5.4, z: 1.2, rot: 4.0, s: 0.85 },
      { kind: 'Prop_Chest_Gold', x: -2.4, z: 4.2, rot: 0.5, s: 0.4 },
      { kind: 'Prop_Barrel', x: 2.4, z: -0.4, rot: 0.2, s: 0.55 },
      { kind: 'Flower_4_Group', x: 0.8, z: -3.6, rot: 0.8, s: 0.9 },
      { kind: 'gulls', x: 0, z: 0, s: 1.0 },
      { kind: 'Prop_Bucket_Fishes', x: 3.0, z: 0.4, rot: -0.6, s: 0.5 },
      { kind: 'Plant_1_Big', x: -3.8, z: -3.8, rot: 0.3, s: 0.6 },
    ],
    sprouts: ['Flower_3_Group', 'Grass_Common_Tall', 'Plant_1_Big', 'Flower_4_Group'],
  },
  {
    name: 'island1',
    theme: 'winter',
    time: 'night',
    seed: 11,
    radius: 9.5,
    hill: [-3.0, -3.2, 2.2, 3.2],
    base: [
      { kind: 'Rock_Medium_1', x: 6.2, z: 2.6, rot: 0.9, s: 0.5 },
      { kind: 'Rock_Medium_2', x: -6.4, z: 2.0, rot: 2.1, s: 0.45 },
      { kind: 'DeadTree_1', x: 4.2, z: -3.4, rot: 0.4, s: 0.32 },
      { kind: 'Pine_5', x: -6.0, z: -2.0, rot: 0.3, s: 0.38 },
    ],
    pieces: [
      { kind: 'lighthouse', x: -3.0, z: -3.2, rot: 0.6, s: 1.0 },
      { kind: 'cabin', x: 2.0, z: -1.6, rot: -0.35, s: 1.0 },
      { kind: 'Pine_1', x: 4.8, z: -0.6, rot: 0.2, s: 0.36 },
      { kind: 'Pine_3', x: 0.0, z: -5.0, rot: 1.2, s: 0.38 },
      { kind: 'campfire', x: 0.6, z: 2.2, rot: 0, s: 1.0 },
      { kind: 'snowman', x: -2.6, z: 3.2, rot: 0.5, s: 1.0 },
      { kind: 'penguins', x: 4.4, z: 4.6, rot: -0.4, s: 1.0 },
      { kind: 'pier', x: -5.7, z: 4.7, rot: -0.88, s: 1.0 },
      { kind: 'Pine_1', x: -5.2, z: -0.2, rot: 2.2, s: 0.3 },
      { kind: 'lanterns', x: 0, z: 0, s: 1.0 },
      { kind: 'Prop_Barrel', x: 3.6, z: 0.8, rot: 0.2, s: 0.5 },
    ],
    sprouts: ['Pebble_Round_1', 'Mushroom_Common', 'Pebble_Round_3'],
  },
];
