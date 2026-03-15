import type { ElevationType } from '~/base/elevation';
import type { TerrainFeatureType } from '~/base/terrainFeatures';
import type { HexKey } from '~/types/hex';

export const MAP_LAYER_GROUP_NAME = 'map-layer/root';
export const MAP_TILE_COLOR_LAYER_GROUP_NAME = 'map-layer/tile-color';
export const MAP_HEX_OUTLINE_LAYER_GROUP_NAME = 'map-layer/hex-outline';
export const MAP_ELEVATION_LAYER_GROUP_NAME = 'map-layer/elevation';
export const MAP_TERRAIN_FEATURE_LAYER_GROUP_NAME = 'map-layer/terrain-feature';
export const MAP_INTERACTION_LAYER_GROUP_NAME = 'map-layer/interaction';

export const buildMapTileColorObjectName = (tileKey: HexKey): string =>
  `${MAP_TILE_COLOR_LAYER_GROUP_NAME}:${tileKey}`;

export const buildMapHexOutlineObjectName = (tileKey: HexKey): string =>
  `${MAP_HEX_OUTLINE_LAYER_GROUP_NAME}:${tileKey}`;

export const buildMapElevationObjectName = (tileKey: HexKey, elevation: ElevationType): string =>
  `${MAP_ELEVATION_LAYER_GROUP_NAME}:${elevation}:${tileKey}`;

export const buildMapElevationBatchGroupName = (elevation: ElevationType): string =>
  `${MAP_ELEVATION_LAYER_GROUP_NAME}:${elevation}:batch`;

export const buildMapElevationBatchMeshObjectName = (
  elevation: ElevationType,
  meshIndex: number,
): string => `${MAP_ELEVATION_LAYER_GROUP_NAME}:${elevation}:batch:mesh:${meshIndex}`;

export const buildMapTerrainFeatureClusterObjectName = (
  tileKey: HexKey,
  terrainFeatureId: TerrainFeatureType,
): string => `${MAP_TERRAIN_FEATURE_LAYER_GROUP_NAME}:${terrainFeatureId}:${tileKey}`;

export const buildMapTerrainFeatureInstanceObjectName = (
  tileKey: HexKey,
  terrainFeatureId: TerrainFeatureType,
  instanceIndex: number,
): string =>
  `${MAP_TERRAIN_FEATURE_LAYER_GROUP_NAME}:${terrainFeatureId}:${tileKey}:instance:${instanceIndex}`;

export const buildMapTerrainFeatureBatchGroupName = (
  terrainFeatureId: TerrainFeatureType,
): string => `${MAP_TERRAIN_FEATURE_LAYER_GROUP_NAME}:${terrainFeatureId}:batch`;

export const buildMapTerrainFeatureBatchMeshObjectName = (
  terrainFeatureId: TerrainFeatureType,
  meshIndex: number,
): string => `${MAP_TERRAIN_FEATURE_LAYER_GROUP_NAME}:${terrainFeatureId}:batch:mesh:${meshIndex}`;

export const buildMapInteractionObjectName = (tileKey: HexKey): string =>
  `${MAP_INTERACTION_LAYER_GROUP_NAME}:${tileKey}`;
