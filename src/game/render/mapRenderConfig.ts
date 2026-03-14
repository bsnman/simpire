export type MapRenderLayerId = 'tileColor' | 'hexOutline' | 'elevation';

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

export type MapRenderConfig = {
  tileColor: TileColorLayerConfig;
  hexOutline: HexOutlineLayerConfig;
  elevation: ElevationLayerConfig;
};

export type MapRenderConfigInput = {
  tileColor?: Partial<TileColorLayerConfig>;
  hexOutline?: Partial<HexOutlineLayerConfig>;
  elevation?: Partial<ElevationLayerConfig>;
};

export const DEFAULT_MAP_RENDER_CONFIG: MapRenderConfig = {
  tileColor: {
    enabled: true,
    fallbackTileColor: '#6B7280',
  },
  hexOutline: {
    enabled: true,
    color: '#5D5D5D',
    thickness: 1,
    zOffset: 0.05,
  },
  elevation: {
    enabled: true,
    zOffset: 0.05,
    scaleMultiplier: 1.1,
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

export const normalizeMapRenderConfig = (
  config?: MapRenderConfigInput | null,
): MapRenderConfig => ({
  tileColor: normalizeTileColorLayerConfig(config?.tileColor),
  hexOutline: normalizeHexOutlineLayerConfig(config?.hexOutline),
  elevation: normalizeElevationLayerConfig(config?.elevation),
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
});
