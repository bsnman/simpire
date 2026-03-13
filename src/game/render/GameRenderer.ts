import { AxesHelper, Box3, Group, Plane, Quaternion, Raycaster, Vector2, Vector3 } from 'three';

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
import {
  DEFAULT_MAP_RENDER_CONFIG,
  mergeMapRenderConfig,
  normalizeMapRenderConfig,
  type MapRenderConfig,
  type MapRenderConfigInput,
} from '~/game/render/mapRenderConfig';
import { createSceneSetup, type ThreeSceneSetup } from '~/game/render/three/sceneSetup';

type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

type MapLayerLike = Pick<
  MapLayer,
  | 'group'
  | 'clearHoveredTile'
  | 'destroy'
  | 'render'
  | 'setHoveredTileChangeHandler'
  | 'updateHoveredTileAtScreenPoint'
>;

type GameRendererDependencies = {
  mapLayer?: MapLayerLike;
  sceneSetupFactory?: typeof createSceneSetup;
};

export class GameRenderer {
  private static readonly MIN_CAMERA_Z = 1000;
  private static readonly CAMERA_DEPTH_MARGIN = 300;
  private static readonly MIN_CAMERA_NEAR = 0.1;
  private static readonly MIN_CAMERA_FAR = 2000;
  private static readonly ORBIT_YAW_SENSITIVITY = 0.005;
  private static readonly ORBIT_TILT_SENSITIVITY = 0.0035;
  private static readonly MIN_ORBIT_TILT_OFFSET = (-40 * Math.PI) / 180;
  private static readonly MAX_ORBIT_TILT_OFFSET = (40 * Math.PI) / 180;
  private static readonly MIN_FINAL_TILT_RADIANS = (-70 * Math.PI) / 180;
  private static readonly MAX_FINAL_TILT_RADIANS = (78 * Math.PI) / 180;
  private static readonly DEBUG_AXES_SIZE = 360;

  private readonly mapLayer: MapLayerLike;
  private readonly raycaster = new Raycaster();
  private readonly viewport = new Group();
  private readonly panGroup = new Group();
  private readonly debugAxes = new AxesHelper(GameRenderer.DEBUG_AXES_SIZE);
  private readonly mapDepthBounds = new Box3();
  private readonly initialZoom = 1;
  private readonly minZoom = 0.5;
  private readonly maxZoom = 5;
  private readonly tiltStartZoom = this.initialZoom / 3;
  private readonly tiltMaxZoom = this.maxZoom / 1.3;
  private readonly maxTiltRadians = (64 * Math.PI) / 180;
  private readonly zoomAnchorNdc = new Vector2();
  private readonly zoomAnchorPlane = new Plane();
  private readonly zoomAnchorPlaneNormal = new Vector3();
  private readonly zoomAnchorPlanePoint = new Vector3();
  private readonly zoomAnchorPlaneQuaternion = new Quaternion();
  private readonly zoomAnchorWorldPoint = new Vector3();
  private readonly zoomAnchorLocalPoint = new Vector3();
  private readonly zoomAnchorProjectedPoint = new Vector3();
  private readonly zoomAnchorRayDirection = new Vector3();
  private readonly panDeltaLocal = new Vector3();
  private readonly panInverseQuaternion = new Quaternion();
  private readonly sceneSetupFactory: typeof createSceneSetup;
  private sceneSetup: ThreeSceneSetup | null = null;
  private initialized = false;
  private debugCameraControlsEnabled = false;
  private zoom = this.initialZoom;
  private pointerLocked = false;
  private edgePointerPosition: { x: number; y: number } | null = null;
  private edgePointerViewportSize: { width: number; height: number } | null = null;
  private arrowKeyPanState = { left: false, right: false, up: false, down: false };
  private animationFrameHandle: number | null = null;
  private previousFrameTime: number | null = null;
  private orbitYawRadians = 0;
  private orbitTiltOffsetRadians = 0;
  private currentMapRenderConfig: MapRenderConfig =
    normalizeMapRenderConfig(DEFAULT_MAP_RENDER_CONFIG);
  private lastRenderedMap: GameMap | null = null;

  constructor({
    mapLayer = new MapLayer(),
    sceneSetupFactory = createSceneSetup,
  }: GameRendererDependencies = {}) {
    this.mapLayer = mapLayer;
    this.sceneSetupFactory = sceneSetupFactory;
    this.viewport.name = 'map-viewport';
    this.panGroup.name = 'map-pan-group';
    this.debugAxes.name = 'debug-axes';
    this.debugAxes.visible = false;
  }

  async init(canvas: unknown) {
    if (this.initialized) {
      return;
    }

    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('GameRenderer.init requires a canvas element.');
    }

    this.sceneSetup = this.sceneSetupFactory(canvas);
    this.viewport.clear();
    this.panGroup.clear();
    this.viewport.position.set(0, 0, 0);
    this.panGroup.position.set(0, 0, 0);
    this.applyZoomAndTilt(this.zoom);
    this.panGroup.add(this.mapLayer.group);
    this.panGroup.add(this.debugAxes);
    this.viewport.add(this.panGroup);
    this.sceneSetup.scene.add(this.viewport);

    this.initialized = true;

    if (this.lastRenderedMap) {
      this.mapLayer.render(this.lastRenderedMap, this.currentMapRenderConfig);
      this.updateCameraDepthRange();
    }

    this.animationFrameHandle = globalThis.window.requestAnimationFrame(this.handleFrame);
  }

  renderMap(map: GameMap) {
    this.lastRenderedMap = map;

    if (!this.initialized) {
      return;
    }

    this.mapLayer.render(map, this.currentMapRenderConfig);
    this.updateCameraDepthRange();
  }

  setMapRenderConfig(config: MapRenderConfigInput) {
    this.currentMapRenderConfig = normalizeMapRenderConfig(
      mergeMapRenderConfig(this.currentMapRenderConfig, config),
    );

    if (!this.initialized || !this.lastRenderedMap) {
      return;
    }

    this.mapLayer.render(this.lastRenderedMap, this.currentMapRenderConfig);
    this.updateCameraDepthRange();
  }

  getMapRenderConfig(): MapRenderConfig {
    return normalizeMapRenderConfig(this.currentMapRenderConfig);
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
    return (this.getEffectiveTiltRadians(this.zoom) * 180) / Math.PI;
  }

  getZoomLevel(): number {
    return this.zoom;
  }

  zoomByWheel(deltaY: number, screenX: number, screenY: number) {
    if (!this.initialized || !this.sceneSetup) {
      return;
    }

    const factor = deltaY < 0 ? 1.1 : 0.9;
    const oldZoom = this.zoom;
    const nextZoom = this.debugCameraControlsEnabled
      ? Math.max(0.02, oldZoom * factor)
      : Math.min(this.maxZoom, Math.max(this.minZoom, oldZoom * factor));

    if (nextZoom === oldZoom) {
      return;
    }

    const hasZoomAnchor = this.captureZoomAnchorLocalPoint(screenX, screenY);
    this.applyZoomAndTilt(nextZoom);
    this.updateCameraDepthRange();

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

  orbitByDragMovement(movementX: number, movementY: number) {
    if (!this.initialized || this.pointerLocked) {
      return;
    }

    this.orbitYawRadians += movementX * GameRenderer.ORBIT_YAW_SENSITIVITY;
    if (this.debugCameraControlsEnabled) {
      this.orbitTiltOffsetRadians -= movementY * GameRenderer.ORBIT_TILT_SENSITIVITY;
    } else {
      this.orbitTiltOffsetRadians = Math.max(
        GameRenderer.MIN_ORBIT_TILT_OFFSET,
        Math.min(
          GameRenderer.MAX_ORBIT_TILT_OFFSET,
          this.orbitTiltOffsetRadians - movementY * GameRenderer.ORBIT_TILT_SENSITIVITY,
        ),
      );
    }
    this.applyZoomAndTilt(this.zoom);
  }

  resetDebugOrbit() {
    this.orbitYawRadians = 0;
    this.orbitTiltOffsetRadians = 0;
    this.applyZoomAndTilt(this.zoom);
  }

  setDebugAxesVisible(isVisible: boolean) {
    this.debugAxes.visible = isVisible;
  }

  setDebugCameraControlsEnabled(isEnabled: boolean) {
    this.debugCameraControlsEnabled = isEnabled;
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
    this.lastRenderedMap = null;
    this.currentMapRenderConfig = normalizeMapRenderConfig(DEFAULT_MAP_RENDER_CONFIG);
    this.clearArrowKeyPan();
    this.initialized = false;
  }

  private panByScreenDelta(deltaX: number, deltaY: number) {
    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    const scale = this.viewport.scale.x;

    if (scale === 0) {
      return;
    }

    this.panDeltaLocal.set(deltaX / scale, deltaY / scale, 0);
    this.panInverseQuaternion.copy(this.viewport.quaternion).invert();
    this.panDeltaLocal.applyQuaternion(this.panInverseQuaternion);
    this.panGroup.position.add(this.panDeltaLocal);
  }

  private applyZoomAndTilt(zoom: number) {
    this.viewport.scale.set(zoom, zoom, zoom);
    this.viewport.rotation.set(this.getEffectiveTiltRadians(zoom), 0, this.orbitYawRadians);
  }

  private getEffectiveTiltRadians(zoom: number): number {
    const rawTilt = this.getTiltForZoom(zoom) + this.orbitTiltOffsetRadians;

    if (this.debugCameraControlsEnabled) {
      return rawTilt;
    }

    return Math.max(
      GameRenderer.MIN_FINAL_TILT_RADIANS,
      Math.min(GameRenderer.MAX_FINAL_TILT_RADIANS, rawTilt),
    );
  }

  private updateCameraDepthRange() {
    if (!this.sceneSetup) {
      return;
    }

    this.viewport.updateMatrixWorld(true);
    this.mapDepthBounds.setFromObject(this.mapLayer.group);

    if (this.mapDepthBounds.isEmpty()) {
      return;
    }

    const targetCameraZ = Math.max(
      GameRenderer.MIN_CAMERA_Z,
      this.mapDepthBounds.max.z + GameRenderer.CAMERA_DEPTH_MARGIN,
    );

    if (this.sceneSetup.camera.position.z !== targetCameraZ) {
      this.sceneSetup.camera.position.z = targetCameraZ;
      this.sceneSetup.camera.lookAt(0, 0, 0);
    }

    const far = Math.max(
      GameRenderer.MIN_CAMERA_FAR,
      targetCameraZ - this.mapDepthBounds.min.z + GameRenderer.CAMERA_DEPTH_MARGIN,
    );

    if (
      this.sceneSetup.camera.near !== GameRenderer.MIN_CAMERA_NEAR ||
      this.sceneSetup.camera.far !== far
    ) {
      this.sceneSetup.camera.near = GameRenderer.MIN_CAMERA_NEAR;
      this.sceneSetup.camera.far = far;
      this.sceneSetup.camera.updateProjectionMatrix();
    }
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
    this.panGroup.getWorldPosition(this.zoomAnchorPlanePoint);
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
    this.panGroup.worldToLocal(this.zoomAnchorLocalPoint);
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
    this.panGroup.localToWorld(this.zoomAnchorWorldPoint);
    this.zoomAnchorProjectedPoint.copy(this.zoomAnchorWorldPoint).project(this.sceneSetup.camera);

    const projectedScreenX = (this.zoomAnchorProjectedPoint.x + 1) * 0.5 * viewportSize.width;
    const projectedScreenY = (1 - this.zoomAnchorProjectedPoint.y) * 0.5 * viewportSize.height;

    this.panByScreenDelta(screenX - projectedScreenX, screenY - projectedScreenY);
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
