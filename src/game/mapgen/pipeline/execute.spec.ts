import { generateMap } from '/game/mapgen';
import { createMapDigest } from '/game/mapgen/repro';
import { MAPGEN_PIPELINE_STAGES } from '/game/mapgen/pipeline/execute';

describe('mapgen pipeline execution', () => {
  it('declares the pipeline stages in explicit execution order', () => {
    expect(MAPGEN_PIPELINE_STAGES.map((stage) => stage.id)).toEqual([
      '01-bootstrap',
      '02-macro-regions',
      '03-land-mask',
      '04-tectonics',
      '05-detail-noise',
      '06-terrain-classification',
      '07-elevation-spray',
      '08-terrain-features',
      '09-finalize',
    ]);
  });

  it('preserves the fixed-seed end-to-end map digest across the restructure', () => {
    const map = generateMap({
      algorithmId: 'continents',
      width: 36,
      height: 24,
      seedHash: 'pipeline-restructure-baseline',
      params: {
        landRatio: 0.33,
        continentCountTarget: 3,
        tectonicStrength: 0.62,
        coastlineRoughness: 0.57,
        mountainIntensity: 0.58,
        elevationSprayDensity: 0.5,
      },
    });

    expect(createMapDigest(map)).toBe('fnv1a:a43ad8c1');
  });
});
