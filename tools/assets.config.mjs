// Single source of truth for which third-party models ship with the game.
// Only these files are copied into assets-src/ and bundled into public/models/.
export const PACKS = {
  'quaternius-stylized-nature-megakit': {
    out: 'nature.glb',
    srcSubdir: 'glTF',
    license: 'License_Standard.txt',
    maxTexture: 512,
    models: [
      'Bush_Common_Flowers', 'Flower_3_Group', 'Flower_4_Group', 'Plant_1_Big', 'Grass_Common_Tall',
      'Rock_Medium_1', 'Rock_Medium_2', 'Pebble_Round_1', 'Pebble_Round_3', 'RockPath_Round_Wide',
      'Mushroom_Common', 'Pine_1', 'Pine_3', 'Pine_5', 'DeadTree_1', 'CommonTree_1',
    ],
  },
  'quaternius-pirate-kit': {
    out: 'pirate.glb',
    srcSubdir: 'glTF',
    license: null, // the release zip ships no license file; CC0 notice written by tools/build-assets.mjs
    maxTexture: 512,
    models: [
      'Environment_PalmTree_1', 'Environment_PalmTree_2', 'Environment_PalmTree_3', 'Environment_Dock',
      'Environment_Dock_Pole', 'Prop_Barrel', 'Prop_Chest_Gold', 'Prop_Bucket_Fishes', 'Environment_Sawmill', 'Prop_Anchor',
    ],
  },
};
