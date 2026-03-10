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
