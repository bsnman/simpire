import type { TerrainFeatureType } from '~/base/terrainFeatures';

export type MapRenderLayerId = 'tileColor' | 'hexOutline' | 'elevation' | 'terrainFeature';

export type TileColorLayerConfig = {
  enabled: boolean;
  fallbackTileColor: string;
};

export type HexOutlineLayerConfig = {
  enabled: boolean;
  color: string;
  thickness: number;
  zOffset: number;
};

export type ElevationLayerConfig = {
  enabled: boolean;
  zOffset: number;
  scaleMultiplier: number;
};

export type TerrainFeatureLayerFeatureOverride = {
  enabled?: boolean;
  instancesPerTile?: number;
  scaleMultiplier?: number;
};

export type TerrainFeatureLayerConfig = {
  enabled: boolean;
  instancesPerTile: number;
  scaleMultiplier: number;
  featureOverrides: Partial<Record<TerrainFeatureType, TerrainFeatureLayerFeatureOverride>>;
};

export type MapRenderConfig = {
  tileColor: TileColorLayerConfig;
  hexOutline: HexOutlineLayerConfig;
  elevation: ElevationLayerConfig;
  terrainFeature: TerrainFeatureLayerConfig;
};

export type MapRenderConfigInput = {
  tileColor?: Partial<TileColorLayerConfig>;
  hexOutline?: Partial<HexOutlineLayerConfig>;
  elevation?: Partial<ElevationLayerConfig>;
  terrainFeature?: Partial<Omit<TerrainFeatureLayerConfig, 'featureOverrides'>> & {
    featureOverrides?: Partial<Record<TerrainFeatureType, TerrainFeatureLayerFeatureOverride>>;
  };
};

export const DEFAULT_MAP_RENDER_CONFIG: MapRenderConfig = {
  tileColor: {
    enabled: true,
    fallbackTileColor: '#6B7280',
  },
  hexOutline: {
    enabled: true,
    color: '#ADADAD',
    thickness: 1,
    zOffset: 0.05,
  },
  elevation: {
    enabled: true,
    zOffset: 0.1,
    scaleMultiplier: 1.15,
  },
  terrainFeature: {
    enabled: true,
    instancesPerTile: 8,
    scaleMultiplier: 3,
    featureOverrides: {},
  },
};

const normalizeTileColorLayerConfig = (
  config?: Partial<TileColorLayerConfig>,
): TileColorLayerConfig => ({
  enabled: config?.enabled ?? DEFAULT_MAP_RENDER_CONFIG.tileColor.enabled,
  fallbackTileColor:
    config?.fallbackTileColor ?? DEFAULT_MAP_RENDER_CONFIG.tileColor.fallbackTileColor,
});

const normalizeHexOutlineLayerConfig = (
  config?: Partial<HexOutlineLayerConfig>,
): HexOutlineLayerConfig => ({
  enabled: config?.enabled ?? DEFAULT_MAP_RENDER_CONFIG.hexOutline.enabled,
  color: config?.color ?? DEFAULT_MAP_RENDER_CONFIG.hexOutline.color,
  thickness: config?.thickness ?? DEFAULT_MAP_RENDER_CONFIG.hexOutline.thickness,
  zOffset: config?.zOffset ?? DEFAULT_MAP_RENDER_CONFIG.hexOutline.zOffset,
});

const normalizeElevationLayerConfig = (
  config?: Partial<ElevationLayerConfig>,
): ElevationLayerConfig => ({
  enabled: config?.enabled ?? DEFAULT_MAP_RENDER_CONFIG.elevation.enabled,
  zOffset: config?.zOffset ?? DEFAULT_MAP_RENDER_CONFIG.elevation.zOffset,
  scaleMultiplier: config?.scaleMultiplier ?? DEFAULT_MAP_RENDER_CONFIG.elevation.scaleMultiplier,
});

const normalizeTerrainFeatureOverrides = (
  overrides?: Partial<Record<TerrainFeatureType, TerrainFeatureLayerFeatureOverride>>,
): Partial<Record<TerrainFeatureType, TerrainFeatureLayerFeatureOverride>> => {
  if (!overrides) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(overrides).map(([featureId, override]) => [featureId, { ...override }]),
  ) as Partial<Record<TerrainFeatureType, TerrainFeatureLayerFeatureOverride>>;
};

const normalizeTerrainFeatureLayerConfig = (
  config?: MapRenderConfigInput['terrainFeature'],
): TerrainFeatureLayerConfig => ({
  enabled: config?.enabled ?? DEFAULT_MAP_RENDER_CONFIG.terrainFeature.enabled,
  instancesPerTile:
    config?.instancesPerTile ?? DEFAULT_MAP_RENDER_CONFIG.terrainFeature.instancesPerTile,
  scaleMultiplier:
    config?.scaleMultiplier ?? DEFAULT_MAP_RENDER_CONFIG.terrainFeature.scaleMultiplier,
  featureOverrides: normalizeTerrainFeatureOverrides(config?.featureOverrides),
});

export const normalizeMapRenderConfig = (
  config?: MapRenderConfigInput | null,
): MapRenderConfig => ({
  tileColor: normalizeTileColorLayerConfig(config?.tileColor),
  hexOutline: normalizeHexOutlineLayerConfig(config?.hexOutline),
  elevation: normalizeElevationLayerConfig(config?.elevation),
  terrainFeature: normalizeTerrainFeatureLayerConfig(config?.terrainFeature),
});

export const mergeMapRenderConfig = (
  currentConfig: MapRenderConfig,
  nextConfig?: MapRenderConfigInput | null,
): MapRenderConfig => ({
  tileColor: {
    ...currentConfig.tileColor,
    ...nextConfig?.tileColor,
  },
  hexOutline: {
    ...currentConfig.hexOutline,
    ...nextConfig?.hexOutline,
  },
  elevation: {
    ...currentConfig.elevation,
    ...nextConfig?.elevation,
  },
  terrainFeature: {
    ...currentConfig.terrainFeature,
    ...nextConfig?.terrainFeature,
    featureOverrides: {
      ...currentConfig.terrainFeature.featureOverrides,
      ...nextConfig?.terrainFeature?.featureOverrides,
    },
  },
});
