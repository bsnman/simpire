import { Application } from 'pixi.js';

import type { GameMap } from '@/types/map';
import { MapLayer } from '@/game/render/layers/MapLayer';

export class GameRenderer {
  private readonly app = new Application();
  private readonly mapLayer = new MapLayer();
  private initialized = false;
  private zoom = 0.62;
  private readonly minZoom = 0.3;
  private readonly maxZoom = 2.5;

  async init(canvas: unknown) {
    if (this.initialized) {
      return;
    }

    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('GameRenderer.init requires a canvas element.');
    }

    await this.app.init({
      canvas,
      resizeTo: canvas.parentElement ?? window,
      antialias: true,
      background: '#101418',
    });

    this.app.stage.addChild(this.mapLayer.container);
    this.app.stage.scale.set(this.zoom);
    this.initialized = true;
  }

  renderMap(map: GameMap) {
    if (!this.initialized) {
      return;
    }

    this.mapLayer.render(map);
  }

  zoomByWheel(deltaY: number, screenX: number, screenY: number) {
    if (!this.initialized) {
      return;
    }

    const factor = deltaY < 0 ? 1.1 : 0.9;
    const oldZoom = this.zoom;
    const nextZoom = Math.min(this.maxZoom, Math.max(this.minZoom, oldZoom * factor));

    if (nextZoom === oldZoom) {
      return;
    }

    const stage = this.app.stage;
    const worldX = (screenX - stage.position.x) / oldZoom;
    const worldY = (screenY - stage.position.y) / oldZoom;

    stage.scale.set(nextZoom);
    stage.position.set(screenX - worldX * nextZoom, screenY - worldY * nextZoom);
    this.zoom = nextZoom;
  }

  destroy() {
    if (!this.initialized) {
      return;
    }

    this.mapLayer.destroy();
    this.app.destroy(true);
    this.initialized = false;
  }
}
