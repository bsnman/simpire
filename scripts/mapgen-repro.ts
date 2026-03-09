import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { generateMap } from '~/game/mapgen';
import {
  calculateMapQualityMetricsForMap,
  createMapDigest,
  parseMapgenReplayInput,
} from '~/game/mapgen/repro';

const usage = () => {
  console.error('Usage: npm run mapgen:repro -- <payload-json-file-or-inline-json>');
};

const inputArg = process.argv[2];

if (!inputArg) {
  usage();
  throw new Error('Missing payload input.');
}

const sourceText = inputArg.trim().startsWith('{')
  ? inputArg
  : readFileSync(resolve(process.cwd(), inputArg), 'utf8');
const replayInput = parseMapgenReplayInput(sourceText);

if (!replayInput.ok) {
  throw new Error(`Invalid mapgen replay payload: ${replayInput.error}`);
}

const generatedMap = generateMap(replayInput.value.request);
const metrics = calculateMapQualityMetricsForMap(replayInput.value.request, generatedMap);
const mapDigest = createMapDigest(generatedMap);

const report = {
  request: replayInput.value.request,
  metrics,
  mapDigest,
  expectedMapDigest: replayInput.value.expectedMapDigest,
  digestMatches:
    typeof replayInput.value.expectedMapDigest === 'string'
      ? replayInput.value.expectedMapDigest === mapDigest
      : undefined,
};

console.log(JSON.stringify(report, null, 2));
