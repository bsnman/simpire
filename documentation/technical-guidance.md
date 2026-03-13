# Technical Guidance

## Core Principles

- Single source of truth for game session state: Pinia store.
- Stateless rendering input: renderer receives map/unit/resource data and draws it.
- Hex grid math is centralized in pure utilities, not embedded across components.
- Domain-first contracts: gameplay data structures should not depend on renderer classes.
- Architecture proposals and implementations for core systems should include modding capability as a first-class consideration.

## Map Generation Architecture (Modding-Ready)

- Place map generation logic in pure modules under `src/game/mapgen`.
- Use a contract + registry approach.
- Contract: `MapGeneratorDefinition` describes generator id, param validation, and deterministic tile generation.
- For generator-driven setup UI, keep optional `displayName` / `description` and numeric `parameterDefinitions` metadata on each generator definition so forms can be rendered dynamically without hardcoded per-algorithm maps.
- Registry: `MapGeneratorRegistry` resolves generator implementations by id and produces `GameMap`.
- Keep generator-specific options local to each generator via `validateParams(params: unknown)` rather than global unions that require central edits.
- Register built-in generators (`continents`, `archipelago`) at bootstrap and allow modded generators to register new ids.
- Determinism standard: never use `Math.random()` in generation code.
- Determinism standard: seed all randomness from `seedHash`.
- Determinism standard: keep coordinate iteration order stable for repeatable outputs.
- For external mods, expose a simple registration API (for example, `registerMapGenerator`) so custom algorithms can be added without changing core files.

## Recommended Map Data Model (Hex)

Avoid using `Tile[][]` as the primary shape for hex maps. It creates awkward indexing for offset/ragged rows and complicates neighbors/pathing.

Use axial coordinates with keyed storage:

```ts
type HexCoord = { q: number; r: number };
type HexKey = `${number},${number}`;

type MapTile = {
  q: number;
  r: number;
  terrain: string;
  elevation: string;
  terrainFeatureId?: string;
  resourceId?: string;
};

type GameMap = {
  id: string;
  layout: 'pointy' | 'flat';
  tileSize: number;
  origin: { x: number; y: number };
  tilesByKey: Record<HexKey, MapTile>;
  tileKeys: HexKey[]; // stable iteration for rendering
};
```

Base biome (`terrain`) and relief (`elevation`) should remain separate so rules can express combinations like plains hills or tundra mountains without multiplying terrain IDs.

Why this shape:

- O(1) lookup by coordinate.
- Works for sparse maps and non-rectangular bounds.
- Cleaner for neighbors, pathfinding, and map generation.
- Renderer iteration remains deterministic via `tileKeys`.

## Store Responsibilities

- Hold authoritative client-side game state (`currentMap`, units, resources, turn, selection).
- Expose actions for controlled updates (`setMap`, `setUnits`, `applyTurnResult`).
- Avoid mixing rendering primitives into store state.

Suggested pattern:

- Keep base game state in one `currentGame` store module tree.
- Derive read-friendly data via getters.
- Keep heavy computation in pure helper modules where possible.

## Renderer Responsibilities

- Own Three.js `WebGLRenderer`, scene camera, and render layers.
- Keep composite renderer entry points stable (for example `MapLayer`) and hide concern-specific sublayers behind them.
- Convert domain coords to pixel positions through hex layout helpers.
- Renderer world convention is `Z-up`: tiles live on the `XY` plane and height/elevation offsets use `Z`.
- GLB assets on disk should follow standard glTF orientation; apply one shared import correction when loading them into the renderer's `Z-up` world.
- Render map first, then terrain features, then resources, then units, then overlays/UI layer.
- When visual layers can be disabled, keep hover/raycast targets in a separate non-visual interaction layer so picking does not depend on visible meshes.
- Handle view-only controls such as zoom/pan (do not store these in Pinia game state).
- Do not mutate game rules state; only reflect current state visually.
- Use deterministic group/object names for renderer layers so Three.js scene inspection and renderer tests can target the same structure reliably.

## Rectangular Map Fixture Guidance (Pointy Layout)

For pointy-top maps, generating `q: 0..N, r: 0..M` creates a visually skewed parallelogram. For rectangular debug fixtures, convert row/column to axial:

```ts
for (let r = 0; r < height; r += 1) {
  for (let col = 0; col < width; col += 1) {
    const q = col - Math.floor(r / 2);
    // create tile at (q, r)
  }
}
```

This keeps rows visually aligned while still storing canonical axial coordinates.

## Renderer Integration Flow

1. Game data is created or loaded (generator output from `src/game/mapgen` by default).
2. Store action commits map data into Pinia.
3. View initializes renderer once on mount.
4. Renderer draws from store-provided map snapshot/data.
5. View forwards wheel input to renderer for zoom-in/zoom-out around cursor position.
6. On state changes, trigger targeted renderer updates (full redraw only for early prototype).

## Hex Utility Guidance

- Use axial coordinates (`q`, `r`) as the main storage format.
- Maintain reusable helpers:
- `toKey(q, r): HexKey`
- `fromKey(key): HexCoord`
- `neighbors(q, r): HexCoord[]`
- `axialToPixel(q, r, size, layout)`
- If needed later, add cube conversion helpers for distance/range algorithms.

## Performance Guidance (When Scale Increases)

- Start simple with full map redraw for correctness.
- Move to incremental updates when tile count grows.
- Reuse meshes/materials/groups instead of recreating every frame.
- Chunk/cull rendering for large maps.

## Migration Note For Existing Code

- Runtime renderer has been migrated from PixiJS to Three.js.
- Current implementation uses:
- Hex-keyed map state in `src/stores/currentGame/map.ts`
- Three-backed `GameRenderer` + composite `MapLayer` in `src/game/render`
- Renderer-owned `MapRenderConfig` toggles for tile color, hex outlines, and elevation visuals
- `Z-up` world space with tile geometry on the `XY` plane and elevation on `Z`
- Shared glTF import correction so standard-oriented assets display upright in the renderer and model-debug view
- `TileColorLayer`, `HexOutlineLayer`, `TileElevationLayer`, and `MapInteractionLayer` behind `MapLayer`
- Wheel zoom handled in the game view/renderer boundary
- Deterministic map generation registry in `src/game/mapgen` with plugin-ready algorithm contracts
- Next renderer step is incremental updates and additional layers (units/resources/overlays).
