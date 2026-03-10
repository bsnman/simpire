import { Group, Raycaster } from 'three';

import type { GameMap } from '~/types/map';
import { MapLayer, type HoveredTile } from '~/game/render/layers/MapLayer';
import {
  EDGE_PAN_SPEED_PX_PER_SECOND,
  getArrowKeyPanVector,
  getEdgePanVector,
  normalizePanVector,
  POINTER_LOCK_PAN_SENSITIVITY,
} from '~/game/render/cameraControls';
import { createSceneSetup, type ThreeSceneSetup } from '~/game/render/three/sceneSetup';

type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export class GameRenderer {
  private readonly mapLayer = new MapLayer();
  private readonly raycaster = new Raycaster();
  private readonly viewport = new Group();
  private sceneSetup: ThreeSceneSetup | null = null;
  private initialized = false;
  private zoom = 0.62;
  private readonly minZoom = 0.3;
  private readonly maxZoom = 2.5;
  private pointerLocked = false;
  private edgePointerPosition: { x: number; y: number } | null = null;
  private edgePointerViewportSize: { width: number; height: number } | null = null;
  private arrowKeyPanState = { left: false, right: false, up: false, down: false };
  private animationFrameHandle: number | null = null;
  private previousFrameTime: number | null = null;

  constructor() {
    this.viewport.name = 'map-viewport';
  }

  async init(canvas: unknown) {
    if (this.initialized) {
      return;
    }

    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('GameRenderer.init requires a canvas element.');
    }

    this.sceneSetup = createSceneSetup(canvas);
    this.viewport.clear();
    this.viewport.position.set(0, 0, 0);
    this.viewport.scale.set(this.zoom, this.zoom, 1);
    this.viewport.add(this.mapLayer.group);
    this.sceneSetup.scene.add(this.viewport);

    this.initialized = true;
    this.animationFrameHandle = globalThis.window.requestAnimationFrame(this.handleFrame);
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
    if (!this.initialized || this.pointerLocked || !this.sceneSetup) {
      return;
    }

    const viewportSize = this.sceneSetup.getViewportSize();

    this.mapLayer.updateHoveredTileAtScreenPoint({
      screenX,
      screenY,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
      camera: this.sceneSetup.camera,
      raycaster: this.raycaster,
    });
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

    const worldX = (screenX - this.viewport.position.x) / oldZoom;
    const worldY = (screenY - this.viewport.position.y) / oldZoom;

    this.viewport.scale.set(nextZoom, nextZoom, 1);
    this.viewport.position.set(screenX - worldX * nextZoom, screenY - worldY * nextZoom, 0);
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

    if (this.animationFrameHandle !== null) {
      globalThis.window.cancelAnimationFrame(this.animationFrameHandle);
      this.animationFrameHandle = null;
    }

    this.previousFrameTime = null;
    this.mapLayer.destroy();

    if (this.sceneSetup) {
      this.sceneSetup.scene.remove(this.viewport);
      this.sceneSetup.destroy();
      this.sceneSetup = null;
    }

    this.pointerLocked = false;
    this.edgePointerPosition = null;
    this.edgePointerViewportSize = null;
    this.clearArrowKeyPan();
    this.initialized = false;
  }

  private panByScreenDelta(deltaX: number, deltaY: number) {
    this.viewport.position.x += deltaX;
    this.viewport.position.y += deltaY;
  }

  private readonly handleFrame = (timestamp: number) => {
    if (!this.initialized || !this.sceneSetup) {
      return;
    }

    this.sceneSetup.syncViewportSize();

    const deltaSeconds =
      this.previousFrameTime === null
        ? 0
        : Math.max(0, (timestamp - this.previousFrameTime) / 1000);

    this.previousFrameTime = timestamp;

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

    if (vector.x !== 0 || vector.y !== 0) {
      this.panByScreenDelta(
        -vector.x * EDGE_PAN_SPEED_PX_PER_SECOND * deltaSeconds,
        -vector.y * EDGE_PAN_SPEED_PX_PER_SECOND * deltaSeconds,
      );

      if (this.edgePointerPosition) {
        this.updateHoveredTileFromScreenPoint(
          this.edgePointerPosition.x,
          this.edgePointerPosition.y,
        );
      }
    }

    this.sceneSetup.renderer.render(this.sceneSetup.scene, this.sceneSetup.camera);
    this.animationFrameHandle = globalThis.window.requestAnimationFrame(this.handleFrame);
  };
}
