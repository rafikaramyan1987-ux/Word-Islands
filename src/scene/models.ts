import { Mesh, Object3D, type Material, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Loads the two CC0 model packs (built by tools/build-assets.mjs) and hands out clones by name. */
class ModelLibrary {
  private roots = new Map<string, Object3D>();
  private loading: Promise<void> | null = null;
  ready = false;

  load(): Promise<void> {
    if (this.loading) return this.loading;
    const loader = new GLTFLoader();
    const base = import.meta.env.BASE_URL;
    this.loading = Promise.all(
      ['models/nature.glb', 'models/pirate.glb'].map((f) =>
        loader.loadAsync(base + f).then((gltf) => {
          for (const child of gltf.scene.children) {
            child.traverse((o) => {
              const m = o as Mesh;
              if (m.isMesh) {
                m.castShadow = true;
                m.receiveShadow = true;
                const mats = (Array.isArray(m.material) ? m.material : [m.material]) as Material[];
                for (const mm of mats) {
                  const sm = mm as MeshStandardMaterial;
                  if (sm.isMeshStandardMaterial) {
                    sm.roughness = Math.min(sm.roughness, 0.8);
                    if (sm.alphaTest > 0) sm.alphaTest = 0.45;
                  }
                }
              }
            });
            this.roots.set(child.name, child);
          }
        }),
      ),
    ).then(() => {
      this.ready = true;
    });
    return this.loading;
  }

  has(name: string) {
    return this.roots.has(name);
  }

  /** Clone with the model's base centred on the origin. */
  clone(name: string): Object3D | null {
    const r = this.roots.get(name);
    if (!r) return null;
    const c = r.clone(true);
    c.position.set(0, 0, 0);
    return c;
  }
}

export const models = new ModelLibrary();
