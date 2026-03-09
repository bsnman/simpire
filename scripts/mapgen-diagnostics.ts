import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ARCHIPELAGO_GENERATOR_ID, CONTINENTS_GENERATOR_ID } from '~/game/mapgen';
import { runMapgenDiagnostics } from '~/game/mapgen/diagnostics';

const DIAGNOSTIC_SAMPLE_COUNT = 12;
const OUTPUT_PATH = resolve(process.cwd(), 'documentation/mapgen-baseline-metrics.json');

const reports = [
  runMapgenDiagnostics({
    algorithmId: CONTINENTS_GENERATOR_ID,
    width: 44,
    height: 30,
    sampleCount: DIAGNOSTIC_SAMPLE_COUNT,
    seedPrefix: 'baseline-continents',
    params: {
      landRatio: 0.33,
      continentCountTarget: 3,
      tectonicStrength: 0.62,
      coastlineRoughness: 0.57,
      mountainIntensity: 0.58,
    },
  }),
  runMapgenDiagnostics({
    algorithmId: ARCHIPELAGO_GENERATOR_ID,
    width: 44,
    height: 30,
    sampleCount: DIAGNOSTIC_SAMPLE_COUNT,
    seedPrefix: 'baseline-archipelago',
    params: {
      landRatio: 0.24,
      islandSizeBias: 0.3,
      chainTendency: 0.7,
      shelfWidth: 2,
      tectonicStrength: 0.52,
    },
  }),
];

const payload = {
  generatedAt: new Date().toISOString(),
  sampleCount: DIAGNOSTIC_SAMPLE_COUNT,
  reports: reports.map((report) => ({
    scenario: report.scenario,
    aggregate: report.aggregate,
  })),
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`Mapgen diagnostics baseline written to ${OUTPUT_PATH}`);
