import { Group, type Mesh } from 'three';

import type { GameMap } from '~/types/map';
import type { MapTileRenderData } from '~/game/render/layers/mapTileRenderData';
import { HexInteractionMeshFactory } from '~/game/render/three/HexInteractionMeshFactory';

export class MapInteractionLayer {
  public readonly group = new Group();

  private readonly interactionMeshFactory: HexInteractionMeshFactory;
  private raycastTargets: Mesh[] = [];

  constructor(interactionMeshFactory: HexInteractionMeshFactory = new HexInteractionMeshFactory()) {
    this.interactionMeshFactory = interactionMeshFactory;
    this.group.name = 'map-interaction-layer';
  }

  render(map: GameMap, tileRenderData: ReadonlyArray<MapTileRenderData>) {
    this.group.clear();
    this.raycastTargets = [];

    for (const tileData of tileRenderData) {
      const mesh = this.interactionMeshFactory.createInteractionMesh(
        map.tileSize,
        map.layout,
        tileData.key,
      );

      mesh.position.set(tileData.worldX, tileData.worldY, 0);
      this.group.add(mesh);
      this.raycastTargets.push(mesh);
    }
  }

  getRaycastTargets(): ReadonlyArray<Mesh> {
    return this.raycastTargets;
  }

  destroy() {
    this.group.clear();
    this.raycastTargets = [];
    this.interactionMeshFactory.destroy();
  }
}
