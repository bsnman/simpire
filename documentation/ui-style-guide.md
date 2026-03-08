# UI Style Guide

Purpose: keep UI visuals consistent across menus, overlays, and in-game interface panels.

## Scope

- Applies to all Vue UI work in `src/components`, `src/views`, and shared UI primitives.
- Current visual direction is based on the Main Menu style introduced for **Simpire**.

## Visual Direction

- Theme: grounded strategy-fantasy with deep navy backgrounds and warm metallic accents.
- Contrast: readable text on dark surfaces with clear focus and hover states.
- Atmosphere: layered gradients and soft glows, not flat single-color screens.

## Typography

- Game/brand title font stack:
  - `'Cinzel', 'Book Antiqua', Palatino, serif`
- UI/control text font stack:
  - `'Gill Sans', 'Trebuchet MS', sans-serif`
- Usage:
  - Reserve the serif title stack for game name and major heading moments.
  - Use the sans stack for buttons, labels, body copy, and panel content.

## Color Tokens

Use these values as the baseline palette.

- App background:
  - `#070c12` (deep backdrop)
  - `#10212d` (depth gradient)
  - Accent glows: `rgba(169, 124, 71, 0.8)` and `rgba(42, 92, 132, 0.85)`
- Panel surface:
  - Gradient: `rgba(27, 40, 58, 0.95)` to `rgba(13, 20, 31, 0.96)`
  - Border: `rgba(150, 168, 194, 0.35)`
  - Top highlight: `rgba(232, 201, 147, 0.85)`
- Button surface:
  - Default gradient: `#32455f` to `#1f2d3f`
  - Hover gradient: `#405a7b` to `#2a3c54`
  - Border: `rgba(176, 189, 209, 0.34)`
  - Hover border accent: `rgba(232, 198, 146, 0.7)`
  - Focus ring: `rgba(245, 213, 150, 0.95)`
- Text:
  - Primary title: `#f3e8d0`
  - Primary body/button: `#f5f7fb`
  - Secondary body: `rgba(214, 220, 232, 0.9)`
  - Kicker/meta text: `rgba(225, 229, 237, 0.88)`

## Shape, Spacing, and Depth

- Border radius:
  - Panels: `1rem`
  - Buttons: `0.72rem`
- Spacing:
  - Use `clamp(...)` on major containers for responsive rhythm.
  - Keep action stacks between `0.6rem` and `0.9rem` gap.
- Shadows:
  - Prefer soft depth (`0 1rem 2.2rem rgba(0,0,0,0.44)` scale) over hard drop shadows.
  - Keep one strong shadow layer plus optional subtle inset highlight.

## Motion

- Use entrance animation for major menu/panel sections (400ms-700ms).
- Stagger repeated action controls when appropriate (e.g., menu button lists).
- Respect reduced-motion users:
  - disable decorative animations under `@media (prefers-reduced-motion: reduce)`.

## Responsive Rules

- UI must remain functional and visually balanced from mobile width `320px` upward.
- Prefer width constraints like `min(...)` or `clamp(...)` over fixed desktop dimensions.
- Keep critical actions fully visible without scrolling on common laptop heights.

## Component Placement And Reuse

- Shared, reusable UI primitives belong in:
  - `src/components/ui/`
- Examples:
  - `GPanel.vue`, `GButton.vue`, future shared inputs/modals/tabs.
- Feature-specific composition belongs in:
  - `src/components/` (outside `ui`) or route views.
- Rule:
  - If a panel/button/input style is reusable in multiple screens (including in-game overlays), implement or extend it in `src/components/ui/` instead of duplicating styles in views.

## In-Game View Panel Guidance

- For in-game overlay panels (status cards, inspector panes, modal shells), use `GPanel` as the default base.
- Add context-specific classes around `GPanel` for layout differences, not one-off panel primitives.
- Keep gameplay/state logic out of UI primitives; primitives should remain visual + interaction focused.
