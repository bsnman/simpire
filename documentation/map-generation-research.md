# Map Generation Research (Civ-Style, Hex Grid)

Purpose: capture research and a concrete algorithm direction for future agents implementing `continents`/`archipelago` improvements.

## Problem Statement

Current maps can show visible diagonal land streaks. For a Civ-like generator, this usually means directional bias in one or more steps (noise basis, scan order growth, or anisotropic smoothing).

## Research Summary

### 1) Prefer a multi-stage pipeline, not a single noise/fill pass

Civ-like maps are typically better when generated in layers:

1. Macro shape (continents/oceans)
2. Elevation and mountain structure
3. Climate (wind/rain shadow), rivers, and erosion
4. Gameplay balancing (starts/resources)

This reduces artifacts and gives better control over map scripts (continents, archipelago, etc.).

### 2) Use tectonic/region structure for believable continent shapes

Plate-style approaches produce mountain chains, island arcs, and better large-scale geography than pure thresholded noise.

### 3) Use Voronoi + Poisson seeds for controllable macro regions

Poisson-distributed seeds avoid clumping. Voronoi partitions give natural continental regions and adjustable size distributions.

### 4) Use modern isotropic noise only for detail

Perlin/Simplex/OpenSimplex-style fields are effective for coastline roughness and local variation, but should not be the only source of world structure.

### 5) Add balancing as a formal post-process

A strategy game map is not only visual terrain. Start fairness and resource distribution should be optimized after terrain generation.

## Recommended Algorithm Blueprint (For This Project)

Follow this order for future implementation work:

1. Seeded RNG streams

- Derive named sub-seeds from `seedHash` (`macro`, `elevation`, `climate`, `rivers`, `balance`).
- Keep deterministic ordering stable.

2. Macro land/ocean mask

- Generate Poisson seeds over map space.
- Build Voronoi regions and classify each as oceanic or continental with target land ratio controls.
- For `archipelago`, increase oceanic share and split continental regions probabilistically.

3. Tectonic-style elevation pass

- Assign pseudo-plate motion vectors per macro region.
- Raise elevation along convergent boundaries; lower at divergent boundaries.
- Clamp to biome-ready elevation bands (deep water, shallow water, plains, hills, mountains).

4. Detail pass (artifact-safe)

- Apply low-frequency OpenSimplex2/2S fields for coastline/elevation variation.
- Add domain warping to break straight or repetitive bands.
- Combine multiple rotated/octave fields instead of one axis-aligned field.

5. Climate and hydrology

- Compute prevailing wind + rain shadow approximation for moisture.
- Route rivers downslope to coasts/lakes.
- Optional lightweight hydraulic erosion to reduce geometric edges.

6. Biomes and resources

- Assign biome from elevation + temperature + moisture.
- Run resource placement constrained by biome and gameplay caps.

7. Fairness post-process

- Score start locations for early-yield parity and spacing.
- Re-roll local resources near weak starts within deterministic limits.

## Fixing The Diagonal Land Artifact (Checklist)

Use all of these checks during implementation:

- Do not grow land with a fixed scanline order (for example NW->SE passes).
- If cellular/iterative updates are used, process cells in hash-shuffled deterministic order.
- Ensure neighbor rules are symmetric across all 6 hex directions.
- Avoid single-axis thresholding from one noise sample; blend rotated fields.
- Add domain warp before thresholding land masks.
- Validate with an orientation histogram of coastline/height gradients; no dominant diagonal bin should persist across many seeds.

## Suggested Generator Families

Keep generator logic plugin-based (existing contract/registry model), with `parameterDefinitions` for UI-driven tuning:

- `continents_v2`
- Land ratio, continent count target, tectonic strength, coastline roughness, mountain intensity.
- `archipelago_v2`
- Land ratio, island size spectrum, island chain tendency, shallow-water shelf width.
- `fractal_classic`
- Fast fallback generator for low CPU budgets.

## Validation Metrics For Future Agents

Track metrics across many seeds:

- Land ratio (%), shallow/deep water ratio
- Number of landmasses and largest-continent share
- Coastline complexity (edge count per land tile)
- Mountain chain continuity
- Start-position fairness score variance
- Directionality score (detect repeated diagonal dominance)

## Sources (Articles/Papers)

- Amit Patel, polygon map generation notes:  
  https://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/
- Red Blob Games map generation experiments:  
  https://www.redblobgames.com/maps/mapgen4/
- Procedural Tectonic Planets (Eurographics 2019):  
  https://diglib.eg.org/items/d7b74043-dcb2-4b18-b128-5ec43b73548d
- WorldEngine (open-source tectonics + climate pipeline):  
  https://github.com/Mindwerks/worldengine
- Ken Perlin, Improving Noise (2002):  
  https://people.csail.mit.edu/ericchan/bib/pdf/p681-perlin.pdf
- Simplex noise demystified (Gustavson):  
  https://www.researchgate.net/publication/216813608_Simplex_noise_demystified
- OpenSimplex2 documentation (artifact-aware variants):  
  https://docs.rs/opensimplex2/latest/opensimplex2/fast/index.html
- Physically Based Hydraulic Erosion (Benes et al.):  
  https://www.cs.purdue.edu/cgvlab/www/resources/papers/Benes-2006-Physically-Based_Hydraulic_Erosion.pdf
- Visually Improved Generalized Hydraulic Erosion (2022):  
  https://arxiv.org/abs/2210.14496
- Bridson, Fast Poisson Disk Sampling (2007):  
  https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf
- Fortune, sweepline Voronoi algorithm:  
  https://www.nokia.com/bell-labs/publications-and-media/publications/a-sweepline-algorithm-for-voronoi-diagrams/
- Freeciv map generation internals (practical strategy-game reference):  
  https://longturn.readthedocs.io/en/latest/Coding/mapgen.html
- Constructive strategy map generation with gameplay constraints (2024):  
  https://www.sciencedirect.com/science/article/abs/pii/S1875952124002544

## Decision Note

For this codebase, the best next implementation target is a hybrid:

1. Voronoi/Poisson macro structure
2. Tectonic-style boundary elevation shaping
3. Isotropic noise detail + domain warp
4. Climate/hydrology and fairness post-process

This combination directly addresses the diagonal artifact while staying modding-friendly under the existing generator registry architecture.
