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

const OUTPUT_PATH = resolve('public/models/terrain/hill-v2.glb');
const SEGMENTS = 96;
const RINGS = 30;
const BASE_CAP_DEPTH = -0.22;

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
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
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
    // Rotate each octave a little to avoid directional streaks.
    const angle = (Math.PI / 6) * octave;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;

    sum += (valueNoise(rx * frequency, ry * frequency, seed + octave * 17) * 2 - 1) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return normalization > 0 ? sum / normalization : 0;
};

const gaussian = (x, y, cx, cy, sigma) => {
  const dx = x - cx;
  const dy = y - cy;
  const exponent = -((dx * dx + dy * dy) / (2 * sigma * sigma));
  return Math.exp(exponent);
};

const hillHeight = (x, y) => {
  const radial = Math.hypot(x, y);

  if (radial >= 1) {
    return 0;
  }

  const baseDome = Math.pow(1 - radial, 1.45) * 0.95;
  const shoulder = smoothstep(1, 0.28, radial) * 0.26;

  const lobeA = gaussian(x, y, -0.26, 0.14, 0.34) * 0.22;
  const lobeB = gaussian(x, y, 0.22, -0.2, 0.3) * 0.18;
  const lobeC = gaussian(x, y, 0.12, 0.22, 0.25) * 0.12;

  const macroNoise = fbm(x * 1.9, y * 1.9, 4, 11) * 0.17;
  const detailNoise = fbm(x * 4.4, y * 4.4, 3, 29) * 0.07;

  const angle = Math.atan2(y, x);
  const gully = -Math.pow(Math.abs(Math.sin(angle * 3 + fbm(x * 2.2, y * 2.2, 2, 47) * 1.8)), 1.9) *
    0.06;

  const rimFade = 1 - smoothstep(0.78, 1, radial);
  const noiseMask = Math.pow(1 - radial, 1.15);

  const height =
    (baseDome + shoulder + lobeA + lobeB + lobeC + macroNoise * noiseMask + detailNoise * noiseMask +
      gully * noiseMask) *
    rimFade;

  return Math.max(0, height);
};

const buildHillGeometry = () => {
  const positions = [];
  const indices = [];
  const ringOffsets = [];

  for (let ring = 0; ring <= RINGS; ring += 1) {
    const radius = ring / RINGS;
    ringOffsets.push(positions.length / 3);

    if (ring === 0) {
      const centerHeight = hillHeight(0, 0);
      positions.push(0, 0, centerHeight);
      continue;
    }

    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const angle = (segment / SEGMENTS) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      positions.push(x, y, hillHeight(x, y));
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

  const outerOffset = ringOffsets[RINGS];
  const baseCenterIndex = positions.length / 3;
  positions.push(0, 0, BASE_CAP_DEPTH);

  for (let segment = 0; segment < SEGMENTS; segment += 1) {
    const next = (segment + 1) % SEGMENTS;
    const outerCurrent = outerOffset + segment;
    const outerNext = outerOffset + next;
    // Flip winding so underside normals face downward.
    indices.push(outerNext, outerCurrent, baseCenterIndex);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
};

const exportHill = async () => {
  const geometry = buildHillGeometry();
  const material = new MeshStandardMaterial({
    color: new Color('#8f7c5b'),
    roughness: 0.98,
    metalness: 0,
  });

  const hillMesh = new Mesh(geometry, material);
  hillMesh.name = 'hill_v2';

  const scene = new Scene();
  scene.add(hillMesh);

  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(scene, {
    binary: true,
    includeCustomExtensions: false,
    truncateDrawRange: true,
    onlyVisible: true,
  });

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, Buffer.from(glb));

  console.log('Generated terrain model:');
  console.log('- public/models/terrain/hill-v2.glb');
  console.log(`- vertices: ${geometry.getAttribute('position').count}`);
  console.log(`- triangles: ${(geometry.index?.count ?? 0) / 3}`);
};

await exportHill();
