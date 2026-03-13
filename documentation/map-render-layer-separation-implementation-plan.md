# Map Render Layer Separation Implementation Plan

## Goal

Refactor map rendering so hex tile fill color, hex outline lines, and elevation decorations are independent render layers with configurable enable/disable controls.

The target user-facing outcome is:

- tile color can be hidden without removing the rest of the map rendering
- hex outline lines can be hidden independently
- elevation visuals (hills and mountains) can be hidden independently
- renderer behavior stays deterministic for identical map input
- gameplay/domain map data stays unchanged

## Why This Change Is Needed

Current rendering couples three concerns inside [`src/game/render/layers/MapLayer.ts`](../src/game/render/layers/MapLayer.ts):

- tile fill color
- hex border lines
- elevation decorations

That coupling creates three problems:

1. A caller cannot disable one concern without editing the whole layer.
2. Hover picking currently depends on the same tile meshes used for visible rendering, so disabling the fill layer would also break tile hover.
3. `HexTileMeshFactory` currently creates both fill and outline together, which prevents separate lifecycle/config ownership.

## Non-Goals

- Do not change `GameMap`, `MapTile`, map generation contracts, or store tile semantics.
- Do not move renderer settings into gameplay state.
- Do not redesign terrain feature/resource/unit rendering as part of this work.
- Do not add real terrain extrusion; elevation remains decorative visuals only.

## Current Baseline

As of March 13, 2026:

- [`src/game/render/GameRenderer.ts`](../src/game/render/GameRenderer.ts) owns one `MapLayer`.
- [`src/game/render/layers/MapLayer.ts`](../src/game/render/layers/MapLayer.ts) creates visible tile meshes, border lines, and the terrain decoration group.
- [`src/game/render/three/HexTileMeshFactory.ts`](../src/game/render/three/HexTileMeshFactory.ts) builds both the tile fill mesh and the `LineLoop` border.
- [`src/game/render/three/TerrainDecorationFactory.ts`](../src/game/render/three/TerrainDecorationFactory.ts) creates hill/mountain models.
- Hover picking raycasts against the visible tile meshes created by `MapLayer`.

## Target Architecture

Keep `MapLayer` as the public composite owned by `GameRenderer`, but split its internals into focused sublayers.

### Visual layers

- `TileColorLayer`
  - Responsible only for visible tile fill meshes and tile color material reuse.
- `HexOutlineLayer`
  - Responsible only for hex border line objects/materials.
- `TileElevationLayer`
  - Responsible only for hill/mountain decoration rendering via `TerrainDecorationFactory`.

### Internal non-visual layer

- `MapInteractionLayer`
  - Responsible only for hover/raycast targets.
  - Not user-toggleable.
  - Exists so hover still works even when visual layers are disabled.

This internal interaction layer is the key architectural requirement. Without it, disabling tile color would unintentionally disable hover picking.

## Config Model

Renderer config should live in renderer code, not in `GameMap` or the current game store.

Recommended contract:

```ts
export type MapRenderLayerId = 'tileColor' | 'hexOutline' | 'elevation';

export type TileColorLayerConfig = {
  enabled: boolean;
  fallbackTileColor: string;
};

export type HexOutlineLayerConfig = {
  enabled: boolean;
  color: string;
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
```

Recommended defaults:

```ts
export const DEFAULT_MAP_RENDER_CONFIG: MapRenderConfig = {
  tileColor: {
    enabled: true,
    fallbackTileColor: '#6B7280',
  },
  hexOutline: {
    enabled: true,
    color: '#1D1D1D',
    zOffset: 0.05,
  },
  elevation: {
    enabled: true,
    zOffset: 1,
    scaleMultiplier: 0.75,
  },
};
```

Notes:

- Keep the initial config minimal. Only add fields that already map to existing behavior.
- Avoid adding config for terrain/resource/feature semantics here. This config is renderer-only.
- Prefer a normalize/merge helper so partial updates can be accepted safely.

## Public API Direction

Recommended public renderer API additions:

```ts
setMapRenderConfig(config: Partial<MapRenderConfig>): void;
getMapRenderConfig(): MapRenderConfig;
```

Recommended internal `MapLayer` API:

```ts
render(map: GameMap, config: MapRenderConfig): void;
setRenderConfig(config: MapRenderConfig): void;
```

Behavior expectations:

- Changing config should trigger a visual update even when `currentMap` did not change.
- Hovered tile callbacks should continue to work after config changes.
- If all three visual layers are disabled, the canvas may appear blank, but hover should still resolve through `MapInteractionLayer`.

## Suggested File Shape

Keep `GameRenderer` and `MapLayer` as stable entry points. Add sublayer modules beside the existing layer file.

- `src/game/render/GameRenderer.ts`
- `src/game/render/layers/MapLayer.ts`
- `src/game/render/layers/TileColorLayer.ts`
- `src/game/render/layers/HexOutlineLayer.ts`
- `src/game/render/layers/TileElevationLayer.ts`
- `src/game/render/layers/MapInteractionLayer.ts`
- `src/game/render/mapRenderConfig.ts`

Renderer helper split recommendation:

- Replace the current combined responsibilities in `HexTileMeshFactory` with either:
  - a fill-focused factory plus an outline-focused factory, or
  - two narrowly named creation methods with separate callers

The first option is preferred because it keeps lifetime and caching ownership explicit.

## Phase Plan

## Phase 1: Contracts And Internal Layer Extraction

### Objective

Split `MapLayer` into sublayers and add the renderer config contracts, but keep external view integration minimal.

### Tasks

1. Add `mapRenderConfig.ts` with:
   - `MapRenderConfig`
   - defaults
   - config normalization/merge helper
2. Extract the combined mesh creation in `HexTileMeshFactory` so tile fill and outline are no longer created together.
3. Create `TileColorLayer`, `HexOutlineLayer`, and `TileElevationLayer`.
4. Create `MapInteractionLayer` with invisible but raycastable tile hit targets.
5. Refactor `MapLayer` into an orchestrator that:
   - owns the four sublayers
   - passes normalized config into visual sublayers
   - keeps hover behavior wired to `MapInteractionLayer`
6. Keep `GameRenderer.renderMap(map)` working by using default config if no custom config is set yet.

### Acceptance Criteria

- Rendering matches current visuals when default config is used.
- Each of the three visual layers can be independently disabled in code.
- Hover picking still works when `tileColor.enabled` is `false`.
- Hover picking still works when all three visual layers are disabled.
- `MapLayer` no longer directly constructs fill, outline, and elevation visuals in one render loop.

### Recommended Tests

- unit test for config normalization/default merge
- layer-level test that disabling each visual layer removes only that layer's objects
- raycast test proving hover still resolves when visible tile color is disabled

### Phase 1 Handoff Notes

The implementing agent must append remarks here before ending the phase:

- Date: March 13, 2026
- Summary of what was actually implemented: Added `mapRenderConfig.ts` with defaults plus normalize/merge helpers; split fill, outline, elevation, and hover-hit responsibilities into `TileColorLayer`, `HexOutlineLayer`, `TileElevationLayer`, and `MapInteractionLayer`; refactored `MapLayer` into a composite orchestrator; split fill versus outline factory responsibilities; updated `TerrainDecorationFactory` to receive elevation layer config; kept `GameRenderer.renderMap(map)` working with default config; added Phase 1 renderer tests for config merging, independent layer visibility, and hover picking with visual layers disabled.
- Deviations from this plan: Used dedicated helper factories (`HexOutlineMeshFactory`, `HexInteractionMeshFactory`) instead of exposing multiple creation methods from one factory. `MapLayer.setRenderConfig(...)` was added internally ahead of Phase 2, but no public `GameRenderer` config API or UI wiring was introduced.
- Known issues or shortcuts left in place: The repo-wide `/...` import alias standard still conflicts with the actual configured `~/*` alias, so this phase kept the existing alias style rather than broadening scope into toolchain/import migration. Layer updates still rebuild full object sets, which remains acceptable for the current prototype stage.
- Tests run: `npm test` (renderer tests passed, suite still has an unrelated failure in `src/base/terrainFeatures.spec.ts`), `npx vitest run src/game/render/mapRenderConfig.spec.ts src/game/render/layers/MapLayer.spec.ts`, `npm run build`
- Follow-up advice for Phase 2: Store the normalized config in `GameRenderer`, expose `setMapRenderConfig(...)` and `getMapRenderConfig()`, and wire a renderer/debug-only control surface that toggles layers without touching gameplay state.

## Phase 2: Renderer API And View-Level Control Wiring

### Objective

Expose runtime config updates through `GameRenderer` and wire a caller path that can toggle layers without rebuilding architecture again.

### Tasks

1. Add `GameRenderer.setMapRenderConfig(...)` and `getMapRenderConfig()`.
2. Store the normalized render config in `GameRenderer`, not in gameplay state.
3. Make config changes trigger `MapLayer` redraw/rebuild against the last rendered map.
4. Decide the first control surface:
   - lowest-risk option: temporary debug toggles in `GameView.vue`
   - cleaner long-term option: dedicated renderer/debug store for view-only preferences
5. If UI toggles are added, keep them explicitly labeled as renderer/debug settings, not gameplay settings.

### Acceptance Criteria

- A caller can toggle tile color, hex outlines, and elevation independently at runtime.
- Config changes do not require regenerating the map.
- Hover tile panel remains correct after toggles.
- No gameplay/domain store contract changes are required.

### Recommended Tests

- renderer test for `setMapRenderConfig()` causing redraw with last known map
- view integration test if UI toggles are added

### Phase 2 Handoff Notes

The implementing agent must append remarks here before ending the phase:

- Date: March 13, 2026
- Summary of what was actually implemented: Added renderer-owned map render config state to `GameRenderer`; exposed `setMapRenderConfig(...)` and `getMapRenderConfig()`; stored the last rendered map so runtime config changes redraw without regenerating map data; wired temporary renderer/debug checkboxes into `GameView.vue` so tile color, hex outlines, and elevation can be toggled independently at runtime; added `GameRenderer.spec.ts` covering redraw-on-config-change and partial-config merge behavior.
- Deviations from this plan: Chose the lowest-risk temporary control surface in `GameView.vue` instead of introducing a dedicated renderer/debug preference store in Phase 2. `GameRenderer.setMapRenderConfig(...)` accepts the existing partial `MapRenderConfigInput` contract rather than a shallow `Partial<MapRenderConfig>` so nested layer updates remain type-safe.
- Known issues or shortcuts left in place: Renderer layer toggle state is view-local and not persisted across page reloads. The debug panel is still named around map generation even though it now also hosts renderer-only controls. Full map redraw/rebuild remains the update path for config changes, which is acceptable at current prototype scale.
- Tests run: `npx vitest run src/game/render/GameRenderer.spec.ts src/game/render/mapRenderConfig.spec.ts src/game/render/layers/MapLayer.spec.ts`, `npm run build`, `npm test` (still fails in unrelated `src/base/terrainFeatures.spec.ts`)
- Follow-up advice for Phase 3: Consider splitting renderer debug controls into their own panel/store if they continue to grow, then harden cleanup/disposal paths and make the scene group naming even more explicit for Three.js inspector/debugging workflows.

## Phase 3: Hardening, Cleanup, And Documentation Sync

### Objective

Stabilize naming, remove transitional code, and make the architecture obvious for future renderer layers.

### Tasks

1. Remove temporary compatibility code that was only needed during the split.
2. Make group names deterministic and easy to inspect in scene debugging.
3. Confirm `destroy()` paths dispose layer-specific caches/materials cleanly.
4. Update renderer documentation if the final implementation differs materially from this plan.
5. If the resulting pattern is now the renderer standard, update `documentation/technical-guidance.md` and `AGENTS.md`.

### Acceptance Criteria

- No dead compatibility branches remain.
- Layer ownership is obvious from filenames and group names.
- `destroy()` does not leak sublayer resources.
- Documentation reflects the actual design.

### Recommended Tests

- smoke test for repeated config toggles and repeated `renderMap` calls
- targeted disposal test where practical

### Phase 3 Handoff Notes

- Date: March 13, 2026
- Summary of what was actually implemented: Removed the unused transitional `MapLayer.setRenderConfig(...)` API; centralized deterministic map layer and per-object naming in `src/game/render/layers/mapLayerObjectNames.ts`; updated fill/outline/interaction/elevation render objects to use those names; hardened `TerrainDecorationFactory` so loaded template geometry/material/texture resources are disposed on destroy and late async template loads are disposed instead of being retained after teardown; cleaned the temporary debug panel copy in `GameView.vue` so it explicitly covers both map and renderer debugging; added Phase 3 tests for repeated config toggles/re-rendering and for terrain-decoration disposal/naming.
- Deviations from this plan: Kept the existing temporary debug control surface in `GameView.vue` and the mapgen debug store instead of splitting renderer controls into a dedicated panel/store. Group-name hardening was implemented with shared constants rather than a broader renderer inspector utility layer.
- Known issues or shortcuts left in place: Config changes and map changes still rebuild full layer object sets, which remains acceptable at current prototype scale. The debug toggle state is still view-local rather than persisted. `npm test` still has an unrelated baseline failure in `src/base/terrainFeatures.spec.ts`.
- Tests run: `npx vitest run src/game/render/GameRenderer.spec.ts src/game/render/mapRenderConfig.spec.ts src/game/render/layers/MapLayer.spec.ts src/game/render/three/TerrainDecorationFactory.spec.ts`, `npm run build`, `npm test` (still fails in unrelated `src/base/terrainFeatures.spec.ts`)
- Final architecture notes: `GameRenderer` owns renderer-only config and redraw orchestration; `MapLayer` remains the composite entry point; visual tile fill, outlines, and elevation decorations stay independent from the always-on `MapInteractionLayer`; shared deterministic names now make scene inspection and renderer tests target the same structure; terrain decoration asset cleanup is safe even when destroy happens before async model loads finish.

## Design Decisions The Next Agent Should Preserve

1. Keep map render config outside gameplay/domain state.
2. Keep `MapLayer` as a composite entry point so `GameRenderer` does not start coordinating many child layers directly.
3. Keep hover picking independent from visible layer enablement.
4. Keep deterministic `map.tileKeys` iteration order for all sublayers.
5. Keep the design extension-friendly so future terrain-feature/resource/unit layers can follow the same pattern.

## Main Risks And Mitigations

- Risk: hover regression after tile color split
  - Mitigation: create `MapInteractionLayer` first and switch raycasts to it before enabling layer toggles

- Risk: duplicated coordinate iteration and object churn across sublayers
  - Mitigation: correctness first, but keep shared tile-center derivation logic in `MapLayer` or a pure helper if duplication becomes noisy

- Risk: config API expands too early
  - Mitigation: start with `enabled` plus only the few existing constants already present in code

- Risk: settings accidentally leak into gameplay persistence
  - Mitigation: keep the first implementation entirely renderer-owned unless a separate debug/view store is intentionally introduced

## Suggested Order For The Next AI Agent

1. Implement Phase 1 only.
2. Update this document's Phase 1 handoff notes with concrete remarks.
3. Stop after tests pass and leave Phase 2 for the following agent unless there is still clear time and no unresolved renderer regressions.
