/* global Buffer, console */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const OUTPUT_DIRECTORY = resolve('public/models/terrain');
const SEGMENTS = 112;
const RINGS = 36;
// Terrain assets are authored/exported in the renderer's Blender-aligned convention:
// base footprint on XY, positive height on Z.

class NodeFileReader {
  result = null;
  error = null;
  onloadend = null;
  onerror = null;

  readAsArrayBuffer(blob) {
    blob
      .arrayBuffer()
      .then((arrayBuffer) => {
        this.result = arrayBuffer;
        this.onloadend?.();
      })
      .catch((error) => {
        this.error = error;
        this.onerror?.(error);
        this.onloadend?.();
      });
  }

  readAsDataURL(blob) {
    blob
      .arrayBuffer()
      .then((arrayBuffer) => {
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
        this.onloadend?.();
      })
      .catch((error) => {
        this.error = error;
        this.onerror?.(error);
        this.onloadend?.();
      });
  }
}

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = NodeFileReader;
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fract = (value) => value - Math.floor(value);

const smoothstep = (edge0, edge1, x) => {
  if (edge0 === edge1) {
    return x >= edge1 ? 1 : 0;
  }

  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const rotate = (x, y, angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
};

const hash2 = (x, y, seed) => {
  const dot = x * 127.1 + y * 311.7 + seed * 74.7;
  return fract(Math.sin(dot) * 43758.5453123);
};

const valueNoise = (x, y, seed) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const sx = smoothstep(0, 1, x - x0);
  const sy = smoothstep(0, 1, y - y0);

  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x1, y0, seed);
  const n01 = hash2(x0, y1, seed);
  const n11 = hash2(x1, y1, seed);

  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
};

const fbm = (x, y, octaves, seed) => {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let normalization = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    const angle = (Math.PI / 5) * octave;
    const rotated = rotate(x, y, angle);

    sum +=
      (valueNoise(rotated.x * frequency, rotated.y * frequency, seed + octave * 17) * 2 - 1) *
      amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return normalization > 0 ? sum / normalization : 0;
};

const gaussian = (x, y, cx, cy, sigmaX, sigmaY = sigmaX) => {
  const dx = x - cx;
  const dy = y - cy;
  const exponent = -((dx * dx) / (2 * sigmaX * sigmaX) + (dy * dy) / (2 * sigmaY * sigmaY));
  return Math.exp(exponent);
};

const rimFade = (radius, start = 0.82) => 1 - smoothstep(start, 1, radius);

const buildOpenHillGeometry = (heightAt) => {
  const positions = [];
  const indices = [];
  const ringOffsets = [];

  for (let ring = 0; ring <= RINGS; ring += 1) {
    const radius = ring / RINGS;
    ringOffsets.push(positions.length / 3);

    if (ring === 0) {
      positions.push(0, 0, heightAt(0, 0, 0, 0));
      continue;
    }

    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const angle = (segment / SEGMENTS) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      positions.push(x, y, heightAt(x, y, radius, angle));
    }
  }

  const centerIndex = ringOffsets[0];
  const firstRingOffset = ringOffsets[1];

  for (let segment = 0; segment < SEGMENTS; segment += 1) {
    const next = (segment + 1) % SEGMENTS;
    indices.push(centerIndex, firstRingOffset + segment, firstRingOffset + next);
  }

  for (let ring = 1; ring < RINGS; ring += 1) {
    const innerOffset = ringOffsets[ring];
    const outerOffset = ringOffsets[ring + 1];

    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const next = (segment + 1) % SEGMENTS;

      const innerCurrent = innerOffset + segment;
      const innerNext = innerOffset + next;
      const outerCurrent = outerOffset + segment;
      const outerNext = outerOffset + next;

      indices.push(innerCurrent, outerCurrent, outerNext);
      indices.push(innerCurrent, outerNext, innerNext);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const buildShieldHillHeight = (x, y, radius) => {
  if (radius >= 1) {
    return 0;
  }

  const dome = Math.pow(1 - Math.pow(radius, 1.28), 1.95) * 1.06;
  const shoulder = smoothstep(1, 0.52, radius) * 0.26;
  const broadNoise = fbm(x * 1.4, y * 1.4, 4, 13) * 0.12;
  const detailNoise = fbm(x * 3.2, y * 3.2, 2, 29) * 0.035;
  const noiseMask = Math.pow(1 - radius, 1.3);

  return Math.max(0, (dome + shoulder + (broadNoise + detailNoise) * noiseMask) * rimFade(radius));
};

const buildButteHillHeight = (x, y, radius) => {
  if (radius >= 1) {
    return 0;
  }

  const rotated = rotate(x, y, Math.PI / 9);
  const warpedRadius = Math.hypot(rotated.x * 1.08, rotated.y * 0.92);
  const plateau = smoothstep(0.72, 0, warpedRadius) * 0.88;
  const shoulder = smoothstep(1, 0.48, warpedRadius) * 0.42;
  const saddle = -gaussian(x, y, -0.12, 0.08, 0.18, 0.16) * 0.1;
  const terraces = (1 - Math.abs(fbm(x * 2.6, y * 2.6, 3, 41))) * 0.06;

  return Math.max(
    0,
    (plateau + shoulder + saddle + terraces * Math.pow(1 - warpedRadius, 1.2)) *
      rimFade(radius, 0.86),
  );
};

const buildRidgeHillHeight = (x, y, radius) => {
  if (radius >= 1) {
    return 0;
  }

  const rotated = rotate(x, y, -Math.PI / 6);
  const ridge = gaussian(rotated.x, rotated.y, 0.04, 0, 0.17, 0.55) * 1.02;
  const spurA = gaussian(rotated.x, rotated.y, -0.18, 0.16, 0.21, 0.24) * 0.26;
  const spurB = gaussian(rotated.x, rotated.y, 0.22, -0.22, 0.18, 0.2) * 0.2;
  const ridgedNoise = (1 - Math.abs(fbm(rotated.x * 3.4, rotated.y * 1.8, 4, 67))) * 0.11 - 0.045;

  return Math.max(
    0,
    (ridge + spurA + spurB + ridgedNoise * Math.pow(1 - radius, 1.5)) * rimFade(radius, 0.8),
  );
};

const HILL_VARIANTS = [
  {
    name: 'hill-v2.1',
    color: '#8f7c5b',
    heightAt: buildShieldHillHeight,
  },
  {
    name: 'hill-v2.2',
    color: '#887456',
    heightAt: buildButteHillHeight,
  },
  {
    name: 'hill-v2.3',
    color: '#836d50',
    heightAt: buildRidgeHillHeight,
  },
];

const exportVariant = async ({ name, color, heightAt }) => {
  const geometry = buildOpenHillGeometry(heightAt);
  const material = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 0.98,
    metalness: 0,
  });

  const hillMesh = new Mesh(geometry, material);
  hillMesh.name = name.replace(/[^a-z0-9]+/gi, '_');

  const scene = new Scene();
  scene.add(hillMesh);

  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(scene, {
    binary: true,
    includeCustomExtensions: false,
    truncateDrawRange: true,
    onlyVisible: true,
  });

  const outputPath = resolve(OUTPUT_DIRECTORY, `${name}.glb`);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.from(glb));

  return {
    name,
    outputPath,
    vertexCount: geometry.getAttribute('position').count,
    triangleCount: (geometry.index?.count ?? 0) / 3,
  };
};

const generatedVariants = [];

for (const variant of HILL_VARIANTS) {
  generatedVariants.push(await exportVariant(variant));
}

console.log('Generated terrain hill variants:');
for (const variant of generatedVariants) {
  console.log(`- ${variant.outputPath}`);
  console.log(`  vertices: ${variant.vertexCount}`);
  console.log(`  triangles: ${variant.triangleCount}`);
}
