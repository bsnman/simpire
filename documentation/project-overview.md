# Project Overview

## Product Context

- Project name: `simpire`
- Frontend stack: Vue 3 + TypeScript + Vite
- Rendering: PixiJS (for game view)
- State management: Pinia
- Routing: Vue Router
- Current maturity: early prototype with first rendering layer implemented

## Game Context

- Game map is tile-based on a hexagonal grid.
- Game view route: `/game/:gameId`.
- Current renderer supports map drawing (MapLayer) and mouse-wheel zoom.
- Map generation is handled by a deterministic, seed-hash driven registry (`src/game/mapgen`) with built-in `continents` and `archipelago` algorithms.

## Architecture Direction

- Keep domain model independent from UI and rendering concerns.
- Use Pinia as runtime state container for current game session data.
- Treat renderer as a consumer of state, not the owner of gameplay logic.
- Keep Vue views thin: lifecycle and composition only.
- For systems expected to evolve (like map generation), prefer contract + registry extension points so modded features can be added without changing core architecture.

## Primary Boundaries

- `src/types` or `src/game/model`:
  Domain types and pure helpers (hex math, map contracts).
- `src/stores`:
  Current game state and controlled state mutations/actions.
- `src/game/render`:
  Pixi application setup, layer management, and renderers by concern.
- `src/game/mapgen`:
  Deterministic map generation contracts, registry, and algorithm plugins.
- `src/views`:
  Route-level components that connect store state to renderer lifecycle.

## Near-Term Goal

- Extend renderer beyond map layer (units/resources/overlay layers).
- Keep map data contracts stable so new map generator plugins remain replace-in-place.
