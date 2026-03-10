# Three.js Migration Implementation Plan

## Goal

Migrate the runtime renderer from PixiJS to Three.js while preserving current gameplay/data contracts, controls, and debug workflows.

## Scope

- In scope:
- Replace `src/game/render/GameRenderer.ts` Pixi implementation with a Three.js implementation behind the same public API so `GameView.vue` behavior remains stable.
- Replace `src/game/render/layers/MapLayer.ts` graphics drawing with Three.js mesh rendering for hex tiles.
- Preserve hover picking, zoom, drag pan, pointer-lock pan, edge pan, and arrow-key pan.
- Keep Pinia/domain contracts unchanged (`GameMap`, `MapTile`, `tilesByKey`, `tileKeys`, mapgen flows).
- Keep debug panel and tile info panel behavior unchanged.
- Add/adjust tests for math, camera controls, and renderer behaviors that can be verified in Vitest.

- Out of scope (phase 1):
- True terrain height/extrusion.
- Unit/resource 3D models.
- Lighting/post-processing polish.
- ECS/gameplay rule refactors.

## Constraints

- Renderer remains a state consumer; do not move gameplay logic into renderer.
- Preserve deterministic visual output for identical map input.
- Keep modding extension points intact (future layer/plugin registration should remain possible).
- Use root imports with `/...` for internal modules in new/edited files.

## Current Baseline (to preserve)

- `src/views/GameView.vue` owns lifecycle and input wiring.
- `src/game/render/GameRenderer.ts` owns renderer instance and camera/view interactions.
- `src/game/render/layers/MapLayer.ts` handles map drawing + hover tile resolution.
- `src/game/render/hexMath.ts` and `cameraControls.ts` provide reusable pure math/input helpers.

## Target Architecture

### Renderer split

- `GameRenderer` (Three-backed):
- Owns `WebGLRenderer`, scene, camera, raycaster, animation tick.
- Converts existing screen-space input handlers into camera movement/zoom.
- Delegates map mesh creation and hit-testing surface metadata to map layer.

- `MapLayer` (Three-backed):
- Builds and updates map tile meshes grouped by concern (base terrain first).
- Stores tile key metadata for raycast hit resolution.
- Exposes `render(map)`, `updateHoveredTileAtWorldPoint(...)`, `clearHoveredTile()`, `destroy()` style API parity.

### Suggested file shape

- Keep file paths stable for minimal view churn:
- `src/game/render/GameRenderer.ts` (replace internals).
- `src/game/render/layers/MapLayer.ts` (replace internals).

- Add helpers:
- `src/game/render/three/sceneSetup.ts`
- `src/game/render/three/HexTileMeshFactory.ts`
- `src/game/render/three/raycast.ts`

This keeps future extension points explicit (terrain feature/resource/unit layers can add sibling modules).

## Implementation Phases

### Phase 0: Pre-migration guardrails

1. Create branch and baseline checks:
- `npm test`
- `npm run lint`

2. Add migration tracking notes in this document as each phase closes.

Acceptance criteria:
- Baseline passes before renderer changes start.

### Phase 1: Dependency and scaffold

1. Add dependencies:
- `three`
- `@types/three` (if needed by TS config)

2. Keep `pixi.js` temporarily to avoid large-bang breakage until Phase 4 cleanup.

3. Create Three scaffolding modules (`sceneSetup`, mesh factory, raycast helper).

Acceptance criteria:
- Project builds with both Pixi and Three present.
- New modules compile but are not yet wired to gameplay.

### Phase 2: GameRenderer swap (API-compatible)

1. Re-implement `GameRenderer` internals using Three.js while preserving current public methods used by `GameView.vue`:
- `init(canvas)`
- `renderMap(map)`
- `setHoveredTileChangeHandler(handler)`
- `updateHoveredTileFromScreenPoint(x, y)`
- `clearHoveredTile()`
- `zoomByWheel(deltaY, x, y)`
- edge pan / pointer lock / drag / arrow key methods
- `destroy()`

2. Camera model recommendation:
- Orthographic camera for parity with current top-down map.
- Zoom by camera zoom factor and cursor-centered world anchoring.

3. Tick/update loop:
- Keep `cameraControls.ts` as source of pan vectors.
- Apply deltas in render loop with frame-time scaling.

Acceptance criteria:
- `GameView.vue` does not require behavioral rewrites.
- Existing pan/zoom interactions still work end-to-end.

### Phase 3: MapLayer migration

1. Replace Pixi graphics hex drawing with Three geometry:
- Hex shape geometry (flat mesh per tile).
- Material color from `tiles[tile.terrain].color`.
- Deterministic creation order from `map.tileKeys`.

2. Hover picking:
- Raycast against map meshes.
- Map `intersection.object` back to `HexKey` metadata.
- Keep `HoveredTile` callback contract unchanged.

3. Ensure `render(map)` can handle full redraw first; optimize later.

Acceptance criteria:
- Full map renders with correct colors/origin/layout.
- Hover panel still resolves correct `q,r` + tile data.

### Phase 4: View glue and cleanup

1. Update `GameView.vue` only where needed for typing or canvas behavior differences.
2. Remove Pixi-specific assumptions from renderer lifecycle.
3. Remove `pixi.js` dependency once no references remain.
4. Run `rg "pixi" src` to verify cleanup.

Acceptance criteria:
- No runtime Pixi dependency left.
- Game route works with Three renderer only.

### Phase 5: Tests and hardening

1. Keep and pass existing tests:
- `src/game/render/hexMath.spec.ts`
- `src/game/render/cameraControls.spec.ts`

2. Add focused tests for new pure helpers (raycast mapping/math helpers).
3. Add renderer smoke test strategy:
- Instantiate renderer in jsdom-safe path where possible.
- Unit test non-WebGL logic separately (camera math, coordinate transforms, hover key mapping).

4. Execute:
- `npm test`
- `npm run lint`
- `npm run build`

Acceptance criteria:
- All checks pass locally.
- No regression in map generation or tile info display flow.

## Risks and Mitigations

- Risk: Hover picking mismatch due to camera/world transform drift.
- Mitigation: Centralize NDC/world conversion in one helper and test with fixed fixtures.

- Risk: Performance drop from per-tile mesh creation on larger maps.
- Mitigation: Start with correctness; then batch via `InstancedMesh` in follow-up phase.

- Risk: Input behavior drift (pointer lock + edge pan interactions).
- Mitigation: Preserve current public API and re-use `cameraControls.ts` vector logic unchanged.

- Risk: Migration introduces state/render coupling.
- Mitigation: Keep store contracts unchanged and renderer read-only against game state.

## Extension Points (Post-migration)

- Layer plugin registry in renderer (map/features/resources/units/overlays) to support modded rendering packs.
- Optional terrain elevation extrusion pipeline.
- GLTF asset pipeline for units/resources with deterministic asset-id to model mapping.

## Handoff Checklist For Next Agent

1. Read docs in required order (`documentation/README.md`, `project-overview.md`, `technical-guidance.md`, `coding-standards.md`).
2. Execute baseline checks before edits.
3. Implement phases in order; keep commits small and reversible.
4. Validate controls manually in `/game/:gameId` after each phase.
5. Remove Pixi dependency only after full parity verification.
6. Update this document with completion notes and any architecture changes.
