/* global Buffer, console */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const OUTPUT_DIRECTORY = resolve('public/models/terrain-features');
const OUTPUT_NAME = 'forest-pine-v1-source';
const TRUNK_HEIGHT = 0.3;
const TOTAL_HEIGHT = 0.85;

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

const createTrunkMesh = () => {
  const geometry = new CylinderGeometry(0.032, 0.05, TRUNK_HEIGHT, 8, 1, false);
  geometry.rotateX(Math.PI / 2);

  const material = new MeshStandardMaterial({
    color: new Color('#6b4423'),
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const mesh = new Mesh(geometry, material);

  mesh.name = 'forest_pine_v1_source_trunk';
  material.name = 'forest_pine_v1_source_trunk_material';
  mesh.position.z = TRUNK_HEIGHT / 2;

  return mesh;
};

const createFoliageTierMesh = ({ name, materialName, color, radius, height, centerZ }) => {
  const geometry = new ConeGeometry(radius, height, 10, 1, false);
  geometry.rotateX(Math.PI / 2);

  const material = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const mesh = new Mesh(geometry, material);

  mesh.name = name;
  material.name = materialName;
  mesh.position.z = centerZ;

  return mesh;
};

const createPineTree = () => {
  const tree = new Group();

  tree.name = `${OUTPUT_NAME}_tree`;
  tree.add(
    createTrunkMesh(),
    createFoliageTierMesh({
      name: 'forest_pine_v1_source_lower_foliage',
      materialName: 'forest_pine_v1_source_lower_foliage_material',
      color: '#2f5d31',
      radius: 0.22,
      height: 0.36,
      centerZ: 0.4,
    }),
    createFoliageTierMesh({
      name: 'forest_pine_v1_source_mid_foliage',
      materialName: 'forest_pine_v1_source_mid_foliage_material',
      color: '#376c37',
      radius: 0.18,
      height: 0.3,
      centerZ: 0.58,
    }),
    createFoliageTierMesh({
      name: 'forest_pine_v1_source_upper_foliage',
      materialName: 'forest_pine_v1_source_upper_foliage_material',
      color: '#407b3e',
      radius: 0.13,
      height: 0.24,
      centerZ: 0.73,
    }),
  );

  return tree;
};

const toMeshStats = (mesh) => {
  const vertexCount = mesh.geometry.getAttribute('position').count;
  const triangleCount = mesh.geometry.index ? mesh.geometry.index.count / 3 : vertexCount / 3;

  return {
    name: mesh.name,
    vertexCount,
    triangleCount,
  };
};

const tree = createPineTree();
const exportRoot = new Group();

exportRoot.name = `${OUTPUT_NAME}_export_root`;
exportRoot.rotation.x = -Math.PI / 2;
exportRoot.add(tree);

const scene = new Scene();

scene.add(exportRoot);

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, {
  binary: true,
  includeCustomExtensions: false,
  truncateDrawRange: true,
  onlyVisible: true,
});

const outputRelativePath = `/models/terrain-features/${OUTPUT_NAME}.glb`;
const outputPath = resolve(OUTPUT_DIRECTORY, `${OUTPUT_NAME}.glb`);
const meshStats = tree.children
  .filter((child) => child instanceof Mesh)
  .map((child) => toMeshStats(child));
const totalVertexCount = meshStats.reduce((sum, mesh) => sum + mesh.vertexCount, 0);
const totalTriangleCount = meshStats.reduce((sum, mesh) => sum + mesh.triangleCount, 0);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, Buffer.from(glb));

console.log(`Generated ${outputRelativePath}`);
console.log(`- meshes: ${meshStats.length}`);
console.log(`- total vertices: ${totalVertexCount}`);
console.log(`- total triangles: ${totalTriangleCount}`);
console.log(`- authored total height: ${TOTAL_HEIGHT}`);
for (const mesh of meshStats) {
  console.log(`- ${mesh.name}: ${mesh.vertexCount} vertices, ${mesh.triangleCount} triangles`);
}
