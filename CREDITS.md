# Credits

Word Islands is an original game. Everything not listed below was made for this project: code, letter
wheel and UI art, icons, island terrain, water, sky, particles, all sound and music, and the hand-modelled
props — sailboat, hut, pier, lighthouse, cabin, campfire, snowman, lantern posts, crab, penguins,
seagulls, windmill, sheep, fences, hay bales, well, flower beds, cacti, sandstone arch, tent, pots,
oasis, hot-air balloon, pumpkins, fox, leaf piles, treehouse, glowing mushrooms, gazebo, fountain,
swans, bench, blossom trees, volcano, lava rocks and flamingos (`src/scene/props.ts`, `src/scene/props2.ts`).

## 3D models (CC0 1.0, public domain)

The asset packs were taken from the `assets-v1` release of this repository. Only the models listed
here are committed (in `assets-src/`, with their license files) and bundled (`public/models/*.glb`,
built by `tools/build-assets.mjs`; unused normal maps dropped, textures resized to max 512 px and
converted to WebP, meshes quantized).

### Stylized Nature MegaKit (Standard) by Quaternius — https://quaternius.com
License: CC0 1.0 — `assets-src/quaternius-stylized-nature-megakit/License_Standard.txt`

| Model | Used for |
|---|---|
| Bush_Common_Flowers | flowering bush (Sunny Lagoon) |
| Flower_3_Group, Flower_4_Group | flower patches, word sprouts |
| Plant_1_Big | tropical plants, word sprouts |
| Grass_Common_Tall | grass tufts (word sprouts) |
| Rock_Medium_1, Rock_Medium_2 | shore rocks |
| Pebble_Round_1, Pebble_Round_3 | pebbles, winter sprouts |
| RockPath_Round_Wide | stepping-stone path to the hut |
| Mushroom_Common | winter sprouts |
| Pine_1, Pine_3, Pine_5 | snowy pines (Frost Harbor, frosted with a shader) |
| DeadTree_1 | bare winter tree |
| CommonTree_1 | broad-leaf trees (Windmill Meadows; tinted orange on Maple Hollow) |

Textures used: Bark_DeadTree, Bark_NormalTree, Flowers, Grass, Leaf_Pine_C, Leaves, Leaves_NormalTree_C,
Mushrooms, PathRocks_Diffuse, Rocks_Diffuse.

### Pirate Kit by Quaternius — https://quaternius.com
License: CC0 1.0 — `assets-src/quaternius-pirate-kit/License.txt` (the release zip contained no license
text, so the CC0 notice was written on import).

| Model | Used for |
|---|---|
| Environment_PalmTree_1/2/3 | palm trees (Sunny Lagoon, Sunset Dunes, Firefly Lagoon, Ember Peak) |
| Environment_Dock, Environment_Dock_Pole | bundled for later islands |
| Prop_Barrel, Prop_Chest_Gold, Prop_Bucket_Fishes, Prop_Anchor, Environment_Sawmill | island props |

Note: the `assets-v1` release did not contain a Kenney pack (only the two Quaternius archives above
and the pirate atlas texture), so no Kenney assets are used.

## Fonts

Nunito by Vernon Adams, Cyreal and Jacques Le Bailly — SIL Open Font License 1.1, bundled via
`@fontsource/nunito` (npm).

## Libraries

- three.js — MIT License
- Vite, TypeScript, Vitest, Playwright, glTF-Transform, sharp — development tools only.

## Sound and music

All sound effects and both music loops are synthesised at runtime with the Web Audio API
(`src/audio/audio.ts`); no audio files are shipped.
