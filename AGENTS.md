# Codex Instructions

Follow these project-specific instructions when working in this repo.

## Required Reading (Before Changes)

- Read `documentation/README.md` to choose relevant docs.
- Read `documentation/project-overview.md` before architecture or feature work.
- Read `documentation/technical-guidance.md` before gameplay, map, renderer, or state changes.
- Read `documentation/map-generation-algorithm.md` before map generation architecture or algorithm changes.
- Read `documentation/coding-standards.md` before editing files.
- Read `documentation/ui-style-guide.md` before visual UI updates (menus, overlays, panels, controls).

## Updating This File

- If you discover or agree on a new best practice or standard for this codebase, update `AGENTS.md` to record it.
- If architecture or implementation guidance changes, update `documentation/*.md` in the same change.

## Standards

- SAST runs via CodeQL in `.github/workflows/codeql.yml` for JavaScript/TypeScript (Vue).
- Use root imports for internal app modules with `/...` only.
- When suggesting or implementing architecture, include modding capability/extension points in the decision criteria.
- Shared UI primitives (panels/buttons/inputs/modal shells) must live in `src/components/ui/` for reuse across menu and in-game UI.
- When rendering dropdowns with `GSelect`, use `GSelectOption` for option entries so option-list styling remains readable across platforms.
- Map generators that support Create Game customization must expose `parameterDefinitions` metadata in their generator definition so UI controls can be derived without hardcoded per-view parameter maps.
- Model base tile terrain (biome/water) separately from elevation (`underwater`, `flat`, `hill`, `mountain`) so combinations like plains hills are possible without terrain-id explosion.
- Terrain cover (for example forest, jungle, bamboo, reeds) must be modeled as a terrain-feature layer separate from economic resources so both can coexist on a tile.
- For macro terrain generation, avoid directional bias (for example diagonal streak artifacts) by using symmetric hex-neighbor rules, deterministic shuffled iteration where applicable, and isotropic/rotated noise sampling.
- Keep macro-mask primary region selection close to target land ratio before final rebalance; avoid large one-pass rebalance corrections because they can introduce single-axis land streak artifacts.
- Automated tests use Vitest (`npm test`), Vue component tests use `@vue/test-utils`, and test files should be colocated as `*.spec.ts` under `src/`.

## Reminders

- Follow up on the `minimatch <10.2.1` advisory in the `typescript-eslint` dependency chain and see if upstream has bumped to a patched range. Target check date: February 28, 2026 (currently overdue).
