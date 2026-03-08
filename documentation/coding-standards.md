# Coding Standards

## General

- Prefer TypeScript-first, strongly typed contracts.
- Keep modules focused by concern (model, store, renderer, view).
- Avoid leaking framework-specific objects into domain models.
- Prefer small pure functions for math and transformations.

## State Management (Pinia)

- Store domain state, not Pixi objects.
- Use explicit action names describing intent (`setMap`, `spawnUnit`, `endTurn`).
- Keep side effects out of getters.
- Keep store IDs and exported composables aligned and domain-specific.

## Renderer Standards

- Renderer code must be deterministic for identical input state.
- Separate layers by concern: map, resources, units, overlays.
- Keep coordinate conversion in shared hex utility modules.
- Avoid game-rule decisions in renderer modules.

## Hex/Grid Standards

- Primary coordinate system: axial (`q`, `r`).
- Key format for lookups: `${q},${r}`.
- Avoid 2D array indexing as canonical storage for hex maps.

## Vue Standards

- Keep route views thin.
- Put gameplay logic in store/services, not directly in SFC templates.
- Keep Pixi lifecycle managed in composables or dedicated renderer classes.

## Naming

- Types/interfaces: descriptive domain names (`GameMap`, `MapTile`, `HexCoord`).
- Store files: domain-oriented (`currentGameMapStore`, `unitStore`) instead of generic names like `template`.
- Renderer files: suffix with role (`GameRenderer`, `MapLayer`, `UnitRenderer`).

## Quality And Safety

- Linting and formatting must pass before merge.
- Security scanning baseline includes CodeQL workflow in `.github/workflows/codeql.yml`.
- When changing standards or architecture direction, update:
- `documentation/*.md` files as needed.
- `AGENTS.md` when agent behavior expectations change.

## Dependency Reminder

- Track upstream fix status for `minimatch <10.2.1` in the `typescript-eslint` dependency chain.
- Previous target date was February 28, 2026 and is now overdue.
- On next dependency maintenance pass, verify current resolved version and update project notes.
