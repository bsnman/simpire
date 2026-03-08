import { Application } from 'pixi.js';

import type { GameMap } from '../../types/map';
import { MapLayer } from './layers/MapLayer';

export class GameRenderer {
  private readonly app = new Application();
  private readonly mapLayer = new MapLayer();
  private initialized = false;

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
    this.initialized = true;
  }

  renderMap(map: GameMap) {
    if (!this.initialized) {
      return;
    }

    this.mapLayer.render(map);
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
