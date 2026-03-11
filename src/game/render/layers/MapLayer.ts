import { Group, type Camera, type Mesh, type Raycaster } from 'three';

import { tiles } from '~/base/tiles';
import { fromHexKey, type HexKey } from '~/types/hex';
import type { GameMap, MapTile } from '~/types/map';
import { axialToPixel } from '~/game/render/hexMath';
import { TerrainDecorationFactory } from '~/game/render/three/TerrainDecorationFactory';
import { HexTileMeshFactory } from '~/game/render/three/HexTileMeshFactory';
import { pickHexKeyAtScreenPoint } from '~/game/render/three/raycast';

const FALLBACK_TILE_COLOR = '#6B7280';

type HoverUpdateContext = {
  screenX: number;
  screenY: number;
  viewportWidth: number;
  viewportHeight: number;
  camera: Camera;
  raycaster: Raycaster;
};

export type HoveredTile = {
  key: HexKey;
  tile: MapTile;
};

export class MapLayer {
  public readonly group = new Group();

  private readonly tileMeshFactory = new HexTileMeshFactory();
  private readonly terrainDecorationFactory = new TerrainDecorationFactory();
  private currentMap: GameMap | null = null;
  private hoveredTileKey: HexKey | null = null;
  private hoveredTileChangeHandler: ((hoveredTile: HoveredTile | null) => void) | null = null;
  private raycastTargets: Mesh[] = [];
  private decorationRenderToken = 0;

  constructor() {
    this.group.name = 'map-layer';
  }

  render(map: GameMap) {
    this.currentMap = map;
    this.group.clear();
    this.raycastTargets = [];

    for (const key of map.tileKeys) {
      const tile = map.tilesByKey[key];
      const { q, r } = tile ?? fromHexKey(key);
      const center = axialToPixel({ q, r }, map.tileSize, map.layout);
      const tileColor = tile ? tiles[tile.terrain].color : FALLBACK_TILE_COLOR;
      const mesh = this.tileMeshFactory.createTileMesh(map.tileSize, map.layout, tileColor, key);

      mesh.position.set(center.x + map.origin.x, center.y + map.origin.y, 0);

      this.group.add(mesh);
      this.raycastTargets.push(mesh);
    }

    const decorationGroup = new Group();
    decorationGroup.name = 'terrain-decoration-layer';
    this.group.add(decorationGroup);

    const renderToken = ++this.decorationRenderToken;

    void this.terrainDecorationFactory.populateTerrainDecorations({
      map,
      targetGroup: decorationGroup,
      isStale: () => renderToken !== this.decorationRenderToken,
    });

    if (this.hoveredTileKey) {
      const hoveredTile = map.tilesByKey[this.hoveredTileKey];

      if (!hoveredTile) {
        this.updateHoveredTileKey(null);
        return;
      }

      this.notifyHoveredTileChange(this.hoveredTileKey, hoveredTile);
    }
  }

  setHoveredTileChangeHandler(handler: ((hoveredTile: HoveredTile | null) => void) | null) {
    this.hoveredTileChangeHandler = handler;

    if (!handler) {
      return;
    }

    if (!this.hoveredTileKey || !this.currentMap) {
      handler(null);
      return;
    }

    const hoveredTile = this.currentMap.tilesByKey[this.hoveredTileKey];
    handler(hoveredTile ? { key: this.hoveredTileKey, tile: hoveredTile } : null);
  }

  updateHoveredTileAtScreenPoint({
    screenX,
    screenY,
    viewportWidth,
    viewportHeight,
    camera,
    raycaster,
  }: HoverUpdateContext) {
    if (!this.currentMap) {
      this.updateHoveredTileKey(null);
      return;
    }

    const key = pickHexKeyAtScreenPoint({
      screenX,
      screenY,
      viewportWidth,
      viewportHeight,
      camera,
      raycaster,
      targets: this.raycastTargets,
    });
    const tile = key ? this.currentMap.tilesByKey[key] : undefined;

    this.updateHoveredTileKey(tile ? key : null);
  }

  clearHoveredTile() {
    this.updateHoveredTileKey(null);
  }

  destroy() {
    this.decorationRenderToken += 1;
    this.group.clear();
    this.tileMeshFactory.destroy();
    this.currentMap = null;
    this.hoveredTileKey = null;
    this.hoveredTileChangeHandler = null;
    this.raycastTargets = [];
  }

  private updateHoveredTileKey(nextHoveredTileKey: HexKey | null) {
    if (this.hoveredTileKey === nextHoveredTileKey) {
      return;
    }

    this.hoveredTileKey = nextHoveredTileKey;

    if (!nextHoveredTileKey || !this.currentMap) {
      this.notifyHoveredTileChange(null);
      return;
    }

    const hoveredTile = this.currentMap.tilesByKey[nextHoveredTileKey];
    this.notifyHoveredTileChange(nextHoveredTileKey, hoveredTile);
  }

  private notifyHoveredTileChange(hoveredTileKey: null): void;
  private notifyHoveredTileChange(hoveredTileKey: HexKey, tile: MapTile | undefined): void;
  private notifyHoveredTileChange(hoveredTileKey: HexKey | null, tile?: MapTile) {
    if (!this.hoveredTileChangeHandler) {
      return;
    }

    if (!hoveredTileKey || !tile) {
      this.hoveredTileChangeHandler(null);
      return;
    }

    this.hoveredTileChangeHandler({
      key: hoveredTileKey,
      tile,
    });
  }
}
