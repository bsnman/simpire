import { Group, Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import {
  GLTF_IMPORT_CORRECTION_ROTATION_X,
  orientImportedGltfRoot,
} from '~/game/render/three/modelOrientation';

describe('model orientation helpers', () => {
  it('wraps imported gltf roots in a shared z-up correction group', () => {
    const rawRoot = new Group();
    rawRoot.name = 'terrain_asset';
    const child = new Object3D();
    rawRoot.add(child);

    const correctedRoot = orientImportedGltfRoot(rawRoot);

    expect(correctedRoot).not.toBe(rawRoot);
    expect(correctedRoot.rotation.x).toBeCloseTo(GLTF_IMPORT_CORRECTION_ROTATION_X);
    expect(correctedRoot.children[0]).toBe(rawRoot);
    expect(correctedRoot.name).toBe('terrain_asset__import_corrected');
  });

  it('does not double-apply the import correction', () => {
    const rawRoot = new Group();
    const correctedRoot = orientImportedGltfRoot(rawRoot);

    expect(orientImportedGltfRoot(correctedRoot)).toBe(correctedRoot);
    expect(correctedRoot.rotation.x).toBeCloseTo(GLTF_IMPORT_CORRECTION_ROTATION_X);
  });

  it('preserves the correction when cloning the oriented root', () => {
    const rawRoot = new Group();
    rawRoot.name = 'hill';
    rawRoot.add(new Object3D());
    const correctedRoot = orientImportedGltfRoot(rawRoot);

    const clone = correctedRoot.clone(true);

    expect(clone.rotation.x).toBeCloseTo(GLTF_IMPORT_CORRECTION_ROTATION_X);
    expect(clone.children).toHaveLength(1);
    expect(clone.children[0]?.name).toBe('hill');
  });
});
