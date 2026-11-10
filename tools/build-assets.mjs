#!/usr/bin/env node
// Usage:
//   node tools/build-assets.mjs import <pack-name> <extracted-dir>   copy only the used files into assets-src/<pack>/
//   node tools/build-assets.mjs                                      build public/models/*.glb from assets-src/
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, weld, quantize, mergeDocuments, unpartition } from '@gltf-transform/functions';
import sharp from 'sharp';
import { PACKS } from './assets.config.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const CC0_PIRATE = `Pirate Kit by Quaternius (https://quaternius.com)
License: CC0 1.0 Universal (Public Domain Dedication)
https://creativecommons.org/publicdomain/zero/1.0/

The archive attached to the "assets-v1" release contained only the glTF files and
no license text, so this notice was written when importing. Quaternius publishes
the Pirate Kit under CC0.
`;

function stripNormalMaps(json) {
  const textures = json.textures ?? [];
  const usedTex = new Set();
  const visit = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'normalTexture') continue;
      if (v && typeof v === 'object' && typeof v.index === 'number' && k.endsWith('Texture')) usedTex.add(v.index);
      visit(v);
    }
  };
  for (const mat of json.materials ?? []) { delete mat.normalTexture; visit(mat); }
  const texMap = new Map(); const newTex = [];
  textures.forEach((t, i) => { if (usedTex.has(i)) { texMap.set(i, newTex.length); newTex.push(t); } });
  const usedImg = new Set(newTex.map((t) => t.source));
  const imgMap = new Map(); const newImg = [];
  (json.images ?? []).forEach((im, i) => { if (usedImg.has(i)) { imgMap.set(i, newImg.length); newImg.push(im); } });
  for (const t of newTex) t.source = imgMap.get(t.source);
  const remap = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object' && typeof v.index === 'number' && k.endsWith('Texture')) v.index = texMap.get(v.index);
      remap(v);
    }
  };
  for (const mat of json.materials ?? []) remap(mat);
  if (textures.length) json.textures = newTex;
  if (json.images) json.images = newImg;
}

async function importPack(name, dir) {
  const pack = PACKS[name];
  if (!pack) throw new Error(`unknown pack ${name}`);
  const dst = path.join(ROOT, 'assets-src', name);
  fs.mkdirSync(dst, { recursive: true });
  const src = path.join(dir, pack.srcSubdir);
  const copy = (f) => fs.copyFileSync(path.join(src, f), path.join(dst, f));
  for (const m of pack.models) {
    const gltfFile = `${m}.gltf`;
    const json = JSON.parse(fs.readFileSync(path.join(src, gltfFile), 'utf8'));
    // drop normal maps: we don't use them, and they are the heaviest textures in the pack
    stripNormalMaps(json);
    fs.writeFileSync(path.join(dst, gltfFile), JSON.stringify(json, null, 1));
    for (const b of json.buffers ?? []) if (b.uri && !b.uri.startsWith('data:')) copy(decodeURIComponent(b.uri));
    for (const img of json.images ?? []) if (img.uri && !img.uri.startsWith('data:')) copy(decodeURIComponent(img.uri));
  }
  if (pack.license) fs.copyFileSync(path.join(dir, pack.license), path.join(dst, pack.license));
  else fs.writeFileSync(path.join(dst, 'License.txt'), CC0_PIRATE);
  console.log(`imported ${pack.models.length} models into assets-src/${name}`);
}

async function buildPack(name) {
  const pack = PACKS[name];
  const dir = path.join(ROOT, 'assets-src', name);
  let doc = null;
  for (const m of pack.models) {
    const d = await io.read(path.join(dir, `${m}.gltf`));
    // name the root so the game can find each model by name
    const scene = d.getRoot().getDefaultScene() ?? d.getRoot().listScenes()[0];
    const root = d.createNode(m);
    for (const child of scene.listChildren()) { scene.removeChild(child); root.addChild(child); }
    scene.addChild(root);
    // unused normal-map texture slots are already stripped at import
    if (!doc) doc = d; else mergeDocuments(doc, d);
  }
  // collapse all scenes into the first one
  const scenes = doc.getRoot().listScenes();
  for (const s of scenes.slice(1)) { for (const c of s.listChildren()) scenes[0].addChild(c); s.dispose(); }
  doc.getRoot().setDefaultScene(scenes[0]);
  await doc.transform(
    unpartition(),
    dedup(),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [pack.maxTexture, pack.maxTexture], quality: 82 }),
    quantize(),
    prune(),
  );
  const outDir = path.join(ROOT, 'public', 'models');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, pack.out);
  await io.write(out, doc);
  console.log(`${pack.out}: ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'import') await importPack(a, b);
else for (const name of Object.keys(PACKS)) await buildPack(name);
