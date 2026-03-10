import { Application } from 'pixi.js';

import type { GameMap } from '~/types/map';
import { MapLayer, type HoveredTile } from '~/game/render/layers/MapLayer';
import {
  EDGE_PAN_SPEED_PX_PER_SECOND,
  getArrowKeyPanVector,
  getEdgePanVector,
  normalizePanVector,
  POINTER_LOCK_PAN_SENSITIVITY,
} from '~/game/render/cameraControls';

type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export class GameRenderer {
  private readonly app = new Application();
  private readonly mapLayer = new MapLayer();
  private initialized = false;
  private zoom = 0.62;
  private readonly minZoom = 0.3;
  private readonly maxZoom = 2.5;
  private pointerLocked = false;
  private edgePointerPosition: { x: number; y: number } | null = null;
  private edgePointerViewportSize: { width: number; height: number } | null = null;
  private arrowKeyPanState = { left: false, right: false, up: false, down: false };

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
    this.app.ticker.add(this.handleTick);
    this.initialized = true;
  }

  renderMap(map: GameMap) {
    if (!this.initialized) {
      return;
    }

    this.mapLayer.render(map);
  }

  setHoveredTileChangeHandler(handler: ((hoveredTile: HoveredTile | null) => void) | null) {
    this.mapLayer.setHoveredTileChangeHandler(handler);
  }

  updateHoveredTileFromScreenPoint(screenX: number, screenY: number) {
    if (!this.initialized || this.pointerLocked) {
      return;
    }

    const stage = this.app.stage;
    const worldX = (screenX - stage.position.x) / stage.scale.x;
    const worldY = (screenY - stage.position.y) / stage.scale.y;
    this.mapLayer.updateHoveredTileAtWorldPoint(worldX, worldY);
  }

  clearHoveredTile() {
    this.mapLayer.clearHoveredTile();
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

  setEdgePointerPosition(x: number, y: number, viewportWidth: number, viewportHeight: number) {
    if (!this.initialized || this.pointerLocked) {
      return;
    }

    this.edgePointerPosition = { x, y };
    this.edgePointerViewportSize = {
      width: viewportWidth,
      height: viewportHeight,
    };
  }

  clearEdgePointerPosition() {
    this.edgePointerPosition = null;
    this.edgePointerViewportSize = null;
  }

  setPointerLockActive(isLocked: boolean) {
    this.pointerLocked = isLocked;

    if (isLocked) {
      this.clearEdgePointerPosition();
      this.clearHoveredTile();
    }
  }

  panByPointerLockMovement(movementX: number, movementY: number) {
    if (!this.initialized || !this.pointerLocked) {
      return;
    }

    this.panByScreenDelta(
      -movementX * POINTER_LOCK_PAN_SENSITIVITY,
      -movementY * POINTER_LOCK_PAN_SENSITIVITY,
    );
  }

  panByDragMovement(movementX: number, movementY: number) {
    if (!this.initialized || this.pointerLocked) {
      return;
    }

    this.panByScreenDelta(movementX, movementY);
  }

  setArrowKeyPanPressed(key: ArrowKey, isPressed: boolean) {
    if (key === 'ArrowLeft') {
      this.arrowKeyPanState.left = isPressed;
      return;
    }

    if (key === 'ArrowRight') {
      this.arrowKeyPanState.right = isPressed;
      return;
    }

    if (key === 'ArrowUp') {
      this.arrowKeyPanState.up = isPressed;
      return;
    }

    this.arrowKeyPanState.down = isPressed;
  }

  clearArrowKeyPan() {
    this.arrowKeyPanState.left = false;
    this.arrowKeyPanState.right = false;
    this.arrowKeyPanState.up = false;
    this.arrowKeyPanState.down = false;
  }

  destroy() {
    if (!this.initialized) {
      return;
    }

    this.app.ticker.remove(this.handleTick);
    this.mapLayer.destroy();
    this.app.destroy(true);
    this.pointerLocked = false;
    this.edgePointerPosition = null;
    this.edgePointerViewportSize = null;
    this.clearArrowKeyPan();
    this.initialized = false;
  }

  private panByScreenDelta(deltaX: number, deltaY: number) {
    this.app.stage.position.set(
      this.app.stage.position.x + deltaX,
      this.app.stage.position.y + deltaY,
    );
  }

  private readonly handleTick = () => {
    if (!this.initialized) {
      return;
    }

    const keyboardVector = getArrowKeyPanVector(this.arrowKeyPanState);
    const edgeVector =
      !this.pointerLocked && this.edgePointerPosition && this.edgePointerViewportSize
        ? getEdgePanVector(
            this.edgePointerPosition.x,
            this.edgePointerPosition.y,
            this.edgePointerViewportSize.width,
            this.edgePointerViewportSize.height,
          )
        : { x: 0, y: 0 };
    const vector = normalizePanVector(
      edgeVector.x + keyboardVector.x,
      edgeVector.y + keyboardVector.y,
    );

    if (vector.x === 0 && vector.y === 0) {
      return;
    }

    const deltaSeconds = this.app.ticker.deltaMS / 1000;
    this.panByScreenDelta(
      -vector.x * EDGE_PAN_SPEED_PX_PER_SECOND * deltaSeconds,
      -vector.y * EDGE_PAN_SPEED_PX_PER_SECOND * deltaSeconds,
    );

    if (this.edgePointerPosition) {
      this.updateHoveredTileFromScreenPoint(this.edgePointerPosition.x, this.edgePointerPosition.y);
    }
  };
}
