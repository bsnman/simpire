import { Group, type Camera, type Raycaster } from 'three';

import type { HexKey } from '~/types/hex';
import type { GameMap, MapTile } from '~/types/map';
import { buildMapTileRenderData } from '~/game/render/layers/mapTileRenderData';
import { MAP_LAYER_GROUP_NAME } from '~/game/render/layers/mapLayerObjectNames';
import { HexOutlineLayer } from '~/game/render/layers/HexOutlineLayer';
import { MapInteractionLayer } from '~/game/render/layers/MapInteractionLayer';
import { TileColorLayer } from '~/game/render/layers/TileColorLayer';
import { TileElevationLayer } from '~/game/render/layers/TileElevationLayer';
import {
  DEFAULT_MAP_RENDER_CONFIG,
  normalizeMapRenderConfig,
  type MapRenderConfig,
} from '~/game/render/mapRenderConfig';
import { pickHexKeyAtScreenPoint } from '~/game/render/three/raycast';

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

type MapLayerDependencies = {
  tileColorLayer?: TileColorLayer;
  hexOutlineLayer?: HexOutlineLayer;
  tileElevationLayer?: TileElevationLayer;
  interactionLayer?: MapInteractionLayer;
};

export class MapLayer {
  public readonly group = new Group();

  private readonly tileColorLayer: TileColorLayer;
  private readonly hexOutlineLayer: HexOutlineLayer;
  private readonly tileElevationLayer: TileElevationLayer;
  private readonly interactionLayer: MapInteractionLayer;

  private currentMap: GameMap | null = null;
  private currentRenderConfig: MapRenderConfig = normalizeMapRenderConfig(DEFAULT_MAP_RENDER_CONFIG);
  private hoveredTileKey: HexKey | null = null;
  private hoveredTileChangeHandler: ((hoveredTile: HoveredTile | null) => void) | null = null;

  constructor({
    tileColorLayer = new TileColorLayer(),
    hexOutlineLayer = new HexOutlineLayer(),
    tileElevationLayer = new TileElevationLayer(),
    interactionLayer = new MapInteractionLayer(),
  }: MapLayerDependencies = {}) {
    this.tileColorLayer = tileColorLayer;
    this.hexOutlineLayer = hexOutlineLayer;
    this.tileElevationLayer = tileElevationLayer;
    this.interactionLayer = interactionLayer;
    this.group.name = MAP_LAYER_GROUP_NAME;
    this.group.add(
      this.tileColorLayer.group,
      this.hexOutlineLayer.group,
      this.tileElevationLayer.group,
      this.interactionLayer.group,
    );
  }

  render(map: GameMap, config: MapRenderConfig) {
    this.currentMap = map;
    this.currentRenderConfig = normalizeMapRenderConfig(config);
    this.renderCurrentMap();
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
      targets: this.interactionLayer.getRaycastTargets(),
    });
    const tile = key ? this.currentMap.tilesByKey[key] : undefined;

    this.updateHoveredTileKey(tile ? key : null);
  }

  clearHoveredTile() {
    this.updateHoveredTileKey(null);
  }

  destroy() {
    this.tileColorLayer.destroy();
    this.hexOutlineLayer.destroy();
    this.tileElevationLayer.destroy();
    this.interactionLayer.destroy();
    this.currentMap = null;
    this.currentRenderConfig = normalizeMapRenderConfig(DEFAULT_MAP_RENDER_CONFIG);
    this.hoveredTileKey = null;
    this.hoveredTileChangeHandler = null;
  }

  private renderCurrentMap() {
    if (!this.currentMap) {
      return;
    }

    const tileRenderData = buildMapTileRenderData(this.currentMap);

    this.interactionLayer.render(this.currentMap, tileRenderData);
    this.tileColorLayer.render(this.currentMap, tileRenderData, this.currentRenderConfig.tileColor);
    this.hexOutlineLayer.render(
      this.currentMap,
      tileRenderData,
      this.currentRenderConfig.hexOutline,
    );
    this.tileElevationLayer.render(this.currentMap, this.currentRenderConfig.elevation);

    if (!this.hoveredTileKey) {
      return;
    }

    const hoveredTile = this.currentMap.tilesByKey[this.hoveredTileKey];

    if (!hoveredTile) {
      this.updateHoveredTileKey(null);
      return;
    }

    this.notifyHoveredTileChange(this.hoveredTileKey, hoveredTile);
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
