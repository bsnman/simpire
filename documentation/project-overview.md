# Project Overview

## Product Context

- Project name: `simpire`
- Frontend stack: Vue 3 + TypeScript + Vite
- Rendering: PixiJS (for game view)
- State management: Pinia
- Routing: Vue Router
- Current maturity: early prototype transitioning to game architecture

## Game Context

- Game map is tile-based on a hexagonal grid.
- Game view route: `/game/:gameId`.
- Initial renderer work should accept provided map data and render it correctly.
- Map generation will be added later and should plug into existing map data contracts.

## Architecture Direction

- Keep domain model independent from UI and rendering concerns.
- Use Pinia as runtime state container for current game session data.
- Treat renderer as a consumer of state, not the owner of gameplay logic.
- Keep Vue views thin: lifecycle and composition only.

## Primary Boundaries

- `src/types` or `src/game/model`:
  Domain types and pure helpers (hex math, map contracts).
- `src/stores`:
  Current game state and controlled state mutations/actions.
- `src/game/render` (to be created):
  Pixi application setup, layer management, and renderers by concern.
- `src/views`:
  Route-level components that connect store state to renderer lifecycle.

## Near-Term Goal

- Implement a renderer that can draw a hex map from deterministic input data.
- Use stable map data shape now so map generator integration later is a replace-in-place operation.
