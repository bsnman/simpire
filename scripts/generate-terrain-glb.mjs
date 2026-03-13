import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
// Terrain assets are authored/exported in the renderer's Blender-aligned convention:
// base footprint on XY, positive height on Z.

const padTo4 = (buffer, fillByte = 0x00) => {
  const paddedLength = Math.ceil(buffer.length / 4) * 4;

  if (paddedLength === buffer.length) {
    return buffer;
  }

  return Buffer.concat([buffer, Buffer.alloc(paddedLength - buffer.length, fillByte)]);
};

const vec3MinMax = (positions) => {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[index + axis];
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }

  return { min, max };
};

const buildMoundGeometry = (config) => {
  const { segments, rings, top } = config;
  const positions = [];
  const indices = [];
  const ringVertexOffsets = [];

  for (const ring of rings) {
    ringVertexOffsets.push(positions.length / 3);

    for (let segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
      const angle = (segmentIndex / segments) * Math.PI * 2;
      const x = Math.cos(angle) * ring.radius;
      const y = Math.sin(angle) * ring.radius;
      const z = ring.height;
      positions.push(x, y, z);
    }
  }

  const topIndex = positions.length / 3;
  positions.push(top.x, top.y, top.height);

  const bottomIndex = positions.length / 3;
  positions.push(0, 0, rings[0].height);

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const outerOffset = ringVertexOffsets[ringIndex];
    const innerOffset = ringVertexOffsets[ringIndex + 1];

    for (let segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
      const nextIndex = (segmentIndex + 1) % segments;

      const outerCurrent = outerOffset + segmentIndex;
      const outerNext = outerOffset + nextIndex;
      const innerCurrent = innerOffset + segmentIndex;
      const innerNext = innerOffset + nextIndex;

      indices.push(outerCurrent, outerNext, innerCurrent);
      indices.push(innerCurrent, outerNext, innerNext);
    }
  }

  const lastRingOffset = ringVertexOffsets[ringVertexOffsets.length - 1];

  for (let segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
    const nextIndex = (segmentIndex + 1) % segments;
    const current = lastRingOffset + segmentIndex;
    const next = lastRingOffset + nextIndex;
    indices.push(current, next, topIndex);
  }

  const firstRingOffset = ringVertexOffsets[0];

  for (let segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
    const nextIndex = (segmentIndex + 1) % segments;
    const current = firstRingOffset + segmentIndex;
    const next = firstRingOffset + nextIndex;
    indices.push(next, current, bottomIndex);
  }

  return {
    positions,
    indices,
  };
};

const writeGlb = ({ outputPath, positions, indices, baseColor }) => {
  const positionBuffer = Buffer.alloc(positions.length * 4);

  for (let index = 0; index < positions.length; index += 1) {
    positionBuffer.writeFloatLE(positions[index], index * 4);
  }

  const indexBuffer = Buffer.alloc(indices.length * 2);

  for (let index = 0; index < indices.length; index += 1) {
    indexBuffer.writeUInt16LE(indices[index], index * 2);
  }

  const positionOffset = 0;
  const indexOffset = positionBuffer.length;
  const binChunk = padTo4(Buffer.concat([positionBuffer, indexBuffer]), 0x00);
  const { min, max } = vec3MinMax(positions);
  const json = {
    asset: { version: '2.0', generator: 'simpire terrain model generator' },
    extensionsUsed: ['KHR_materials_unlit'],
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'terrain_mesh' }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: baseColor,
          metallicFactor: 0,
          roughnessFactor: 1,
        },
        extensions: {
          KHR_materials_unlit: {},
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: positions.length / 3,
        type: 'VEC3',
        min,
        max,
      },
      {
        bufferView: 1,
        byteOffset: 0,
        componentType: 5123,
        count: indices.length,
        type: 'SCALAR',
        min: [0],
        max: [positions.length / 3 - 1],
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: positionOffset,
        byteLength: positionBuffer.length,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: indexOffset,
        byteLength: indexBuffer.length,
        target: 34963,
      },
    ],
    buffers: [{ byteLength: binChunk.length }],
  };
  const jsonChunk = padTo4(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const header = Buffer.alloc(12);

  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(GLB_VERSION, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonChunkHeader.writeUInt32LE(JSON_CHUNK_TYPE, 4);

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binChunk.length, 0);
  binChunkHeader.writeUInt32LE(BIN_CHUNK_TYPE, 4);

  const glb = Buffer.concat([header, jsonChunkHeader, jsonChunk, binChunkHeader, binChunk]);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, glb);
};

const hillGeometry = buildMoundGeometry({
  segments: 18,
  rings: [
    { radius: 0.95, height: 0.0 },
    { radius: 0.7, height: 0.46 },
    { radius: 0.42, height: 0.68 },
    { radius: 0.24, height: 0.86 },
  ],
  top: { x: 0.01, y: -0.01, height: 0.94 },
});

const mountainGeometry = buildMoundGeometry({
  segments: 16,
  rings: [
    { radius: 0.92, height: 0.0 },
    { radius: 0.88, height: 0.12 },
    { radius: 0.68, height: 0.56 },
    { radius: 0.5, height: 1.05 },
    { radius: 0.34, height: 1.25 },
    { radius: 0.2, height: 1.32 },
  ],
  top: { x: -0.01, y: 0.02, height: 1.36 },
});

writeGlb({
  outputPath: resolve('public/models/terrain/hill.glb'),
  positions: hillGeometry.positions,
  indices: hillGeometry.indices,
  baseColor: [0.47, 0.41, 0.3, 1.0],
});

writeGlb({
  outputPath: resolve('public/models/terrain/mountain.glb'),
  positions: mountainGeometry.positions,
  indices: mountainGeometry.indices,
  baseColor: [0.58, 0.56, 0.53, 1.0],
});

console.log('Generated terrain models:');
console.log('- public/models/terrain/hill.glb');
console.log('- public/models/terrain/mountain.glb');
