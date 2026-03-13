import { Group, type Object3D } from 'three';

export const GLTF_IMPORT_CORRECTION_ROTATION_X = Math.PI / 2;

const IMPORT_CORRECTION_FLAG = '__simpireImportCorrectionApplied';

export const orientImportedGltfRoot = <TRoot extends Object3D>(root: TRoot): Object3D => {
  if (root.userData[IMPORT_CORRECTION_FLAG]) {
    return root;
  }

  const correctedRoot = new Group();
  correctedRoot.name = root.name ? `${root.name}__import_corrected` : 'import_corrected_root';
  correctedRoot.userData[IMPORT_CORRECTION_FLAG] = true;
  correctedRoot.rotation.x = GLTF_IMPORT_CORRECTION_ROTATION_X;
  correctedRoot.add(root);

  return correctedRoot;
};
