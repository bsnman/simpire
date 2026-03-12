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

- Date:
- Summary of what was actually implemented:
- Deviations from this plan:
- Known issues or shortcuts left in place:
- Tests run:
- Follow-up advice for Phase 2:

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

- Date:
- Summary of what was actually implemented:
- Deviations from this plan:
- Known issues or shortcuts left in place:
- Tests run:
- Follow-up advice for Phase 3:

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

The implementing agent must append remarks here before ending the phase:

- Date:
- Summary of what was actually implemented:
- Deviations from this plan:
- Known issues or shortcuts left in place:
- Tests run:
- Final architecture notes:

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

