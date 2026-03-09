# Map Generation Implementation Plan (Post-Research)

Purpose: define a concrete, implementation-ready plan to replace the current map generation algorithms using the direction in `documentation/map-generation-research.md`.

## 1. Decision Summary

- Replace the current `continents` and `archipelago` internals (single score + percentile threshold) with a multi-stage pipeline.
- Keep the existing mapgen contract/registry model so modding support remains first-class.
- Build new pipeline modules first, then migrate generator IDs with minimal UI/store disruption.
- Maintain deterministic output for identical `(algorithmId, width, height, seedHash, params)`.

## 2. Scope

In scope for this implementation cycle:

- Macro land/ocean generation with Poisson + Voronoi regions.
- Tectonic-style elevation shaping at region boundaries.
- Isotropic detail pass (rotated noise blending + domain warp) to remove directional artifacts.
- Terrain classification into existing `TileType` values.
- Deterministic validation + map quality metrics harness.
- Vitest unit-test coverage for pipeline stages and generator contracts.
- Migration path that allows replacing current behavior safely.

Out of scope for first delivery (can follow immediately after):

- Full biome system beyond current terrain set.
- River rendering/gameplay integration.
- Start position placement and fairness balancing tied to full game rules.

## 3. Constraints and Compatibility

- Keep existing `GameMap`/`MapTile` output shape (`tilesByKey`, `tileKeys`).
- Keep generator extension model (`MapGeneratorDefinition`, registry, `registerMapGenerator`).
- Keep `parameterDefinitions` metadata so Create Game UI stays dynamic.
- Keep root import style (`~/...`) and deterministic standards (`no Math.random()`).
- Keep automated testing in Vitest (`npm test`) with unit specs colocated under `src/`.
- Ensure hex-neighbor symmetry and deterministic shuffled iteration to avoid directional bias.

## 4. Target Architecture

## 4.1 New Internal Pipeline Modules

Add a composable pipeline layer under `src/game/mapgen/pipeline/`:

- `subseeds.ts`
- Derive named deterministic RNG/noise streams from `seedHash` (`macro`, `elevation`, `detail`, `climate`, `balance`).
- `grid.ts`
- Shared coordinate/index helpers and stable iteration utilities.
- `poisson.ts`
- Seeded Poisson disk sampling over map space.
- `voronoi.ts`
- Region assignment per tile from Poisson seeds.
- `macro-mask.ts`
- Convert regions into land/ocean mask with target land ratio and script controls.
- `tectonics.ts`
- Assign pseudo-plate vectors and compute boundary uplift/subsidence.
- `detail-noise.ts`
- Rotated multi-field noise blending + domain warp.
- `terrain-classify.ts`
- Convert elevation/water depth fields into existing terrain types.
- `metrics.ts`
- Directionality score, land ratio, landmass count, coastline complexity.

## 4.2 Generator Composition

Refactor `generators/continents.ts` and `generators/archipelago.ts` to become thin script definitions:

- Validate params.
- Build a script-specific config profile.
- Execute shared pipeline stages.
- Return `MapTile[]`.

This keeps algorithms mod-friendly and prevents duplicated logic between scripts.

## 4.3 Optional Contract Extension (Recommended)

Current `MapGeneratorContext` exposes only one RNG and one hash-noise function. For cleaner staged generation, add:

- `createRandomStream(name: string): SeededRandom`
- `noiseAtWithSeed(stream: string, q: number, r: number, salt?: string): number`

If contract changes are deferred, stage-specific seeds can be derived inside pipeline modules from `seedHash` without changing public APIs.

## 5. Implementation Phases

## Phase 0: Baseline and Safety Net

Tasks:

- Add a mapgen diagnostics script (dev-only) to generate many seeds and print quality metrics.
- Add initial Vitest mapgen test harness and shared fixtures for seed-sweep assertions.
- Capture baseline metrics for current `continents` and `archipelago`.
- Define acceptance thresholds for directional artifact reduction.

Acceptance:

- Deterministic run reproducibility confirmed.
- Baseline report committed for comparison.
- Baseline mapgen tests pass under `npm test`.

## Phase 1: Deterministic Foundations

Tasks:

- Implement subseed stream derivation and deterministic shuffled iteration utility.
- Implement shared field containers for per-tile scalar data (elevation/mask/etc.).
- Implement hex-symmetric neighbor helpers for iterative operations.
- Add unit tests for subseed derivation, stable shuffle order, and symmetric neighbor behavior.

Acceptance:

- Repeat runs are bit-identical.
- Iteration helpers avoid fixed directional scan bias.
- Unit tests prove stable output for repeated runs with identical inputs.

## Phase 2: Macro Structure (Poisson + Voronoi)

Tasks:

- Implement seeded Poisson sampling over map coordinates.
- Build Voronoi region assignment for all tiles.
- Implement macro land/ocean assignment with configurable land ratio and region-splitting logic.
- Add per-script controls:
- `continents`: continent target count, large-mass bias.
- `archipelago`: higher ocean share, island fragmentation bias, chain tendency.
- Add unit tests for land-ratio tolerance and macro profile differentiation between scripts.

Acceptance:

- Land ratio stays within a narrow tolerance of requested value.
- Landmass-size distribution differs clearly between continents and archipelago profiles.
- Unit tests verify deterministic region assignment for fixed seeds.

## Phase 3: Tectonic Elevation Pass

Tasks:

- Assign pseudo-plate movement vectors by region.
- Detect convergent/divergent boundaries.
- Apply uplift/depression fields around boundaries.
- Normalize to stable elevation bands.
- Add unit tests for boundary classification and bounded elevation normalization output.

Acceptance:

- Mountain/hill placement correlates with region boundaries, not random speckle.
- No directional artifacts introduced by boundary processing.
- Unit tests confirm tectonic pass preserves determinism.

## Phase 4: Detail and Coastline Pass

Tasks:

- Implement rotated noise blending (multiple angles/frequencies).
- Implement domain warping prior to threshold/classification.
- Apply detail perturbation to coastlines and elevation transitions.
- Add unit tests for deterministic detail perturbation and bounded field outputs.

Acceptance:

- Coastlines become less linear/repetitive.
- Directionality metric improves versus Phase 0 baseline.
- Unit tests cover detail-stage invariants across parameter extremes.

## Phase 5: Terrain Classification and Water Bands

Tasks:

- Convert fields into existing terrain set:
- Water: `ocean`, `deep_sea`, `coastal_sea`
- Land: `grassland`, `plains`, `hill`, `mountain`
- Replace/merge current `deriveSeaTerrains` behavior with depth-aware classification from generated fields.
- Add unit tests for terrain classification validity and terrain-ID compatibility with existing registries.

Acceptance:

- Output remains compatible with renderer/store.
- Resource placement constraints remain valid (no invalid terrain IDs).
- Unit tests confirm classification does not emit unsupported terrain types.

## Phase 6: Script Migration and Registry Rollout

Tasks:

- Keep existing IDs (`continents`, `archipelago`) but replace internals after validation.
- Optional: temporarily register `continents_v2` and `archipelago_v2` for A/B tests before final swap.
- Update defaults in store only if parameter shape changes.
- Add compatibility tests that ensure existing generator IDs still resolve and produce valid maps.

Acceptance:

- Existing UI flow still generates maps without additional view-layer changes.
- Legacy algorithm path removed or isolated behind dev flag after sign-off.
- Unit tests cover registry resolution and backward-compatible parameter handling.

## Phase 7: Validation and Hardening

Tasks:

- Expand deterministic Vitest suites for:
- same seed => identical map
- changed seed => measurably different map
- param extremes stay valid and bounded
- Expand regression tests for:
- land ratio tolerance
- landmass distribution expectations
- no dominant diagonal orientation across sampled seeds

Acceptance:

- `npm test` passes with all mapgen unit/regression suites.
- Metrics report demonstrates artifact reduction and stable gameplay-ready distributions.

## 6. Parameter Plan (Initial)

Keep parameters UI-friendly and script-specific:

- `continents`:
- `landRatio` (0..1)
- `continentCountTarget` (int)
- `tectonicStrength` (0..1)
- `coastlineRoughness` (0..1)
- `mountainIntensity` (0..1)

- `archipelago`:
- `landRatio` (0..1)
- `islandSizeBias` (0..1, lower = smaller islands)
- `chainTendency` (0..1)
- `shelfWidth` (int or normalized scalar)
- `tectonicStrength` (0..1)

Migration note:

- Existing `seaLevelPercent` maps naturally to `landRatio = 1 - seaLevelPercent/100`.

## 7. Risks and Mitigations

- Risk: Performance drop from Voronoi/tectonic passes.
- Mitigation: start with simple O(N*seedCount) where seedCount is bounded; optimize hotspots only after profiling.
- Risk: Overfitting to visual metrics and harming gameplay.
- Mitigation: keep map-quality + gameplay-shape metrics side by side.
- Risk: Contract churn breaking mods.
- Mitigation: preserve `MapGeneratorDefinition` and registry surface; keep extensions additive.

## 8. File-Level Change Plan

Expected touched files (implementation step, not now):

- `src/game/mapgen/contracts.ts` (optional additive context helpers)
- `src/game/mapgen/random.ts` (subseed utilities)
- `src/game/mapgen/helpers.ts` (split/retain shared generic helpers)
- `src/game/mapgen/generators/continents.ts` (pipeline-backed rewrite)
- `src/game/mapgen/generators/archipelago.ts` (pipeline-backed rewrite)
- `src/game/mapgen/index.ts` (optional temporary v2 registration)
- `src/game/mapgen/pipeline/*` (new modules)
- `src/game/mapgen/**/*.spec.ts` (new unit/regression suites for pipeline + generators)
- `src/stores/currentGame/map.ts` (only if default params shape changes)

## 9. Definition of Done

The map generation rewrite is done when:

- `continents` and `archipelago` use the new staged pipeline.
- diagonal/directional artifact is no longer dominant across sampled seeds.
- output remains deterministic and compatible with current store/renderer contracts.
- parameter metadata fully drives setup UI (no hardcoded per-view controls).
- Vitest unit/regression tests and metrics give repeatable evidence of improvement.

## 10. Immediate Next Step

Implement Phases 0-2 first (baseline metrics + deterministic foundation + macro structure), then review generated seed outputs before proceeding into tectonics/detail passes.
