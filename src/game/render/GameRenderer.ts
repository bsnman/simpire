import {
  AxesHelper,
  Box3,
  Group,
  OrthographicCamera,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from 'three';

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

type ViewportSize = {
  width: number;
  height: number;
};

type DepthRange = {
  hasBounds: boolean;
  minDistance: number;
  maxDistance: number;
};

export class GameRenderer {
  private static readonly MIN_CAMERA_DISTANCE = 1000;
  private static readonly CAMERA_DEPTH_MARGIN = 300;
  private static readonly MIN_CAMERA_NEAR = 0.1;
  private static readonly MIN_CAMERA_FAR = 2000;
  private static readonly ORBIT_YAW_SENSITIVITY = 0.005;
  private static readonly ORBIT_TILT_SENSITIVITY = 0.0035;
  private static readonly MIN_ORBIT_TILT_OFFSET = (-40 * Math.PI) / 180;
  private static readonly MAX_ORBIT_TILT_OFFSET = (40 * Math.PI) / 180;
  private static readonly MIN_FINAL_TILT_RADIANS = (-70 * Math.PI) / 180;
  private static readonly MAX_FINAL_TILT_RADIANS = (78 * Math.PI) / 180;
  private static readonly MIN_DEBUG_TILT_RADIANS = (-85 * Math.PI) / 180;
  private static readonly MAX_DEBUG_TILT_RADIANS = (85 * Math.PI) / 180;
  private static readonly DEBUG_AXES_SIZE = 360;

  private readonly mapLayer: MapLayerLike;
  private readonly raycaster = new Raycaster();
  private readonly sceneRoot = new Group();
  private readonly debugAxes = new AxesHelper(GameRenderer.DEBUG_AXES_SIZE);
  private readonly mapDepthBounds = new Box3();
  private readonly initialZoom = 1;
  private readonly minZoom = 0.5;
  private readonly maxZoom = 5;
  private readonly tiltStartZoom = this.initialZoom / 3;
  private readonly tiltMaxZoom = this.maxZoom / 1.3;
  private readonly maxTiltRadians = (64 * Math.PI) / 180;
  private readonly screenPointNdc = new Vector2();
  private readonly mapPlane = new Plane(new Vector3(0, 0, 1), 0);
  private readonly mapPlaneAnchor = new Vector3();
  private readonly mapPlaneDisplacedAnchor = new Vector3();
  private readonly mapPlaneZoomAnchorBefore = new Vector3();
  private readonly mapPlaneZoomAnchorAfter = new Vector3();
  private readonly cameraFocusWorld = new Vector3();
  private readonly cameraFocusDelta = new Vector3();
  private readonly cameraOffsetDirection = new Vector3();
  private readonly cameraPosition = new Vector3();
  private readonly cameraBoundsCorner = new Vector3();
  private readonly sceneSetupFactory: typeof createSceneSetup;
  private sceneSetup: ThreeSceneSetup | null = null;
  private initialized = false;
  private cameraFocusInitialized = false;
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
    this.sceneRoot.name = 'map-scene-root';
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
    this.sceneRoot.clear();
    this.sceneRoot.add(this.mapLayer.group);
    this.sceneRoot.add(this.debugAxes);
    this.sceneSetup.scene.add(this.sceneRoot);
    this.initializeCameraFocusFromViewport(this.sceneSetup.getViewportSize());
    this.updateCameraTransform();

    this.initialized = true;

    if (this.lastRenderedMap) {
      this.mapLayer.render(this.lastRenderedMap, this.currentMapRenderConfig);
      this.updateCameraTransform();
    }

    this.animationFrameHandle = globalThis.window.requestAnimationFrame(this.handleFrame);
  }

  renderMap(map: GameMap) {
    this.lastRenderedMap = map;

    if (!this.initialized) {
      return;
    }

    this.mapLayer.render(map, this.currentMapRenderConfig);
    this.updateCameraTransform();
  }

  setMapRenderConfig(config: MapRenderConfigInput) {
    this.currentMapRenderConfig = normalizeMapRenderConfig(
      mergeMapRenderConfig(this.currentMapRenderConfig, config),
    );

    if (!this.initialized || !this.lastRenderedMap) {
      return;
    }

    this.mapLayer.render(this.lastRenderedMap, this.currentMapRenderConfig);
    this.updateCameraTransform();
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

    const hasZoomAnchor = this.intersectScreenPointWithMapPlane(
      screenX,
      screenY,
      this.mapPlaneZoomAnchorBefore,
    );

    this.zoom = nextZoom;
    this.updateCameraTransform();

    if (
      hasZoomAnchor &&
      this.intersectScreenPointWithMapPlane(screenX, screenY, this.mapPlaneZoomAnchorAfter)
    ) {
      this.cameraFocusDelta.copy(this.mapPlaneZoomAnchorBefore).sub(this.mapPlaneZoomAnchorAfter);
      this.cameraFocusWorld.add(this.cameraFocusDelta);
      this.updateCameraTransform();
    }
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
    this.updateCameraTransform();
  }

  resetDebugOrbit() {
    this.orbitYawRadians = 0;
    this.orbitTiltOffsetRadians = 0;
    this.updateCameraTransform();
  }

  setDebugAxesVisible(isVisible: boolean) {
    this.debugAxes.visible = isVisible;
  }

  setDebugCameraControlsEnabled(isEnabled: boolean) {
    this.debugCameraControlsEnabled = isEnabled;
    this.updateCameraTransform();
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
      this.sceneSetup.scene.remove(this.sceneRoot);
      this.sceneSetup.destroy();
      this.sceneSetup = null;
    }

    this.pointerLocked = false;
    this.edgePointerPosition = null;
    this.edgePointerViewportSize = null;
    this.lastRenderedMap = null;
    this.currentMapRenderConfig = normalizeMapRenderConfig(DEFAULT_MAP_RENDER_CONFIG);
    this.clearArrowKeyPan();
    this.cameraFocusWorld.set(0, 0, 0);
    this.cameraFocusInitialized = false;
    this.initialized = false;
  }

  private panByScreenDelta(deltaX: number, deltaY: number) {
    if ((deltaX === 0 && deltaY === 0) || !this.sceneSetup) {
      return;
    }

    const viewportSize = this.sceneSetup.getViewportSize();

    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    const anchorScreenX = viewportSize.width * 0.5;
    const anchorScreenY = viewportSize.height * 0.5;

    if (
      !this.intersectScreenPointWithMapPlane(anchorScreenX, anchorScreenY, this.mapPlaneAnchor) ||
      !this.intersectScreenPointWithMapPlane(
        anchorScreenX - deltaX,
        anchorScreenY - deltaY,
        this.mapPlaneDisplacedAnchor,
      )
    ) {
      return;
    }

    this.cameraFocusDelta.copy(this.mapPlaneDisplacedAnchor).sub(this.mapPlaneAnchor);
    this.cameraFocusWorld.add(this.cameraFocusDelta);
    this.updateCameraTransform();
  }

  private updateCameraTransform() {
    if (!this.sceneSetup) {
      return;
    }

    const viewportSize = this.sceneSetup.getViewportSize();

    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    this.initializeCameraFocusFromViewport(viewportSize);

    const camera = this.sceneSetup.camera;
    const halfViewWidth = viewportSize.width / (2 * this.zoom);
    const halfViewHeight = viewportSize.height / (2 * this.zoom);

    camera.left = -halfViewWidth;
    camera.right = halfViewWidth;
    camera.top = -halfViewHeight;
    camera.bottom = halfViewHeight;

    let cameraDistance = GameRenderer.MIN_CAMERA_DISTANCE;
    let depthRange = this.getMapDepthRange(camera, cameraDistance);

    if (depthRange.hasBounds && depthRange.minDistance < GameRenderer.CAMERA_DEPTH_MARGIN) {
      cameraDistance += GameRenderer.CAMERA_DEPTH_MARGIN - depthRange.minDistance;
      depthRange = this.getMapDepthRange(camera, cameraDistance);
    }

    const near = depthRange.hasBounds
      ? Math.max(
          GameRenderer.MIN_CAMERA_NEAR,
          depthRange.minDistance - GameRenderer.CAMERA_DEPTH_MARGIN,
        )
      : GameRenderer.MIN_CAMERA_NEAR;
    const far = depthRange.hasBounds
      ? Math.max(
          GameRenderer.MIN_CAMERA_FAR,
          depthRange.maxDistance + GameRenderer.CAMERA_DEPTH_MARGIN,
        )
      : GameRenderer.MIN_CAMERA_FAR;

    camera.near = near;
    camera.far = far > near ? far : near + GameRenderer.CAMERA_DEPTH_MARGIN;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  private initializeCameraFocusFromViewport(viewportSize: ViewportSize) {
    if (this.cameraFocusInitialized) {
      return;
    }

    this.cameraFocusWorld.set(viewportSize.width * 0.5, viewportSize.height * 0.5, 0);
    this.cameraFocusInitialized = true;
  }

  private getMapDepthRange(camera: OrthographicCamera, cameraDistance: number): DepthRange {
    this.applyCameraPose(camera, cameraDistance);
    this.mapLayer.group.updateMatrixWorld(true);
    this.mapDepthBounds.setFromObject(this.mapLayer.group);

    if (this.mapDepthBounds.isEmpty()) {
      return {
        hasBounds: false,
        minDistance: cameraDistance,
        maxDistance: cameraDistance,
      };
    }

    let minDistance = Number.POSITIVE_INFINITY;
    let maxDistance = 0;
    const { min, max } = this.mapDepthBounds;

    for (const x of [min.x, max.x]) {
      for (const y of [min.y, max.y]) {
        for (const z of [min.z, max.z]) {
          this.cameraBoundsCorner.set(x, y, z);
          this.cameraBoundsCorner.applyMatrix4(camera.matrixWorldInverse);
          const distance = -this.cameraBoundsCorner.z;

          minDistance = Math.min(minDistance, distance);
          maxDistance = Math.max(maxDistance, distance);
        }
      }
    }

    return {
      hasBounds: true,
      minDistance,
      maxDistance,
    };
  }

  private applyCameraPose(camera: OrthographicCamera, cameraDistance: number) {
    const tilt = this.getEffectiveTiltRadians(this.zoom);
    const yaw = this.orbitYawRadians;
    const sinTilt = Math.sin(tilt);

    this.cameraOffsetDirection.set(
      sinTilt * Math.sin(yaw),
      sinTilt * Math.cos(yaw),
      Math.cos(tilt),
    );
    this.cameraPosition
      .copy(this.cameraOffsetDirection)
      .multiplyScalar(cameraDistance)
      .add(this.cameraFocusWorld);

    camera.position.copy(this.cameraPosition);
    camera.lookAt(this.cameraFocusWorld);
    camera.updateMatrixWorld(true);
  }

  private getEffectiveTiltRadians(zoom: number): number {
    const rawTilt = this.getTiltForZoom(zoom) + this.orbitTiltOffsetRadians;

    if (this.debugCameraControlsEnabled) {
      return Math.max(
        GameRenderer.MIN_DEBUG_TILT_RADIANS,
        Math.min(GameRenderer.MAX_DEBUG_TILT_RADIANS, rawTilt),
      );
    }

    return Math.max(
      GameRenderer.MIN_FINAL_TILT_RADIANS,
      Math.min(GameRenderer.MAX_FINAL_TILT_RADIANS, rawTilt),
    );
  }

  private getTiltForZoom(zoom: number): number {
    return getZoomTiltRadians(zoom, {
      minZoom: this.minZoom,
      tiltStartZoom: this.tiltStartZoom,
      maxZoom: this.tiltMaxZoom,
      maxTiltRadians: this.maxTiltRadians,
    });
  }

  private intersectScreenPointWithMapPlane(
    screenX: number,
    screenY: number,
    target: Vector3,
  ): boolean {
    if (!this.sceneSetup) {
      return false;
    }

    const viewportSize = this.sceneSetup.getViewportSize();

    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
      return false;
    }

    this.screenPointNdc.set(
      (screenX / viewportSize.width) * 2 - 1,
      -(screenY / viewportSize.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.screenPointNdc, this.sceneSetup.camera);
    return this.raycaster.ray.intersectPlane(this.mapPlane, target) !== null;
  }

  private readonly handleFrame = (timestamp: number) => {
    if (!this.initialized || !this.sceneSetup) {
      return;
    }

    this.sceneSetup.syncViewportSize();
    this.updateCameraTransform();

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
