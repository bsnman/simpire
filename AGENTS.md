# Codex Instructions

Follow these project-specific instructions when working in this repo.

## Required Reading (Before Changes)

- Read `documentation/README.md` to choose relevant docs.
- Read `documentation/project-overview.md` before architecture or feature work.
- Read `documentation/technical-guidance.md` before gameplay, map, renderer, or state changes.
- Read `documentation/coding-standards.md` before editing files.

## Updating This File

- If you discover or agree on a new best practice or standard for this codebase, update `AGENTS.md` to record it.
- If architecture or implementation guidance changes, update `documentation/*.md` in the same change.

## Standards

- SAST runs via CodeQL in `.github/workflows/codeql.yml` for JavaScript/TypeScript (Vue).
- Use root imports for internal app modules with `/...` only. Do not use `@/...` or `../` parent-relative imports.

## Reminders

- Follow up on the `minimatch <10.2.1` advisory in the `typescript-eslint` dependency chain and see if upstream has bumped to a patched range. Target check date: February 28, 2026 (currently overdue).
