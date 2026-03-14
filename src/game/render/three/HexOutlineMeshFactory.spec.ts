import { Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import { buildMapHexOutlineObjectName } from '~/game/render/layers/mapLayerObjectNames';
import { HexOutlineMeshFactory } from '~/game/render/three/HexOutlineMeshFactory';
import { HEX_KEY_USER_DATA_FIELD } from '~/game/render/three/raycast';
import { toHexKey } from '~/types/hex';

describe('HexOutlineMeshFactory', () => {
  it('creates deterministic overlay outline meshes', () => {
    const factory = new HexOutlineMeshFactory();
    const tileKey = toHexKey(2, -1);
    const outline = factory.createHexOutline(50, 'pointy', '#112233', 2, tileKey);

    expect(outline).toBeInstanceOf(Mesh);
    expect(outline.name).toBe(buildMapHexOutlineObjectName(tileKey));
    expect(outline.userData[HEX_KEY_USER_DATA_FIELD]).toBe(tileKey);
    expect(outline.renderOrder).toBe(1000);
    expect(outline.material).toBeInstanceOf(MeshBasicMaterial);

    const material = outline.material as MeshBasicMaterial;

    expect(material.color.getHexString()).toBe('112233');
    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);

    factory.destroy();
  });

  it('uses thickness as part of the outline geometry cache', () => {
    const factory = new HexOutlineMeshFactory();
    const thinOutline = factory.createHexOutline(50, 'pointy', '#112233', 2, toHexKey(0, 0));
    const thickOutline = factory.createHexOutline(50, 'pointy', '#112233', 6, toHexKey(0, 1));

    expect(thinOutline.geometry).not.toBe(thickOutline.geometry);

    factory.destroy();
  });
});
