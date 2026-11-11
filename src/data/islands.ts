import type { StringKey } from '../i18n';

export type Theme = 'tropical' | 'winter' | 'meadow' | 'desert' | 'autumn' | 'firefly' | 'blossom' | 'volcano';
export type TimeOfDay = 'morning' | 'sunset' | 'night' | 'noon' | 'golden' | 'dusk' | 'dawn' | 'ember';
export type Fx = 'snow' | 'petals' | 'leaves' | 'fireflies' | 'embers' | null;

/** One decoration that appears when the island is restored. `kind` is a key of the prop factory. */
export interface PieceDef {
  kind: string;
  x: number;
  z: number;
  rot?: number;
  s?: number;
}

/** Terrain colours: beach sand, wet sand, sea floor, unrestored plateau, restored plateau (two tones). */
export interface Ground {
  sand: number;
  wet: number;
  under: number;
  pebble: number;
  dry: number;
  lush: number;
  lush2: number;
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
  ground: Ground;
  /** ambient effect particles */
  fx: Fx;
  /** tint for leafy CC0 models on this island (e.g. autumn orange) */
  leafTint?: number;
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
    ground: { sand: 0xf3dcaa, wet: 0xd9bd85, under: 0xc9b98a, pebble: 0xb7a68a, dry: 0xb6a25e, lush: 0x6cc43c, lush2: 0x3f9d34 },
    fx: null,
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
    ground: { sand: 0xc7cfdb, wet: 0x8f9bb0, under: 0x5d7590, pebble: 0x8a94a6, dry: 0xb4c0d4, lush: 0xf2f6ff, lush2: 0xd8e4f7 },
    fx: 'snow',
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
      { kind: 'Pine_3', x: 5.6, z: -3.0, rot: 0.7, s: 0.3 },
      { kind: 'snowman', x: 2.4, z: 4.8, rot: -0.3, s: 0.7 },
      { kind: 'Pine_5', x: -1.4, z: -6.4, rot: 1.9, s: 0.3 },
    ],
    sprouts: ['Pebble_Round_1', 'Mushroom_Common', 'Pebble_Round_3'],
  },
  {
    name: 'island2',
    theme: 'meadow',
    time: 'noon',
    seed: 23,
    radius: 9.5,
    hill: [-2.4, -3.0, 1.6, 3.4],
    ground: { sand: 0xf0e0b4, wet: 0xd6c08a, under: 0xbfb48a, pebble: 0xb2aa98, dry: 0xc2b267, lush: 0x8fd44f, lush2: 0x5fb43a },
    fx: null,
    base: [
      { kind: 'Rock_Medium_2', x: 6.4, z: -2.0, rot: 0.6, s: 0.45 },
      { kind: 'Pebble_Round_1', x: -5.8, z: 3.6, rot: 0.2, s: 1.2 },
      { kind: 'fence', x: 1.6, z: 4.4, rot: 0.2, s: 0.8 },
    ],
    pieces: [
      { kind: 'windmill', x: -2.4, z: -3.0, rot: 0.4, s: 0.95 },
      { kind: 'sheep', x: 2.6, z: 1.8, rot: 2.4, s: 1.0 },
      { kind: 'flowerbed', x: -0.6, z: 1.6, rot: 0, s: 1.0 },
      { kind: 'CommonTree_1', x: 4.2, z: -2.6, rot: 1.0, s: 0.42 },
      { kind: 'haybale', x: 1.0, z: -1.2, rot: 0.6, s: 1.0 },
      { kind: 'well', x: -4.4, z: 1.2, rot: 0.7, s: 0.9 },
      { kind: 'sheep', x: 4.0, z: 3.2, rot: -0.8, s: 0.85 },
      { kind: 'fence', x: 3.6, z: 0.2, rot: 1.3, s: 1.0 },
      { kind: 'pier', x: 5.8, z: 4.2, rot: 0.95, s: 1.0 },
      { kind: 'Bush_Common_Flowers', x: -5.6, z: -1.4, rot: 0.3, s: 0.65 },
      { kind: 'haybale', x: 2.2, z: -1.8, rot: 2.1, s: 0.8 },
      { kind: 'Flower_4_Group', x: -2.6, z: 4.4, rot: 1.2, s: 0.9 },
      { kind: 'bench', x: -0.8, z: -0.6, rot: 0.3, s: 1.0 },
      { kind: 'gulls', x: 0, z: 0, s: 1.0 },
    ],
    sprouts: ['Flower_3_Group', 'Flower_4_Group', 'Grass_Common_Tall', 'Clover'],
  },
  {
    name: 'island3',
    theme: 'desert',
    time: 'sunset',
    seed: 37,
    radius: 9.5,
    hill: [3.0, -3.4, 1.3, 3.0],
    ground: { sand: 0xf2c690, wet: 0xd9a066, under: 0xb98e6a, pebble: 0xc28a5a, dry: 0xdaa465, lush: 0xc9b860, lush2: 0x9cb04c },
    fx: null,
    base: [
      { kind: 'Rock_Medium_1', x: -6.4, z: 2.2, rot: 0.4, s: 0.5 },
      { kind: 'cactus', x: 5.6, z: 1.2, rot: 0.2, s: 0.8 },
      { kind: 'Pebble_Round_3', x: 2.0, z: 6.0, rot: 0.9, s: 1.3 },
    ],
    pieces: [
      { kind: 'arch', x: -1.4, z: -3.4, rot: 0.25, s: 1.15 },
      { kind: 'oasis', x: 0.8, z: 1.0, rot: 0, s: 1.0 },
      { kind: 'Environment_PalmTree_1', x: 2.4, z: -0.4, rot: 1.4, s: 0.9 },
      { kind: 'tent', x: 3.8, z: -2.6, rot: -0.5, s: 0.9 },
      { kind: 'cactus', x: -4.2, z: 1.0, rot: 1.1, s: 0.9 },
      { kind: 'pots', x: 2.8, z: 2.8, rot: 0.5, s: 1.0 },
      { kind: 'Environment_PalmTree_3', x: -0.8, z: 2.8, rot: 3.3, s: 0.8 },
      { kind: 'pier', x: -5.6, z: 4.8, rot: -0.85, s: 1.0 },
      { kind: 'cactus', x: -2.8, z: -0.6, rot: 2.2, s: 0.7 },
      { kind: 'lanterns', x: 0, z: 0, s: 1.0 },
      { kind: 'Prop_Chest_Gold', x: 4.8, z: 0.6, rot: -0.4, s: 0.4 },
      { kind: 'flamingo', x: -0.6, z: 0.4, rot: 0.8, s: 0.8 },
      { kind: 'Plant_1_Big', x: 1.4, z: -1.8, rot: 0.6, s: 0.6 },
      { kind: 'cactus', x: 5.4, z: -0.6, rot: 0.4, s: 0.6 },
    ],
    sprouts: ['cactus_small', 'Pebble_Round_1', 'Plant_1_Big'],
  },
  {
    name: 'island4',
    theme: 'autumn',
    time: 'golden',
    seed: 41,
    radius: 9.5,
    hill: [-3.2, -2.4, 1.2, 3.4],
    ground: { sand: 0xead6aa, wet: 0xcdb27c, under: 0xb3a07e, pebble: 0xa89a86, dry: 0xa0905a, lush: 0xd49a3c, lush2: 0x98ad3e },
    fx: 'leaves',
    leafTint: 0xf08a2a,
    base: [
      { kind: 'Rock_Medium_1', x: 6.2, z: -2.6, rot: 0.3, s: 0.45 },
      { kind: 'DeadTree_1', x: -5.6, z: -1.0, rot: 0.6, s: 0.3 },
      { kind: 'Mushroom_Common', x: 2.4, z: 4.6, rot: 0.2, s: 1.4 },
    ],
    pieces: [
      { kind: 'balloon', x: -2.8, z: -2.6, rot: 0.3, s: 1.0 },
      { kind: 'CommonTree_1', x: 3.2, z: -3.2, rot: 0.4, s: 0.45 },
      { kind: 'pumpkins', x: 1.2, z: 1.8, rot: 0.6, s: 1.0 },
      { kind: 'cabin', x: 2.2, z: -0.6, rot: -0.45, s: 0.85 },
      { kind: 'fox', x: -1.4, z: 2.6, rot: 0.9, s: 1.0 },
      { kind: 'leafpile', x: -3.8, z: 2.2, rot: 0, s: 1.0 },
      { kind: 'CommonTree_1', x: -5.2, z: 0.4, rot: 2.2, s: 0.38 },
      { kind: 'pier', x: 5.8, z: 4.0, rot: 0.95, s: 1.0 },
      { kind: 'haybale', x: 4.6, z: 1.6, rot: 1.4, s: 0.9 },
      { kind: 'Mushroom_Common', x: -0.6, z: 0.0, rot: 1.0, s: 1.6 },
      { kind: 'leafpile', x: 0.6, z: 4.2, rot: 1, s: 0.8 },
      { kind: 'bench', x: -1.0, z: -0.6, rot: 0.5, s: 1.0 },
      { kind: 'lanterns', x: 0, z: 0, s: 1.0 },
      { kind: 'CommonTree_1', x: 0.6, z: -5.4, rot: 1.6, s: 0.4 },
    ],
    sprouts: ['Mushroom_Common', 'leafpile_small', 'Grass_Common_Tall'],
  },
  {
    name: 'island5',
    theme: 'firefly',
    time: 'dusk',
    seed: 53,
    radius: 9.5,
    hill: [-1.8, -3.0, 1.4, 3.6],
    ground: { sand: 0xd8c8a4, wet: 0xb4a07c, under: 0x6a7f8a, pebble: 0x8f8c84, dry: 0x6f7a4a, lush: 0x3fae68, lush2: 0x2a8a52 },
    fx: 'fireflies',
    base: [
      { kind: 'Rock_Medium_2', x: -6.2, z: 2.6, rot: 0.6, s: 0.5 },
      { kind: 'Environment_PalmTree_2', x: 5.2, z: -2.4, rot: 1.0, s: 0.85 },
      { kind: 'Pebble_Round_1', x: 2.6, z: 6.0, rot: 0.4, s: 1.2 },
    ],
    pieces: [
      { kind: 'treehouse', x: -1.8, z: -3.0, rot: 0.35, s: 0.9 },
      { kind: 'glowshrooms', x: 1.4, z: 1.2, rot: 0, s: 1.0 },
      { kind: 'Plant_1_Big', x: 3.0, z: -1.2, rot: 0.5, s: 0.7 },
      { kind: 'campfire', x: 0.2, z: 3.2, rot: 0, s: 0.9 },
      { kind: 'Environment_PalmTree_1', x: -4.8, z: 0.8, rot: 2.0, s: 0.9 },
      { kind: 'glowshrooms', x: -3.0, z: 2.6, rot: 1.0, s: 1.1 },
      { kind: 'pier', x: 5.8, z: 4.2, rot: 0.95, s: 1.0 },
      { kind: 'Flower_3_Group', x: 3.6, z: 1.8, rot: 0.6, s: 0.9 },
      { kind: 'lanterns', x: 0, z: 0, s: 1.0 },
      { kind: 'crab', x: -2.0, z: 5.6, rot: -0.3, s: 1.0 },
      { kind: 'glowshrooms', x: 3.4, z: -3.6, rot: 2.0, s: 0.9 },
      { kind: 'Bush_Common_Flowers', x: -4.6, z: -1.8, rot: 0.4, s: 0.6 },
      { kind: 'bench', x: 1.6, z: -0.6, rot: -0.4, s: 1.0 },
      { kind: 'Environment_PalmTree_3', x: 1.2, z: -5.2, rot: 0.8, s: 0.8 },
    ],
    sprouts: ['glowshrooms_small', 'Plant_1_Big', 'Flower_3_Group'],
  },
  {
    name: 'island6',
    theme: 'blossom',
    time: 'dawn',
    seed: 67,
    radius: 9.5,
    hill: [2.6, -3.0, 1.2, 3.4],
    ground: { sand: 0xf6e6cc, wet: 0xdcc69c, under: 0xb7b09a, pebble: 0xc8bcb4, dry: 0xb5ad7a, lush: 0x9ad66a, lush2: 0xf2b8d2 },
    fx: 'petals',
    leafTint: 0xf7a8c8,
    base: [
      { kind: 'Rock_Medium_1', x: -6.2, z: 2.4, rot: 0.6, s: 0.45 },
      { kind: 'Pebble_Round_3', x: 5.8, z: 2.4, rot: 0.2, s: 1.2 },
      { kind: 'blossomtree', x: -4.8, z: -2.6, rot: 0.4, s: 0.8 },
    ],
    pieces: [
      { kind: 'gazebo', x: 2.6, z: -3.0, rot: 0.3, s: 0.95 },
      { kind: 'blossomtree', x: -1.8, z: -2.2, rot: 1.0, s: 1.0 },
      { kind: 'fountain', x: -0.2, z: 1.4, rot: 0, s: 1.0 },
      { kind: 'flowerbed_pink', x: 2.8, z: 1.4, rot: 0, s: 1.0 },
      { kind: 'swans', x: -6.4, z: 5.4, rot: 0.8, s: 1.0 },
      { kind: 'bench', x: -2.6, z: 1.8, rot: 0.9, s: 1.0 },
      { kind: 'blossomtree', x: 5.4, z: -0.6, rot: 2.0, s: 0.9 },
      { kind: 'pier', x: 5.6, z: 4.4, rot: 0.9, s: 1.0 },
      { kind: 'Flower_3_Group', x: -4.0, z: 0.4, rot: 0.5, s: 1.0 },
      { kind: 'lanterns', x: 0, z: 0, s: 1.0 },
      { kind: 'flowerbed_pink', x: -1.4, z: 4.4, rot: 1, s: 0.8 },
      { kind: 'blossomtree', x: 0.6, z: -5.4, rot: 1.6, s: 0.85 },
      { kind: 'Bush_Common_Flowers', x: 4.0, z: 3.4, rot: 0.3, s: 0.6 },
      { kind: 'gulls', x: 0, z: 0, s: 1.0 },
    ],
    sprouts: ['Flower_3_Group', 'flowerbed_small', 'Flower_4_Group'],
  },
  {
    name: 'island7',
    theme: 'volcano',
    time: 'ember',
    seed: 79,
    radius: 10,
    hill: [-1.6, -3.4, 1.6, 3.8],
    ground: { sand: 0x4a4440, wet: 0x34302e, under: 0x3a4a52, pebble: 0x3a3634, dry: 0x6a5a4c, lush: 0x6ab04a, lush2: 0x3f8a3a },
    fx: 'embers',
    base: [
      { kind: 'lavarock', x: 5.8, z: 1.2, rot: 0.4, s: 1.0 },
      { kind: 'lavarock', x: -6.2, z: 2.6, rot: 1.6, s: 0.8 },
      { kind: 'DeadTree_1', x: 4.6, z: -3.0, rot: 0.6, s: 0.3 },
    ],
    pieces: [
      { kind: 'volcano', x: -1.6, z: -3.6, rot: 0.2, s: 1.0 },
      { kind: 'Environment_PalmTree_1', x: 3.2, z: -1.2, rot: 0.6, s: 0.9 },
      { kind: 'hut', x: 2.4, z: 1.8, rot: -0.4, s: 0.8 },
      { kind: 'flamingos', x: -3.4, z: 3.4, rot: 0.6, s: 1.0 },
      { kind: 'Plant_1_Big', x: 0.0, z: 0.6, rot: 0.6, s: 0.7 },
      { kind: 'campfire', x: -0.6, z: 3.6, rot: 0, s: 0.9 },
      { kind: 'pier', x: 6.0, z: 4.4, rot: 0.95, s: 1.0 },
      { kind: 'Environment_PalmTree_2', x: -5.0, z: 0.0, rot: 2.4, s: 0.85 },
      { kind: 'lanterns', x: 0, z: 0, s: 1.0 },
      { kind: 'Bush_Common_Flowers', x: 4.8, z: -0.2, rot: 1.0, s: 0.6 },
      { kind: 'Prop_Chest_Gold', x: 1.0, z: 4.6, rot: 0.3, s: 0.4 },
      { kind: 'Flower_4_Group', x: -2.0, z: 1.2, rot: 0.4, s: 0.9 },
      { kind: 'Environment_PalmTree_3', x: 1.8, z: -5.6, rot: 1.4, s: 0.85 },
      { kind: 'gulls', x: 0, z: 0, s: 1.0 },
    ],
    sprouts: ['Plant_1_Big', 'Flower_4_Group', 'Grass_Common_Tall'],
  },
];
