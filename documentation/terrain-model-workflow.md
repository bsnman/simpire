# Terrain Model Workflow

## Current Runtime Assets

- Hill runtime asset: `/models/terrain/hill-v5.glb`
- Mountain runtime asset: `/models/terrain/mountain-v5.glb`

These are the canonical terrain elevation models used by the renderer.

## How V5 Was Produced

1. Generate the procedural candidate set with:

   ```bash
   npm run terrain:hill-v4
   ```

2. This creates six source candidates:

   - `hill-v4.1.glb`
   - `hill-v4.2.glb`
   - `hill-v4.3.glb`
   - `hill-v4.4.glb`
   - `hill-v4.5.glb`
   - `hill-v4.6.glb`

3. Review the candidates in Model Debug and pick the best source meshes for hand editing.

4. The selected source meshes for the current runtime set were:

   - `hill-v4.2.glb` -> source for `hill-v5.glb`
   - `hill-v4.6.glb` -> source for `mountain-v5.glb`

   The repository keeps those two selected `v4` source meshes. The other generated `v4` candidates can be recreated by rerunning the generator script.

5. Both selected source meshes were edited in Blender.

6. The Blender-edited exports were saved as:

   - `hill-v5.glb`
   - `mountain-v5.glb`

7. The renderer now loads those `v5` assets as the active hill and mountain decoration models.

## Source Of Truth

- Procedural exploration source: `scripts/generate-hill-v4-glb.mjs`
- Hand-edited promoted runtime assets: `hill-v5.glb` and `mountain-v5.glb`

Keep the `v4` generator so the procedural candidate set can be regenerated. Do not reintroduce the removed legacy terrain generator scripts unless a new workflow requires them.
