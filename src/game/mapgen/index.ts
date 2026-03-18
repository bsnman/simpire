import type {
  MapGenerationRequest,
  MapGeneratorDefinition,
  MapGeneratorRegistrationOptions,
} from '/game/mapgen/contracts';
import { archipelagoMapGenerator } from '/game/mapgen/generators/archipelago';
import { continentsMapGenerator } from '/game/mapgen/generators/continents';
import { MapGeneratorRegistry } from '/game/mapgen/registry';

export type {
  MapGenerationRequest,
  MapGeneratorContext,
  MapGeneratorDefinition,
  MapGeneratorNumericParameterDefinition,
  MapGeneratorRegistrationOptions,
  ValidationResult,
} from '/game/mapgen/contracts';
export type { SeededRandom } from '/game/mapgen/random';
export { MapGeneratorRegistry } from '/game/mapgen/registry';
export {
  ARCHIPELAGO_GENERATOR_ID,
  archipelagoMapGenerator,
  type ArchipelagoParams,
} from '/game/mapgen/generators/archipelago';
export {
  CONTINENTS_GENERATOR_ID,
  continentsMapGenerator,
  type ContinentsParams,
} from '/game/mapgen/generators/continents';

const mapGeneratorRegistry = new MapGeneratorRegistry();

mapGeneratorRegistry.register(continentsMapGenerator);
mapGeneratorRegistry.register(archipelagoMapGenerator);

export const registerMapGenerator = <TParams>(
  definition: MapGeneratorDefinition<TParams>,
  options?: MapGeneratorRegistrationOptions,
) => {
  mapGeneratorRegistry.register(definition, options);
};

export const getMapGenerator = (algorithmId: string) => mapGeneratorRegistry.get(algorithmId);

export const listMapGenerators = (): string[] => mapGeneratorRegistry.listIds();

export const generateMap = (request: MapGenerationRequest) =>
  mapGeneratorRegistry.generate(request);
