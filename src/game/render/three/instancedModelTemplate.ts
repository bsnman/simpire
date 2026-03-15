import { BufferGeometry, Matrix4, type Material, type Mesh, type Object3D } from 'three';

export type InstancedTemplateMaterial = Material | Material[];

export type InstancedTemplatePart = {
  geometry: BufferGeometry;
  material: InstancedTemplateMaterial;
  matrixWorld: Matrix4;
  renderOrder: number;
};

export const extractInstancedTemplateParts = (root: Object3D): InstancedTemplatePart[] => {
  const parts: InstancedTemplatePart[] = [];

  root.updateMatrixWorld(true);
  root.traverse((node) => {
    const mesh = node as Mesh;

    if (!mesh.isMesh) {
      return;
    }

    parts.push({
      geometry: mesh.geometry as BufferGeometry,
      material: Array.isArray(mesh.material) ? mesh.material.map((entry) => entry) : mesh.material,
      matrixWorld: mesh.matrixWorld.clone(),
      renderOrder: mesh.renderOrder,
    });
  });

  return parts;
};

export const cloneInstancedTemplateMaterial = (
  material: InstancedTemplateMaterial,
): InstancedTemplateMaterial =>
  Array.isArray(material) ? material.map((entry) => entry.clone()) : material.clone();

export const disposeInstancedRenderMaterials = (root: Object3D) => {
  root.traverse((node) => {
    const mesh = node as Mesh;

    if (!mesh.isMesh) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
      return;
    }

    mesh.material.dispose();
  });
};
