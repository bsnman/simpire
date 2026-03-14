# Documentation Index (AI Agent)

Purpose: this folder is the canonical context for implementation work in this repository.

## Read Order

1. `documentation/project-overview.md`
2. `documentation/technical-guidance.md`
3. `documentation/coding-standards.md`
4. `documentation/ui-style-guide.md` (required for UI/UX styling changes)
5. `documentation/map-generation-algorithm.md` (required before map generator architecture or algorithm changes)

## Usage Rules For Agents

- Read `project-overview.md` before making architecture or feature decisions.
- Read `technical-guidance.md` before adding or refactoring gameplay, map, renderer, or state code.
- Read `coding-standards.md` before editing files to align style, naming, and quality expectations.
- Read `ui-style-guide.md` before visual UI updates (menus, overlays, panels, controls).
- Read `map-generation-algorithm.md` before implementing or refactoring map generation architecture or algorithms.
- Use root imports for internal app modules with `/...` only. Do not use `@/...` or `../` parent-relative imports.
- If a task changes architecture, conventions, or agreed patterns, update the relevant file in this folder and `AGENTS.md`.

## Implementation Plans

- `documentation/threejs-migration-implementation-plan.md`: phased migration plan from PixiJS renderer to Three.js renderer.
- `documentation/map-render-layer-separation-implementation-plan.md`: phased plan for splitting map visuals into configurable tile color, hex outline, and elevation layers.
- `documentation/terrain-model-workflow.md`: provenance and promotion workflow for procedural terrain candidates and Blender-edited runtime hill/mountain assets.
