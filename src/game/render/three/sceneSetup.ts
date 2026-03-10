import { OrthographicCamera, Scene, WebGLRenderer } from 'three';

const BACKGROUND_COLOR = 0x101418;
const DEFAULT_DEVICE_PIXEL_RATIO = 1;
const MAX_DEVICE_PIXEL_RATIO = 2;

type ViewportSize = {
  width: number;
  height: number;
};

const toPositiveInteger = (value: number): number => {
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : 1;
};

const readViewportSize = (canvas: HTMLCanvasElement): ViewportSize => {
  const rect = canvas.getBoundingClientRect();

  return {
    width: toPositiveInteger(rect.width || canvas.clientWidth || canvas.width),
    height: toPositiveInteger(rect.height || canvas.clientHeight || canvas.height),
  };
};

const readDevicePixelRatio = (): number => {
  const ratio = globalThis.window?.devicePixelRatio ?? DEFAULT_DEVICE_PIXEL_RATIO;
  return Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(DEFAULT_DEVICE_PIXEL_RATIO, ratio));
};

export type ThreeSceneSetup = {
  scene: Scene;
  camera: OrthographicCamera;
  renderer: WebGLRenderer;
  getViewportSize: () => ViewportSize;
  syncViewportSize: () => ViewportSize;
  destroy: () => void;
};

export const createSceneSetup = (canvas: HTMLCanvasElement): ThreeSceneSetup => {
  const scene = new Scene();
  const camera = new OrthographicCamera(0, 1, 0, 1, -2000, 2000);
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
  });

  renderer.setClearColor(BACKGROUND_COLOR, 1);
  camera.position.set(0, 0, 1000);
  camera.lookAt(0, 0, 0);

  let viewportSize: ViewportSize = { width: 1, height: 1 };

  const applyViewportSize = (nextSize: ViewportSize) => {
    viewportSize = nextSize;
    renderer.setPixelRatio(readDevicePixelRatio());
    renderer.setSize(nextSize.width, nextSize.height, false);

    camera.left = 0;
    camera.right = nextSize.width;
    camera.top = 0;
    camera.bottom = nextSize.height;
    camera.updateProjectionMatrix();
  };

  applyViewportSize(readViewportSize(canvas));

  const syncViewportSize = (): ViewportSize => {
    const nextSize = readViewportSize(canvas);

    if (nextSize.width !== viewportSize.width || nextSize.height !== viewportSize.height) {
      applyViewportSize(nextSize);
    }

    return viewportSize;
  };

  return {
    scene,
    camera,
    renderer,
    getViewportSize: () => viewportSize,
    syncViewportSize,
    destroy: () => {
      renderer.dispose();
    },
  };
};
