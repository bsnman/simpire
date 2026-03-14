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
const SEGMENTS = 112;
const RINGS = 36;
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

const gaussian = (x, y, cx, cy, sigmaX, sigmaY = sigmaX) => {
  const dx = x - cx;
  const dy = y - cy;
  const exponent = -((dx * dx) / (2 * sigmaX * sigmaX) + (dy * dy) / (2 * sigmaY * sigmaY));
  return Math.exp(exponent);
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
    const angle = (Math.PI / 6) * octave;
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

const rimFade = (radius, start = 0.84) => 1 - smoothstep(start, 1, radius);
const roundedTopShelf = (radius, plateauRadius, blendRadius, amplitude) => {
  if (radius >= blendRadius) {
    return 0;
  }

  const plateau = 1 - smoothstep(0, plateauRadius, radius);
  const shoulder = 1 - smoothstep(plateauRadius, blendRadius, radius);
  return amplitude * (plateau * 0.4 + shoulder * 0.6);
};

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

const measurePeakHeight = (geometry) => {
  const positions = geometry.getAttribute('position');
  let peakHeight = 0;

  for (let index = 0; index < positions.count; index += 1) {
    peakHeight = Math.max(peakHeight, positions.getZ(index));
  }

  return peakHeight;
};

const normalizePeakHeight = (geometry, targetPeakHeight) => {
  const positions = geometry.getAttribute('position');
  const sourcePeakHeight = measurePeakHeight(geometry);
  const scale = sourcePeakHeight > 0 ? targetPeakHeight / sourcePeakHeight : 1;

  for (let index = 0; index < positions.count; index += 1) {
    positions.setZ(index, positions.getZ(index) * scale);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return measurePeakHeight(geometry);
};

const buildShieldHillHeight = (x, y, radius) => {
  if (radius >= 1) {
    return 0;
  }

  const baseDome = Math.pow(1 - Math.pow(radius, 1.22), 1.9) * 0.86;
  const shoulder = smoothstep(1, 0.44, radius) * 0.2;
  const crownShelf = roundedTopShelf(radius, 0.12, 0.28, 0.1);
  const lobeA = gaussian(x, y, -0.18, 0.14, 0.28, 0.25) * 0.08;
  const lobeB = gaussian(x, y, 0.24, -0.1, 0.24, 0.22) * 0.06;
  const macroNoise = fbm(x * 1.2, y * 1.2, 4, 11) * 0.05;
  const detailNoise = fbm(x * 2.6, y * 2.6, 2, 29) * 0.02;
  const noiseMask = Math.pow(1 - radius, 1.25);

  return Math.max(
    0,
    (baseDome + shoulder + crownShelf + lobeA + lobeB + (macroNoise + detailNoise) * noiseMask) *
      rimFade(radius, 0.84),
  );
};

const buildRollingDomeHeight = (x, y, radius) => {
  if (radius >= 1) {
    return 0;
  }

  const rotated = rotate(x, y, Math.PI / 10);
  const warpedRadius = Math.hypot(rotated.x * 0.96, rotated.y * 1.08);

  if (warpedRadius >= 1) {
    return 0;
  }

  const dome = Math.pow(1 - Math.pow(warpedRadius, 1.34), 1.78) * 0.98;
  const shoulder = smoothstep(1, 0.46, warpedRadius) * 0.24;
  const crownShelf = roundedTopShelf(warpedRadius, 0.14, 0.3, 0.12);
  const lobeA = gaussian(rotated.x, rotated.y, -0.2, 0.12, 0.32, 0.28) * 0.11;
  const lobeB = gaussian(rotated.x, rotated.y, 0.18, -0.22, 0.29, 0.26) * 0.09;
  const macroNoise = fbm(rotated.x * 1.35, rotated.y * 1.35, 4, 37) * 0.075;
  const detailNoise = fbm(rotated.x * 3.1, rotated.y * 3.1, 2, 53) * 0.025;
  const noiseMask = Math.pow(1 - warpedRadius, 1.2);

  return Math.max(
    0,
    (dome + shoulder + crownShelf + lobeA + lobeB + (macroNoise + detailNoise) * noiseMask) *
      rimFade(radius, 0.84),
  );
};

const buildTwinKnollHeight = (x, y, radius) => {
  if (radius >= 1) {
    return 0;
  }

  const rotated = rotate(x, y, -Math.PI / 8);
  const warpedRadius = Math.hypot(rotated.x * 1.04, rotated.y * 0.98);

  if (warpedRadius >= 1) {
    return 0;
  }

  const base = Math.pow(1 - Math.pow(warpedRadius, 1.42), 1.7) * 0.8;
  const shoulder = smoothstep(1, 0.48, warpedRadius) * 0.24;
  const crownShelf = roundedTopShelf(warpedRadius, 0.13, 0.28, 0.11);
  const knollA = gaussian(rotated.x, rotated.y, -0.19, 0.02, 0.19, 0.23) * 0.5;
  const knollB = gaussian(rotated.x, rotated.y, 0.22, -0.03, 0.2, 0.24) * 0.48;
  const centerSaddle = gaussian(rotated.x, rotated.y, 0.02, 0, 0.15, 0.18) * -0.08;
  const macroNoise = fbm(rotated.x * 1.55, rotated.y * 1.55, 4, 61) * 0.075;
  const detailNoise = fbm(rotated.x * 3.4, rotated.y * 3.4, 2, 79) * 0.03;
  const noiseMask = Math.pow(1 - warpedRadius, 1.28);

  return Math.max(
    0,
    (base +
      shoulder +
      crownShelf +
      knollA +
      knollB +
      centerSaddle +
      (macroNoise + detailNoise) * noiseMask) *
      rimFade(radius, 0.83),
  );
};

const buildElongatedSaddleHeight = (x, y, radius) => {
  if (radius >= 1) {
    return 0;
  }

  const rotated = rotate(x, y, Math.PI / 5);
  const warpedRadius = Math.hypot(rotated.x * 1.18, rotated.y * 0.82);

  if (warpedRadius >= 1) {
    return 0;
  }

  const base = Math.pow(1 - Math.pow(warpedRadius, 1.28), 1.72) * 0.86;
  const shoulder = smoothstep(1, 0.52, warpedRadius) * 0.28;
  const crownShelf = roundedTopShelf(warpedRadius, 0.14, 0.3, 0.1);
  const ridgeA = gaussian(rotated.x, rotated.y, -0.18, 0.02, 0.2, 0.34) * 0.36;
  const ridgeB = gaussian(rotated.x, rotated.y, 0.2, -0.03, 0.2, 0.35) * 0.34;
  const saddle = gaussian(rotated.x, rotated.y, 0.02, 0, 0.18, 0.22) * -0.09;
  const sideSpur = gaussian(rotated.x, rotated.y, -0.08, 0.22, 0.22, 0.18) * 0.09;
  const macroNoise = fbm(rotated.x * 1.4, rotated.y * 1.1, 4, 97) * 0.08;
  const detailNoise = fbm(rotated.x * 2.8, rotated.y * 2.1, 2, 131) * 0.03;
  const noiseMask = Math.pow(1 - warpedRadius, 1.2);

  return Math.max(
    0,
    (base +
      shoulder +
      crownShelf +
      ridgeA +
      ridgeB +
      saddle +
      sideSpur +
      (macroNoise + detailNoise) * noiseMask) *
      rimFade(radius, 0.82),
  );
};

const buildOffsetShoulderHeight = (x, y, radius) => {
  if (radius >= 1) {
    return 0;
  }

  const rotated = rotate(x, y, -Math.PI / 7);
  const warpedRadius = Math.hypot(rotated.x * 1.08, rotated.y * 0.9);

  if (warpedRadius >= 1) {
    return 0;
  }

  const base = Math.pow(1 - Math.pow(warpedRadius, 1.2), 1.64) * 0.94;
  const shoulder = smoothstep(1, 0.56, warpedRadius) * 0.34;
  const crownShelf = roundedTopShelf(warpedRadius, 0.14, 0.32, 0.12);
  const primaryMass = gaussian(rotated.x, rotated.y, 0.16, -0.08, 0.28, 0.3) * 0.42;
  const secondaryShoulder = gaussian(rotated.x, rotated.y, -0.24, 0.2, 0.26, 0.2) * 0.21;
  const shallowSaddle = gaussian(rotated.x, rotated.y, -0.02, 0.08, 0.2, 0.16) * -0.05;
  const macroNoise = fbm(rotated.x * 1.3, rotated.y * 1.25, 4, 149) * 0.08;
  const detailNoise = fbm(rotated.x * 3.1, rotated.y * 2.9, 2, 173) * 0.03;
  const noiseMask = Math.pow(1 - warpedRadius, 1.18);

  return Math.max(
    0,
    (base +
      shoulder +
      crownShelf +
      primaryMass +
      secondaryShoulder +
      shallowSaddle +
      (macroNoise + detailNoise) * noiseMask) *
      rimFade(radius, 0.82),
  );
};

const buildRoundedHighlandHeight = (x, y, radius) => {
  if (radius >= 1) {
    return 0;
  }

  const rotated = rotate(x, y, Math.PI / 12);
  const warpedRadius = Math.hypot(rotated.x * 0.98, rotated.y * 1.04);

  if (warpedRadius >= 1) {
    return 0;
  }

  const dome = Math.pow(1 - Math.pow(warpedRadius, 1.08), 1.48) * 1.12;
  const shoulder = smoothstep(1, 0.6, warpedRadius) * 0.42;
  const crownShelf = roundedTopShelf(warpedRadius, 0.16, 0.34, 0.15);
  const crown = gaussian(rotated.x, rotated.y, 0.06, -0.02, 0.28, 0.3) * 0.24;
  const lobeA = gaussian(rotated.x, rotated.y, -0.26, 0.12, 0.22, 0.24) * 0.14;
  const lobeB = gaussian(rotated.x, rotated.y, 0.22, -0.18, 0.25, 0.22) * 0.12;
  const broadSaddle = gaussian(rotated.x, rotated.y, -0.04, 0.06, 0.18, 0.2) * -0.03;
  const macroNoise = fbm(rotated.x * 1.18, rotated.y * 1.18, 4, 211) * 0.085;
  const detailNoise = fbm(rotated.x * 2.6, rotated.y * 2.6, 2, 239) * 0.03;
  const noiseMask = Math.pow(1 - warpedRadius, 1.1);

  return Math.max(
    0,
    (dome +
      shoulder +
      crownShelf +
      crown +
      lobeA +
      lobeB +
      broadSaddle +
      (macroNoise + detailNoise) * noiseMask) *
      rimFade(radius, 0.81),
  );
};

const HILL_VARIANTS = [
  {
    name: 'hill-v4.1',
    color: '#95825f',
    targetPeakHeight: 0.45,
    heightAt: buildShieldHillHeight,
  },
  {
    name: 'hill-v4.2',
    color: '#917d5b',
    targetPeakHeight: 0.62,
    heightAt: buildRollingDomeHeight,
  },
  {
    name: 'hill-v4.3',
    color: '#8d7758',
    targetPeakHeight: 0.78,
    heightAt: buildTwinKnollHeight,
  },
  {
    name: 'hill-v4.4',
    color: '#886f54',
    targetPeakHeight: 0.94,
    heightAt: buildElongatedSaddleHeight,
  },
  {
    name: 'hill-v4.5',
    color: '#846a50',
    targetPeakHeight: 1.1,
    heightAt: buildOffsetShoulderHeight,
  },
  {
    name: 'hill-v4.6',
    color: '#80654c',
    targetPeakHeight: 1.28,
    heightAt: buildRoundedHighlandHeight,
  },
];

const exportVariant = async ({ name, color, targetPeakHeight, heightAt }) => {
  const geometry = buildOpenHillGeometry(heightAt);
  const peakHeight = normalizePeakHeight(geometry, targetPeakHeight);
  const material = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 0.98,
    metalness: 0,
  });

  const hillMesh = new Mesh(geometry, material);
  hillMesh.name = name.replace(/[^a-z0-9]+/gi, '_');
  const exportRoot = new Group();
  exportRoot.name = `${hillMesh.name}_export_root`;
  exportRoot.rotation.x = -Math.PI / 2;
  exportRoot.add(hillMesh);

  const scene = new Scene();
  scene.add(exportRoot);

  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(scene, {
    binary: true,
    includeCustomExtensions: false,
    truncateDrawRange: true,
    onlyVisible: true,
  });

  const outputRelativePath = `public/models/terrain/${name}.glb`;
  const outputPath = resolve(OUTPUT_DIRECTORY, `${name}.glb`);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.from(glb));

  return {
    outputPath: outputRelativePath,
    vertexCount: geometry.getAttribute('position').count,
    triangleCount: (geometry.index?.count ?? 0) / 3,
    peakHeight,
  };
};

const generatedVariants = [];

for (const variant of HILL_VARIANTS) {
  generatedVariants.push(await exportVariant(variant));
}

console.log('Generated terrain hill v4 variants:');
for (const variant of generatedVariants) {
  console.log(`- ${variant.outputPath}`);
  console.log(`  vertices: ${variant.vertexCount}`);
  console.log(`  triangles: ${variant.triangleCount}`);
  console.log(`  peak height: ${variant.peakHeight.toFixed(4)}`);
}
