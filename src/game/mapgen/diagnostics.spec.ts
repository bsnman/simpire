import { runMapgenDiagnostics, type MapgenDiagnosticsScenario } from '~/game/mapgen/diagnostics';
import { ARCHIPELAGO_GENERATOR_ID, CONTINENTS_GENERATOR_ID } from '~/game/mapgen';

const buildScenario = (
  algorithmId: string,
  params: unknown,
  seedPrefix: string,
): MapgenDiagnosticsScenario => ({
  algorithmId,
  width: 38,
  height: 28,
  params,
  sampleCount: 8,
  seedPrefix,
});

describe('mapgen diagnostics harness', () => {
  it('is deterministic for identical scenario inputs', () => {
    const scenario = buildScenario(
      CONTINENTS_GENERATOR_ID,
      {
        landRatio: 0.33,
        continentCountTarget: 3,
        tectonicStrength: 0.62,
        coastlineRoughness: 0.57,
        mountainIntensity: 0.58,
      },
      'diagnostics-deterministic',
    );

    expect(runMapgenDiagnostics(scenario)).toEqual(runMapgenDiagnostics(scenario));
  });

  it('reports bounded aggregate metrics for both built-in scripts', () => {
    const continentsReport = runMapgenDiagnostics(
      buildScenario(
        CONTINENTS_GENERATOR_ID,
        {
          landRatio: 0.33,
          continentCountTarget: 3,
          tectonicStrength: 0.61,
          coastlineRoughness: 0.56,
          mountainIntensity: 0.56,
        },
        'diag-continents',
      ),
    );

    const archipelagoReport = runMapgenDiagnostics(
      buildScenario(
        ARCHIPELAGO_GENERATOR_ID,
        {
          landRatio: 0.24,
          islandSizeBias: 0.3,
          chainTendency: 0.7,
          shelfWidth: 2,
          tectonicStrength: 0.52,
        },
        'diag-archipelago',
      ),
    );

    expect(continentsReport.aggregate.landRatio.average).toBeGreaterThan(0.29);
    expect(continentsReport.aggregate.landRatio.average).toBeLessThan(0.37);
    expect(archipelagoReport.aggregate.landRatio.average).toBeGreaterThan(0.2);
    expect(archipelagoReport.aggregate.landRatio.average).toBeLessThan(0.28);

    expect(continentsReport.aggregate.directionalityScore.maximum).toBeLessThan(0.2);
    expect(archipelagoReport.aggregate.directionalityScore.maximum).toBeLessThan(0.2);
  });
});
