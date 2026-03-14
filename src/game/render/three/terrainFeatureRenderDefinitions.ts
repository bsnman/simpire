import type { ElevationType } from '~/base/elevation';
import type { TerrainFeatureType } from '~/base/terrainFeatures';

export type TerrainFeatureAnchor = {
  x: number;
  y: number;
  z: number;
};

export type TerrainFeatureRenderDefinition = {
  modelPath: string;
  baseScale: number;
  anchorsByElevation: Partial<Record<ElevationType, readonly TerrainFeatureAnchor[]>>;
};

const FOREST_FLAT_ANCHORS: readonly TerrainFeatureAnchor[] = [
  { x: -0.44, y: 0.28, z: 0.015 },
  { x: 0.2, y: 0.4, z: 0.02 },
  { x: 0.44, y: -0.16, z: 0.014 },
  { x: -0.12, y: -0.44, z: 0.018 },
  { x: 0.04, y: 0.04, z: 0.028 },
  { x: -0.36, y: -0.04, z: 0.01 },
  { x: 0.32, y: -0.36, z: 0.012 },
  { x: -0.24, y: 0.36, z: 0.022 },
] as const;

const FOREST_HILL_ANCHORS: readonly TerrainFeatureAnchor[] = [
  { x: -0.4, y: 0.16, z: 0.49 },
  { x: -0.08, y: 0.44, z: 0.52 },
  { x: 0.36, y: 0.1, z: 0.5 },
  { x: 0.24, y: -0.34, z: 0.44 },
  { x: -0.2, y: -0.36, z: 0.46 },
  { x: 0.04, y: -0.04, z: 0.58 },
  { x: -0.32, y: -0.2, z: 0.48 },
  { x: 0.28, y: 0.32, z: 0.46 },
] as const;

export const terrainFeatureRenderDefinitions: Partial<
  Record<TerrainFeatureType, TerrainFeatureRenderDefinition>
> = {
  forest: {
    modelPath: '/models/terrain-features/forest-pine-v1-source.glb',
    baseScale: 0.16,
    anchorsByElevation: {
      flat: FOREST_FLAT_ANCHORS,
      hill: FOREST_HILL_ANCHORS,
    },
  },
};
