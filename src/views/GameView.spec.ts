import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MAP_RENDER_CONFIG, normalizeMapRenderConfig } from '~/game/render/mapRenderConfig';
import type { RendererPerformanceStats } from '~/game/render/rendererPerformanceStats';
import { useMapgenDebugStore } from '~/stores/debugger/mapgen';

const rendererHarness = vi.hoisted(() => ({
  performanceStats: {
    fps: 0,
    frameTimeMs: 0,
    drawCalls: 0,
    triangles: 0,
    lines: 0,
    points: 0,
  } satisfies RendererPerformanceStats,
  performanceStatsHandler: null as ((stats: RendererPerformanceStats) => void) | null,
}));

vi.mock('~/game/render/GameRenderer', () => ({
  GameRenderer: class {
    async init() {}

    renderMap() {}

    destroy() {}

    getMapRenderConfig() {
      return normalizeMapRenderConfig(DEFAULT_MAP_RENDER_CONFIG);
    }

    setMapRenderConfig() {}

    getPerformanceStats() {
      return {
        ...rendererHarness.performanceStats,
      };
    }

    setPerformanceStatsChangeHandler(handler: ((stats: RendererPerformanceStats) => void) | null) {
      rendererHarness.performanceStatsHandler = handler;
    }

    setHoveredTileChangeHandler() {}

    getTiltDegrees() {
      return 0;
    }

    getZoomLevel() {
      return 1;
    }

    zoomByWheel() {}

    updateHoveredTileFromScreenPoint() {}

    clearHoveredTile() {}

    setEdgePointerPosition() {}

    clearEdgePointerPosition() {}

    setPointerLockActive() {}

    panByPointerLockMovement() {}

    panByDragMovement() {}

    orbitByDragMovement() {}

    resetDebugOrbit() {}

    setDebugAxesVisible() {}

    setDebugCameraControlsEnabled() {}

    setArrowKeyPanPressed() {}

    clearArrowKeyPan() {}
  },
}));

import GameView from '~/views/GameView.vue';

describe('GameView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    rendererHarness.performanceStats = {
      fps: 0,
      frameTimeMs: 0,
      drawCalls: 0,
      triangles: 0,
      lines: 0,
      points: 0,
    };
    rendererHarness.performanceStatsHandler = null;
    globalThis.localStorage.clear();
  });

  it('renders the performance block inside the debug panel and reacts to renderer stat updates', async () => {
    const debugStore = useMapgenDebugStore();

    debugStore.setEnabled(true);

    const wrapper = mount(GameView, {
      props: {
        gameId: 'game-view-spec',
      },
      attachTo: globalThis.document.body,
    });

    await nextTick();

    expect(wrapper.text()).toContain('Performance');
    expect(wrapper.text()).toContain('FPS: 0.0 | Frame: 0.00 ms');
    expect(wrapper.text()).toContain('Draw Calls: 0 | Triangles: 0');

    rendererHarness.performanceStats = {
      fps: 58.4,
      frameTimeMs: 17.12,
      drawCalls: 321,
      triangles: 456789,
      lines: 4,
      points: 2,
    };
    rendererHarness.performanceStatsHandler?.(rendererHarness.performanceStats);
    await nextTick();

    expect(wrapper.text()).toContain('FPS: 58.4 | Frame: 17.12 ms');
    expect(wrapper.text()).toContain('Draw Calls: 321 | Triangles: 456789');
    expect(wrapper.text()).toContain('Lines: 4 | Points: 2');

    wrapper.unmount();
  });
});
