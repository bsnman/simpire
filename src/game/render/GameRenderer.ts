import { Group, Plane, Quaternion, Raycaster, Vector2, Vector3 } from 'three';

import type { GameMap } from '~/types/map';
import { MapLayer, type HoveredTile } from '~/game/render/layers/MapLayer';
import {
  EDGE_PAN_SPEED_PX_PER_SECOND,
  getArrowKeyPanVector,
  getEdgePanVector,
  normalizePanVector,
  POINTER_LOCK_PAN_SENSITIVITY,
} from '~/game/render/cameraControls';
import { getZoomTiltRadians } from '~/game/render/cameraTilt';
import { createSceneSetup, type ThreeSceneSetup } from '~/game/render/three/sceneSetup';

type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export class GameRenderer {
  private readonly mapLayer = new MapLayer();
  private readonly raycaster = new Raycaster();
  private readonly viewport = new Group();
  private readonly initialZoom = 0.62;
  private readonly minZoom = 0.3;
  private readonly maxZoom = 5;
  private readonly tiltStartZoom = this.initialZoom;
  private readonly tiltMaxZoom = 2.5;
  private readonly maxTiltRadians = (42 * Math.PI) / 180;
  private readonly zoomAnchorNdc = new Vector2();
  private readonly zoomAnchorPlane = new Plane();
  private readonly zoomAnchorPlaneNormal = new Vector3();
  private readonly zoomAnchorPlanePoint = new Vector3();
  private readonly zoomAnchorPlaneQuaternion = new Quaternion();
  private readonly zoomAnchorWorldPoint = new Vector3();
  private readonly zoomAnchorLocalPoint = new Vector3();
  private readonly zoomAnchorProjectedPoint = new Vector3();
  private readonly zoomAnchorRayDirection = new Vector3();
  private sceneSetup: ThreeSceneSetup | null = null;
  private initialized = false;
  private zoom = this.initialZoom;
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
    this.applyZoomAndTilt(this.zoom);
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

  getTiltDegrees(): number {
    return (this.getTiltForZoom(this.zoom) * 180) / Math.PI;
  }

  zoomByWheel(deltaY: number, screenX: number, screenY: number) {
    if (!this.initialized || !this.sceneSetup) {
      return;
    }

    const factor = deltaY < 0 ? 1.1 : 0.9;
    const oldZoom = this.zoom;
    const nextZoom = Math.min(this.maxZoom, Math.max(this.minZoom, oldZoom * factor));

    if (nextZoom === oldZoom) {
      return;
    }

    const hasZoomAnchor = this.captureZoomAnchorLocalPoint(screenX, screenY);
    this.applyZoomAndTilt(nextZoom);

    if (hasZoomAnchor) {
      this.keepZoomAnchorAtScreenPoint(screenX, screenY);
    }

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

  private applyZoomAndTilt(zoom: number) {
    this.viewport.scale.set(zoom, zoom, 1);
    this.viewport.rotation.set(this.getTiltForZoom(zoom), 0, 0);
  }

  private getTiltForZoom(zoom: number): number {
    return getZoomTiltRadians(zoom, {
      minZoom: this.minZoom,
      tiltStartZoom: this.tiltStartZoom,
      maxZoom: this.tiltMaxZoom,
      maxTiltRadians: this.maxTiltRadians,
    });
  }

  private captureZoomAnchorLocalPoint(screenX: number, screenY: number): boolean {
    if (!this.sceneSetup) {
      return false;
    }

    const viewportSize = this.sceneSetup.getViewportSize();

    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
      return false;
    }

    this.zoomAnchorNdc.set(
      (screenX / viewportSize.width) * 2 - 1,
      -(screenY / viewportSize.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.zoomAnchorNdc, this.sceneSetup.camera);

    this.viewport.updateMatrixWorld(true);
    this.viewport.getWorldQuaternion(this.zoomAnchorPlaneQuaternion);
    this.zoomAnchorPlaneNormal.set(0, 0, 1).applyQuaternion(this.zoomAnchorPlaneQuaternion);
    this.viewport.getWorldPosition(this.zoomAnchorPlanePoint);
    this.zoomAnchorPlane.setFromNormalAndCoplanarPoint(
      this.zoomAnchorPlaneNormal,
      this.zoomAnchorPlanePoint,
    );

    const denominator = this.zoomAnchorPlane.normal.dot(this.raycaster.ray.direction);

    if (Math.abs(denominator) <= 1e-8) {
      return false;
    }

    const signedDistanceToPlane = this.zoomAnchorPlane.distanceToPoint(this.raycaster.ray.origin);
    const distanceAlongRay = -signedDistanceToPlane / denominator;

    this.zoomAnchorRayDirection.copy(this.raycaster.ray.direction).multiplyScalar(distanceAlongRay);
    this.zoomAnchorWorldPoint.copy(this.raycaster.ray.origin).add(this.zoomAnchorRayDirection);
    this.zoomAnchorLocalPoint.copy(this.zoomAnchorWorldPoint);
    this.viewport.worldToLocal(this.zoomAnchorLocalPoint);
    return true;
  }

  private keepZoomAnchorAtScreenPoint(screenX: number, screenY: number) {
    if (!this.sceneSetup) {
      return;
    }

    const viewportSize = this.sceneSetup.getViewportSize();

    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    this.viewport.updateMatrixWorld(true);
    this.zoomAnchorWorldPoint.copy(this.zoomAnchorLocalPoint);
    this.viewport.localToWorld(this.zoomAnchorWorldPoint);
    this.zoomAnchorProjectedPoint.copy(this.zoomAnchorWorldPoint).project(this.sceneSetup.camera);

    const projectedScreenX = (this.zoomAnchorProjectedPoint.x + 1) * 0.5 * viewportSize.width;
    const projectedScreenY = (1 - this.zoomAnchorProjectedPoint.y) * 0.5 * viewportSize.height;

    this.viewport.position.x += screenX - projectedScreenX;
    this.viewport.position.y += screenY - projectedScreenY;
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
