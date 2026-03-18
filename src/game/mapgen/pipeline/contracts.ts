import type { MapQualityMetrics } from '/game/mapgen/analysis/metrics';
import type { MapGeneratorContext } from '/game/mapgen/contracts';
import type { MapGrid } from '/game/mapgen/pipeline/support/grid';
import type { PoissonSeedPoint } from '/game/mapgen/pipeline/support/poisson';
import type { SubseedStreams } from '/game/mapgen/pipeline/support/subseeds';
import type { VoronoiResult } from '/game/mapgen/pipeline/support/voronoi';
import type { MapTile } from '/types/map';

export type PipelineStageId =
  | '01-bootstrap'
  | '02-macro-regions'
  | '03-land-mask'
  | '04-tectonics'
  | '05-detail-noise'
  | '06-terrain-classification'
  | '07-elevation-spray'
  | '08-terrain-features'
  | '09-finalize';

export type MapgenPipelineProfile = {
  scriptId: string;
  landRatio: number;
  poissonMinDistance: number;
  poissonAttempts?: number;
  poissonMaxSeeds?: number;
  primaryRegionTarget: number;
  primaryRegionTargetMin?: number;
  primaryRegionTargetMax?: number;
  largeMassBias: number;
  fragmentation: number;
  chainTendency: number;
  edgeOceanBias: number;
  tectonicStrength: number;
  coastlineRoughness: number;
  mountainIntensity: number;
  elevationSprayDensity: number;
  shelfWidth: number;
};

export type PlateVector = {
  x: number;
  y: number;
};

export type MacroLandMaskState = {
  landMask: Uint8Array;
  regionScores: number[];
  regionScoreByTile: Float64Array;
  targetLandTiles: number;
  landTileCount: number;
};

export type TectonicState = {
  elevation: Float64Array;
  boundaryIntensity: Float64Array;
  plateVectors: PlateVector[];
};

export type DetailPassState = {
  landMask: Uint8Array;
  elevation: Float64Array;
  coastlineMutations: number;
};

export type TerrainClassificationState = {
  tiles: MapTile[];
  distanceToLand: Int32Array;
  distanceToWater: Int32Array;
};

export type MapgenPipelineDebug = {
  seedCount: number;
  regionCount: number;
  targetLandRatio: number;
  actualLandRatio: number;
};

export type MapgenPipelineResult = {
  tiles: MapTile[];
  metrics: MapQualityMetrics;
  debug: MapgenPipelineDebug;
};

export type MapgenPipelineState = {
  context: MapGeneratorContext;
  profile: MapgenPipelineProfile;
  grid?: MapGrid;
  subseeds?: SubseedStreams;
  clampedLandRatio?: number;
  primaryRegionTarget?: number;
  seeds?: PoissonSeedPoint[];
  voronoi?: VoronoiResult;
  macroLandMask?: MacroLandMaskState;
  tectonics?: TectonicState;
  detailPass?: DetailPassState;
  terrainClassification?: TerrainClassificationState;
  sprayedTiles?: MapTile[];
  tiles?: MapTile[];
  metrics?: MapQualityMetrics;
  debug?: MapgenPipelineDebug;
};

export type MapgenPipelineStage = {
  id: PipelineStageId;
  run: (state: MapgenPipelineState) => MapgenPipelineState;
};
