import { Vector2, type Camera, type Intersection, type Object3D, type Raycaster } from 'three';

import type { HexKey } from '~/types/hex';

export const HEX_KEY_USER_DATA_FIELD = 'hexKey';

type NdcPoint = {
  x: number;
  y: number;
};

type PickHexKeyAtScreenPointParams = {
  screenX: number;
  screenY: number;
  viewportWidth: number;
  viewportHeight: number;
  camera: Camera;
  raycaster: Raycaster;
  targets: Object3D[];
};

const asHexKey = (value: unknown): HexKey | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const [qText, rText, ...rest] = value.split(',');

  if (rest.length > 0 || qText === undefined || rText === undefined) {
    return null;
  }

  if (qText.length === 0 || rText.length === 0) {
    return null;
  }

  const q = Number(qText);
  const r = Number(rText);

  if (!Number.isFinite(q) || !Number.isFinite(r)) {
    return null;
  }

  return value as HexKey;
};

export const screenPointToNdc = (
  screenX: number,
  screenY: number,
  viewportWidth: number,
  viewportHeight: number,
): NdcPoint => ({
  x: (screenX / viewportWidth) * 2 - 1,
  y: -(screenY / viewportHeight) * 2 + 1,
});

export const findHexKeyOnObject = (object: Object3D | null): HexKey | null => {
  let current: Object3D | null = object;

  while (current) {
    const key = asHexKey(current.userData[HEX_KEY_USER_DATA_FIELD]);

    if (key) {
      return key;
    }

    current = current.parent;
  }

  return null;
};

export const findFirstHexKeyInIntersections = (
  intersections: ReadonlyArray<Intersection<Object3D>>,
): HexKey | null => {
  for (const intersection of intersections) {
    const key = findHexKeyOnObject(intersection.object);

    if (key) {
      return key;
    }
  }

  return null;
};

export const pickHexKeyAtScreenPoint = ({
  screenX,
  screenY,
  viewportWidth,
  viewportHeight,
  camera,
  raycaster,
  targets,
}: PickHexKeyAtScreenPointParams): HexKey | null => {
  if (viewportWidth <= 0 || viewportHeight <= 0 || targets.length === 0) {
    return null;
  }

  const ndc = screenPointToNdc(screenX, screenY, viewportWidth, viewportHeight);
  raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
  return findFirstHexKeyInIntersections(raycaster.intersectObjects(targets, true));
};
