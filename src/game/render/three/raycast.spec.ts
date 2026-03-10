import { Object3D, type Intersection } from 'three';
import { describe, expect, it } from 'vitest';

import {
  findFirstHexKeyInIntersections,
  findHexKeyOnObject,
  HEX_KEY_USER_DATA_FIELD,
  screenPointToNdc,
} from '~/game/render/three/raycast';

const asIntersection = (object: Object3D): Intersection<Object3D> =>
  ({
    distance: 0,
    point: { x: 0, y: 0, z: 0 },
    object,
  }) as Intersection<Object3D>;

describe('raycast helpers', () => {
  it('converts screen coordinates to normalized device coordinates', () => {
    expect(screenPointToNdc(0, 0, 200, 100)).toEqual({ x: -1, y: 1 });
    expect(screenPointToNdc(100, 50, 200, 100)).toEqual({ x: 0, y: 0 });
    expect(screenPointToNdc(200, 100, 200, 100)).toEqual({ x: 1, y: -1 });
  });

  it('resolves tile key from object parent chain', () => {
    const parent = new Object3D();
    const child = new Object3D();

    parent.userData[HEX_KEY_USER_DATA_FIELD] = '5,-2';
    parent.add(child);

    expect(findHexKeyOnObject(child)).toBe('5,-2');
  });

  it('ignores invalid tile keys on user data', () => {
    const object = new Object3D();
    object.userData[HEX_KEY_USER_DATA_FIELD] = 'not-a-key';

    expect(findHexKeyOnObject(object)).toBeNull();
  });

  it('returns the first intersection carrying a tile key', () => {
    const withoutKey = new Object3D();
    const withKey = new Object3D();

    withKey.userData[HEX_KEY_USER_DATA_FIELD] = '-3,8';

    expect(
      findFirstHexKeyInIntersections([asIntersection(withoutKey), asIntersection(withKey)]),
    ).toBe('-3,8');
  });
});
