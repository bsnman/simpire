import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAP_RENDER_CONFIG,
  mergeMapRenderConfig,
  normalizeMapRenderConfig,
} from '~/game/render/mapRenderConfig';

describe('mapRenderConfig', () => {
  it('fills missing nested layer settings from defaults', () => {
    expect(
      normalizeMapRenderConfig({
        hexOutline: {
          enabled: false,
        },
      }),
    ).toEqual({
      tileColor: DEFAULT_MAP_RENDER_CONFIG.tileColor,
      hexOutline: {
        ...DEFAULT_MAP_RENDER_CONFIG.hexOutline,
        enabled: false,
      },
      elevation: DEFAULT_MAP_RENDER_CONFIG.elevation,
    });
  });

  it('merges partial updates without dropping sibling layer settings', () => {
    const currentConfig = normalizeMapRenderConfig({
      tileColor: {
        enabled: false,
        fallbackTileColor: '#123456',
      },
      elevation: {
        scaleMultiplier: 1.25,
      },
    });

    expect(
      mergeMapRenderConfig(currentConfig, {
        hexOutline: {
          color: '#abcdef',
          thickness: 4,
        },
        elevation: {
          enabled: false,
        },
      }),
    ).toEqual({
      tileColor: {
        enabled: false,
        fallbackTileColor: '#123456',
      },
      hexOutline: {
        ...DEFAULT_MAP_RENDER_CONFIG.hexOutline,
        color: '#abcdef',
        thickness: 4,
      },
      elevation: {
        enabled: false,
        zOffset: DEFAULT_MAP_RENDER_CONFIG.elevation.zOffset,
        scaleMultiplier: 1.25,
      },
    });
  });

  it('fills missing outline thickness from defaults', () => {
    expect(
      normalizeMapRenderConfig({
        hexOutline: {
          color: '#abcdef',
        },
      }),
    ).toEqual({
      tileColor: DEFAULT_MAP_RENDER_CONFIG.tileColor,
      hexOutline: {
        ...DEFAULT_MAP_RENDER_CONFIG.hexOutline,
        color: '#abcdef',
      },
      elevation: DEFAULT_MAP_RENDER_CONFIG.elevation,
    });
  });
});
