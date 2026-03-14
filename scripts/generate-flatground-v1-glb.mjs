/* global Buffer, console */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const OUTPUT_DIRECTORY = resolve('public/models/terrain');
const OUTPUT_NAME = 'flatground-v1-source';
const SEGMENTS = 72;
const RINGS = 20;

// Terrain assets on disk follow standard glTF orientation.
// The runtime converts imported glTF roots into the renderer's Z-up world.

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

const buildOuterRadius = (angle) => {
  const scallop = Math.cos(angle * 6) * 0.028;
  const lobeNoise = fbm(Math.cos(angle) * 1.9, Math.sin(angle) * 1.9, 3, 19) * 0.032;
  return clamp(0.9 + scallop + lobeNoise, 0.82, 0.96);
};

const buildHeightAt = (x, y, radius, angle) => {
  const macroNoise = fbm(x * 1.6, y * 1.6, 4, 41) * 0.018;
  const detailNoise = fbm(x * 3.4, y * 3.4, 2, 67) * 0.008;
  const centerLift = Math.pow(1 - radius, 1.9) * 0.055;
  const shelf = smoothstep(0.88, 0.18, radius) * 0.012;
  const drift = Math.sin(angle * 3 + 0.7) * (1 - radius) * 0.004;
  const edgeFade = 1 - smoothstep(0.72, 1, radius);

  return Math.max(0, centerLift + shelf + drift + (macroNoise + detailNoise) * edgeFade);
};

const buildFlatgroundGeometry = () => {
  const positions = [];
  const indices = [];
  const ringOffsets = [];

  for (let ring = 0; ring <= RINGS; ring += 1) {
    const radius = ring / RINGS;
    ringOffsets.push(positions.length / 3);

    if (ring === 0) {
      positions.push(0, 0, buildHeightAt(0, 0, 0, 0));
      continue;
    }

    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const angle = (segment / SEGMENTS) * Math.PI * 2;
      const outerRadius = buildOuterRadius(angle);
      const actualRadius = radius * outerRadius;
      const x = Math.cos(angle) * actualRadius;
      const y = Math.sin(angle) * actualRadius;
      const normalizedRadius = outerRadius > 0 ? actualRadius / outerRadius : 0;
      const height = buildHeightAt(x, y, normalizedRadius, angle);

      positions.push(x, y, height);
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

const geometry = buildFlatgroundGeometry();
const material = new MeshStandardMaterial({
  color: new Color('#8b7a5d'),
  roughness: 1,
  metalness: 0,
});
const mesh = new Mesh(geometry, material);
const exportRoot = new Group();
const scene = new Scene();

mesh.name = OUTPUT_NAME.replace(/[^a-z0-9]+/gi, '_');
material.name = `${mesh.name}_material`;
exportRoot.name = `${mesh.name}_export_root`;
exportRoot.rotation.x = -Math.PI / 2;
exportRoot.add(mesh);
scene.add(exportRoot);

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, {
  binary: true,
  includeCustomExtensions: false,
  truncateDrawRange: true,
  onlyVisible: true,
});

const outputRelativePath = `/models/terrain/${OUTPUT_NAME}.glb`;
const outputPath = resolve(OUTPUT_DIRECTORY, `${OUTPUT_NAME}.glb`);
const vertexCount = geometry.getAttribute('position').count;
const triangleCount = (geometry.index?.count ?? 0) / 3;
let peakHeight = 0;

for (let index = 0; index < vertexCount; index += 1) {
  peakHeight = Math.max(peakHeight, geometry.getAttribute('position').getZ(index));
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, Buffer.from(glb));

console.log(`Generated ${outputRelativePath}`);
console.log(`- vertices: ${vertexCount}`);
console.log(`- triangles: ${triangleCount}`);
console.log(`- peak height: ${peakHeight.toFixed(4)}`);
