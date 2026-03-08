# Technical Guidance

## Core Principles

- Single source of truth for game session state: Pinia store.
- Stateless rendering input: renderer receives map/unit/resource data and draws it.
- Hex grid math is centralized in pure utilities, not embedded across components.
- Domain-first contracts: gameplay data structures should not depend on Pixi classes.

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

- Own Pixi `Application` and render layers.
- Convert domain coords to pixel positions through hex layout helpers.
- Render map first, then resources, then units, then overlays/UI layer.
- Handle view-only controls such as zoom/pan (do not store these in Pinia game state).
- Do not mutate game rules state; only reflect current state visually.

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

1. Game data is created or loaded (currently hardcoded, later generator output).
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
- Reuse sprites and containers instead of recreating every frame.
- Chunk/cull rendering for large maps.

## Migration Note For Existing Code

- Current implementation already uses:
- Hex-keyed map state in `src/stores/currentGame/map.ts`
- `GameRenderer` + `MapLayer` in `src/game/render`
- Wheel zoom handled in the game view/renderer boundary
- Next migration step is adding incremental rendering and additional layers (units/resources/overlays).
