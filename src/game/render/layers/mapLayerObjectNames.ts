import type { ElevationType } from '~/base/elevation';
import type { HexKey } from '~/types/hex';

export const MAP_LAYER_GROUP_NAME = 'map-layer/root';
export const MAP_TILE_COLOR_LAYER_GROUP_NAME = 'map-layer/tile-color';
export const MAP_HEX_OUTLINE_LAYER_GROUP_NAME = 'map-layer/hex-outline';
export const MAP_ELEVATION_LAYER_GROUP_NAME = 'map-layer/elevation';
export const MAP_INTERACTION_LAYER_GROUP_NAME = 'map-layer/interaction';

export const buildMapTileColorObjectName = (tileKey: HexKey): string =>
  `${MAP_TILE_COLOR_LAYER_GROUP_NAME}:${tileKey}`;

export const buildMapHexOutlineObjectName = (tileKey: HexKey): string =>
  `${MAP_HEX_OUTLINE_LAYER_GROUP_NAME}:${tileKey}`;

export const buildMapElevationObjectName = (tileKey: HexKey, elevation: ElevationType): string =>
  `${MAP_ELEVATION_LAYER_GROUP_NAME}:${elevation}:${tileKey}`;

export const buildMapInteractionObjectName = (tileKey: HexKey): string =>
  `${MAP_INTERACTION_LAYER_GROUP_NAME}:${tileKey}`;
