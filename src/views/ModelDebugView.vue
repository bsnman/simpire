<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Material,
  Mesh,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import GButton from '~/components/ui/GButton.vue';
import GNumberInput from '~/components/ui/GNumberInput.vue';
import GPanel from '~/components/ui/GPanel.vue';
import GTextInput from '~/components/ui/GTextInput.vue';

const FALLBACK_MODEL_PATHS = [
  '/models/terrain/hill-v2.1.glb',
  '/models/terrain/hill-v2.2.glb',
  '/models/terrain/hill-v2.3.glb',
  '/models/terrain/hill-v2.glb',
  '/models/terrain/hill.glb',
  '/models/terrain/mountain.glb',
] as const;
const MIN_MODEL_SCALE = 0.1;
const DEFAULT_MODEL_SCALE = 1;
const DEFAULT_HEMISPHERE_INTENSITY = 0.7;
const DEFAULT_DIRECTIONAL_INTENSITY = 0.95;
const DEFAULT_DIRECTIONAL_POSITION = { x: 4, y: 6, z: 8 };
const Z_UP_AXIS = new Vector3(0, 0, 1);

type RendererCanvasElement = InstanceType<typeof WebGLRenderer>['domElement'];
type SceneResizeObserver = {
  observe: (target: unknown) => void;
  disconnect: () => void;
};

type ModelManifest = {
  models?: unknown;
};

const router = useRouter();

const canvasRef = ref<RendererCanvasElement | null>(null);
const availableModels = ref<string[]>([]);
const selectedModelPath = ref('');
const modelSearchTerm = ref('');
const isUsingFallbackModels = ref(false);
const isLoadingModel = ref(false);
const modelLoadError = ref('');
const modelScale = ref(DEFAULT_MODEL_SCALE);
const hemisphereLightIntensity = ref(DEFAULT_HEMISPHERE_INTENSITY);
const directionalLightIntensity = ref(DEFAULT_DIRECTIONAL_INTENSITY);
const directionalLightX = ref(DEFAULT_DIRECTIONAL_POSITION.x);
const directionalLightY = ref(DEFAULT_DIRECTIONAL_POSITION.y);
const directionalLightZ = ref(DEFAULT_DIRECTIONAL_POSITION.z);

const loader = new GLTFLoader();

let renderer: WebGLRenderer | null = null;
let scene: Scene | null = null;
let camera: PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let hemisphereLight: HemisphereLight | null = null;
let directionalLight: DirectionalLight | null = null;
let gridHelper: GridHelper | null = null;
let currentModel: Object3D | null = null;
let autoFitScale = 1;
let modelRadius = 1;
let animationFrameHandle = 0;
let resizeObserver: SceneResizeObserver | null = null;
let modelLoadToken = 0;

const formatModelLabel = (modelPath: string): string => {
  const fileName = modelPath.split('/').pop() ?? modelPath;

  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const modelEntries = computed(() => {
  const query = modelSearchTerm.value.trim().toLowerCase();
  const paths = query
    ? availableModels.value.filter((path) => path.toLowerCase().includes(query))
    : availableModels.value;

  return paths.map((path) => ({
    path,
    label: formatModelLabel(path),
  }));
});

const selectedModelLabel = computed(() =>
  selectedModelPath.value ? formatModelLabel(selectedModelPath.value) : 'None',
);

const toUniqueModelPaths = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const pathSet = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    if (!entry.startsWith('/models/')) {
      continue;
    }

    if (!/\.(glb|gltf)$/i.test(entry)) {
      continue;
    }

    pathSet.add(entry);
  }

  return [...pathSet].sort((left, right) => left.localeCompare(right));
};

const setAvailableModels = (paths: string[]) => {
  availableModels.value = paths;

  if (!paths.length) {
    selectedModelPath.value = '';
    return;
  }

  if (!paths.includes(selectedModelPath.value)) {
    selectedModelPath.value = paths[0] ?? '';
  }
};

const loadModelManifest = async () => {
  isUsingFallbackModels.value = false;

  try {
    if (typeof globalThis.fetch !== 'function') {
      throw new Error('Fetch API unavailable.');
    }

    const response = await globalThis.fetch('/models/manifest.json', {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Manifest request failed with status ${response.status}.`);
    }

    const manifest = (await response.json()) as ModelManifest;
    const manifestPaths = toUniqueModelPaths(manifest.models);

    if (manifestPaths.length) {
      setAvailableModels(manifestPaths);
      return;
    }
  } catch {
    // Fall back to known paths below if manifest loading fails.
  }

  isUsingFallbackModels.value = true;
  setAvailableModels([...FALLBACK_MODEL_PATHS]);
};

const readCanvasDimensions = (canvas: RendererCanvasElement) => ({
  width: Math.max(1, Math.floor(canvas.clientWidth || canvas.width || 1)),
  height: Math.max(1, Math.floor(canvas.clientHeight || canvas.height || 1)),
});

const syncViewportSize = () => {
  const canvas = canvasRef.value;

  if (!canvas || !renderer || !camera) {
    return;
  }

  const { width, height } = readCanvasDimensions(canvas);
  renderer.setPixelRatio(Math.min(globalThis.window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
};

const applyLightingSettings = () => {
  if (hemisphereLight) {
    hemisphereLight.intensity = Math.max(0, hemisphereLightIntensity.value);
  }

  if (directionalLight) {
    directionalLight.intensity = Math.max(0, directionalLightIntensity.value);
    directionalLight.position.set(
      directionalLightX.value,
      directionalLightY.value,
      directionalLightZ.value,
    );
  }
};

const applyModelScale = () => {
  if (!currentModel) {
    return;
  }

  const scale = Math.max(MIN_MODEL_SCALE, modelScale.value) * autoFitScale;
  currentModel.scale.setScalar(scale);
};

const resetCamera = () => {
  if (!camera || !controls) {
    return;
  }

  const radius = Math.max(0.5, modelRadius * autoFitScale * modelScale.value);
  camera.position.set(radius * 2.2, radius * 2.4, radius * 1.5);
  camera.near = Math.max(0.01, radius / 60);
  camera.far = Math.max(80, radius * 80);
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.minDistance = Math.max(0.1, radius * 0.25);
  controls.maxDistance = Math.max(20, radius * 30);
  controls.update();
};

const disposeMaterial = (material: Material) => {
  const values = Object.values(material as unknown as Record<string, unknown>);

  for (const value of values) {
    const texture = value as Texture & { isTexture?: boolean };

    if (texture?.isTexture) {
      texture.dispose();
    }
  }

  material.dispose();
};

const disposeObject3D = (object: Object3D) => {
  object.traverse((node) => {
    const mesh = node as Mesh;

    if (!mesh.isMesh) {
      return;
    }

    mesh.geometry?.dispose();

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => disposeMaterial(material));
      return;
    }

    disposeMaterial(mesh.material);
  });
};

const clearCurrentModel = () => {
  if (!scene || !currentModel) {
    return;
  }

  scene.remove(currentModel);
  disposeObject3D(currentModel);
  currentModel = null;
};

const loadModel = async (modelPath: string) => {
  if (!scene) {
    return;
  }

  const activeLoadToken = ++modelLoadToken;
  isLoadingModel.value = true;
  modelLoadError.value = '';
  clearCurrentModel();

  try {
    const gltf = await loader.loadAsync(modelPath);

    if (activeLoadToken !== modelLoadToken) {
      return;
    }

    const root = gltf.scene ?? gltf.scenes[0];

    if (!root) {
      throw new Error('Model did not include a renderable scene.');
    }

    root.updateMatrixWorld(true);

    const bounds = new Box3().setFromObject(root);

    if (bounds.isEmpty()) {
      throw new Error('Model bounds are empty.');
    }

    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001);

    modelRadius = Math.max(size.length() * 0.24, 0.5);
    autoFitScale = 3.6 / maxDimension;
    root.position.sub(center);

    currentModel = root;
    applyModelScale();
    scene.add(root);

    if (gridHelper) {
      const gridScale = Math.max(0.8, Math.min(4, maxDimension * autoFitScale * 0.8));
      gridHelper.scale.setScalar(gridScale);
    }

    resetCamera();
  } catch (error) {
    if (activeLoadToken !== modelLoadToken) {
      return;
    }

    modelLoadError.value =
      error instanceof Error ? error.message : 'Failed to load selected model.';
  } finally {
    if (activeLoadToken === modelLoadToken) {
      isLoadingModel.value = false;
    }
  }
};

const renderLoop = () => {
  if (!renderer || !scene || !camera || !controls) {
    return;
  }

  controls.update();
  renderer.render(scene, camera);
  animationFrameHandle = globalThis.window.requestAnimationFrame(renderLoop);
};

const initScene = () => {
  const canvas = canvasRef.value;

  if (!canvas) {
    return;
  }

  scene = new Scene();
  scene.background = new Color(0x101418);

  camera = new PerspectiveCamera(44, 1, 0.01, 2000);
  camera.up.copy(Z_UP_AXIS);
  camera.position.set(4, 4.8, 2.6);
  camera.lookAt(0, 0, 0);

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x101418, 1);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  hemisphereLight = new HemisphereLight(0xcddcf5, 0x3d3128, hemisphereLightIntensity.value);
  hemisphereLight.position.set(0, 0, 3);
  scene.add(hemisphereLight);

  directionalLight = new DirectionalLight(0xfff3d8, directionalLightIntensity.value);
  directionalLight.position.set(
    directionalLightX.value,
    directionalLightY.value,
    directionalLightZ.value,
  );
  directionalLight.target.position.set(0, 0, 0);
  scene.add(directionalLight);
  scene.add(directionalLight.target);

  gridHelper = new GridHelper(10, 20, 0x4f6072, 0x263645);
  gridHelper.rotation.x = Math.PI / 2;
  scene.add(gridHelper);

  applyLightingSettings();
  syncViewportSize();
  const resizeObserverCtor = (
    globalThis as {
      ResizeObserver?: new (callback: () => void) => SceneResizeObserver;
    }
  ).ResizeObserver;

  if (resizeObserverCtor) {
    resizeObserver = new resizeObserverCtor(() => syncViewportSize());
    resizeObserver.observe(canvas);
  }

  globalThis.window.addEventListener('resize', syncViewportSize);
  renderLoop();
};

const destroyScene = () => {
  modelLoadToken += 1;

  if (animationFrameHandle) {
    globalThis.window.cancelAnimationFrame(animationFrameHandle);
    animationFrameHandle = 0;
  }

  globalThis.window.removeEventListener('resize', syncViewportSize);

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  clearCurrentModel();
  controls?.dispose();
  controls = null;

  if (scene && directionalLight) {
    scene.remove(directionalLight.target);
  }

  renderer?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  hemisphereLight = null;
  directionalLight = null;
  gridHelper = null;
};

const resetLighting = () => {
  hemisphereLightIntensity.value = DEFAULT_HEMISPHERE_INTENSITY;
  directionalLightIntensity.value = DEFAULT_DIRECTIONAL_INTENSITY;
  directionalLightX.value = DEFAULT_DIRECTIONAL_POSITION.x;
  directionalLightY.value = DEFAULT_DIRECTIONAL_POSITION.y;
  directionalLightZ.value = DEFAULT_DIRECTIONAL_POSITION.z;
  applyLightingSettings();
};

const resetPreview = () => {
  modelScale.value = DEFAULT_MODEL_SCALE;
  resetLighting();
  resetCamera();
};

const backToMenu = () => {
  router.push('/home');
};

watch(
  selectedModelPath,
  (nextPath) => {
    if (!nextPath || !scene) {
      return;
    }

    void loadModel(nextPath);
  },
  { flush: 'post' },
);

watch(modelScale, () => {
  applyModelScale();
});

watch(
  [
    hemisphereLightIntensity,
    directionalLightIntensity,
    directionalLightX,
    directionalLightY,
    directionalLightZ,
  ],
  () => {
    applyLightingSettings();
  },
);

onMounted(async () => {
  initScene();
  await loadModelManifest();
});

onUnmounted(() => {
  destroyScene();
});
</script>

<template>
  <div class="page model-debug-page">
    <aside class="model-sidebar">
      <GPanel class="sidebar-panel">
        <div class="sidebar-content">
          <p class="sidebar-kicker">Renderer Sandbox</p>
          <h1 class="sidebar-title">Model Debug</h1>
          <p class="sidebar-subtitle">Preview every GLB/GLTF listed under `public/models`.</p>

          <div class="sidebar-actions">
            <GButton class="sidebar-action" @click="backToMenu">Back To Menu</GButton>
            <GButton class="sidebar-action" @click="resetPreview">Reset View + Lights</GButton>
          </div>

          <div class="field-group">
            <label class="field-label" for="model-search">Find Model</label>
            <GTextInput
              id="model-search"
              v-model="modelSearchTerm"
              placeholder="Type part of path or file name"
            />
          </div>

          <div class="field-group">
            <p class="field-label">Models</p>
            <ul class="model-list">
              <li v-for="entry in modelEntries" :key="entry.path">
                <button
                  class="model-row-button"
                  :class="{ 'model-row-button-active': selectedModelPath === entry.path }"
                  @click="selectedModelPath = entry.path"
                >
                  <span class="model-row-label">{{ entry.label }}</span>
                  <span class="model-row-path">{{ entry.path }}</span>
                </button>
              </li>
            </ul>
            <p v-if="!modelEntries.length" class="field-help">No models match this search.</p>
            <p v-if="isUsingFallbackModels" class="field-help">
              Manifest unavailable, using fallback model list.
            </p>
          </div>

          <div class="field-group">
            <p class="field-label">Model Scale</p>
            <GNumberInput
              id="model-scale"
              v-model="modelScale"
              :min="MIN_MODEL_SCALE"
              :step="0.1"
            />
          </div>

          <div class="field-group">
            <p class="field-label">Lighting</p>
            <div class="lighting-grid">
              <label class="lighting-label" for="hemi-intensity">Hemi Intensity</label>
              <GNumberInput
                id="hemi-intensity"
                v-model="hemisphereLightIntensity"
                :min="0"
                :step="0.05"
              />

              <label class="lighting-label" for="sun-intensity">Directional Intensity</label>
              <GNumberInput
                id="sun-intensity"
                v-model="directionalLightIntensity"
                :min="0"
                :step="0.05"
              />

              <label class="lighting-label" for="sun-x">Directional X</label>
              <GNumberInput id="sun-x" v-model="directionalLightX" :step="0.5" />

              <label class="lighting-label" for="sun-y">Directional Y</label>
              <GNumberInput id="sun-y" v-model="directionalLightY" :step="0.5" />

              <label class="lighting-label" for="sun-z">Directional Z</label>
              <GNumberInput id="sun-z" v-model="directionalLightZ" :step="0.5" />
            </div>
          </div>
        </div>
      </GPanel>
    </aside>

    <section class="preview-shell">
      <canvas ref="canvasRef" class="preview-canvas" @contextmenu.prevent></canvas>

      <div class="preview-overlay preview-overlay-top-left">
        <p class="preview-kicker">Selected Model</p>
        <p class="preview-name">{{ selectedModelLabel }}</p>
      </div>

      <div class="preview-overlay preview-overlay-top-right">
        <p v-if="isLoadingModel" class="preview-status">Loading model...</p>
        <p v-if="modelLoadError" class="preview-error">{{ modelLoadError }}</p>
      </div>

      <div class="preview-overlay preview-overlay-bottom-right">
        <p class="preview-help">Mouse: Left rotate, Right pan, Wheel zoom.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.model-debug-page {
  display: grid;
  grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
  min-height: 100%;
  background:
    radial-gradient(circle at 10% 12%, rgba(169, 124, 71, 0.14), transparent 44%),
    radial-gradient(circle at 90% 86%, rgba(42, 92, 132, 0.24), transparent 48%), #070c12;
}

.model-sidebar {
  padding: clamp(0.85rem, 2vw, 1.25rem);
  min-height: 100vh;
}

.sidebar-panel {
  height: 100%;
  padding: 0.95rem;
}

.sidebar-content {
  display: grid;
  gap: 0.75rem;
  text-align: left;
}

.sidebar-kicker {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(225, 229, 237, 0.88);
}

.sidebar-title {
  margin: 0;
  font-size: clamp(1.5rem, 3.2vw, 2.2rem);
  line-height: 0.98;
  color: #f3e8d0;
  font-family: 'Cinzel', 'Book Antiqua', Palatino, serif;
}

.sidebar-subtitle {
  margin: 0;
  color: rgba(214, 220, 232, 0.88);
  font-size: 0.86rem;
}

.sidebar-actions {
  display: grid;
  gap: 0.5rem;
}

.sidebar-action {
  width: 100%;
}

.field-group {
  display: grid;
  gap: 0.35rem;
}

.field-label {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(225, 229, 237, 0.9);
}

.field-help {
  margin: 0.1rem 0 0;
  color: rgba(214, 220, 232, 0.82);
  font-size: 0.8rem;
}

.model-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
  max-height: 13rem;
  overflow-y: auto;
}

.model-row-button {
  width: 100%;
  text-align: left;
  border-radius: 0.72rem;
  border: 1px solid rgba(176, 189, 209, 0.3);
  background: linear-gradient(160deg, rgba(50, 69, 95, 0.75), rgba(31, 45, 63, 0.7));
  color: #f5f7fb;
  padding: 0.58rem 0.68rem;
  cursor: pointer;
  display: grid;
  gap: 0.15rem;
  font-family: 'Gill Sans', 'Trebuchet MS', sans-serif;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 120ms ease;
}

.model-row-button:hover {
  border-color: rgba(232, 198, 146, 0.7);
  background: linear-gradient(160deg, rgba(64, 90, 123, 0.9), rgba(42, 60, 84, 0.84));
}

.model-row-button:active {
  transform: translateY(1px);
}

.model-row-button-active {
  border-color: rgba(232, 198, 146, 0.82);
  background: linear-gradient(160deg, rgba(72, 100, 136, 0.92), rgba(46, 66, 93, 0.86));
  box-shadow: 0 0.55rem 1rem rgba(0, 0, 0, 0.32);
}

.model-row-label {
  font-size: 0.88rem;
}

.model-row-path {
  font-size: 0.72rem;
  color: rgba(214, 220, 232, 0.82);
  word-break: break-word;
}

.lighting-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.25rem;
}

.lighting-label {
  margin-top: 0.1rem;
  color: rgba(214, 220, 232, 0.9);
  font-size: 0.8rem;
}

.preview-shell {
  position: relative;
  min-height: 100vh;
}

.preview-canvas {
  width: 100%;
  height: 100%;
  display: block;
  border-left: 1px solid rgba(150, 168, 194, 0.3);
  background: #101418;
}

.preview-overlay {
  position: absolute;
  padding: 0.6rem 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(150, 168, 194, 0.35);
  background: linear-gradient(155deg, rgba(27, 40, 58, 0.82), rgba(13, 20, 31, 0.84));
  backdrop-filter: blur(4px);
}

.preview-overlay-top-left {
  top: clamp(0.75rem, 2vw, 1.15rem);
  left: clamp(0.75rem, 2vw, 1.15rem);
  max-width: min(26rem, 55%);
}

.preview-overlay-top-right {
  top: clamp(0.75rem, 2vw, 1.15rem);
  right: clamp(0.75rem, 2vw, 1.15rem);
  max-width: min(24rem, 46%);
  text-align: right;
}

.preview-overlay-bottom-right {
  right: clamp(0.75rem, 2vw, 1.15rem);
  bottom: clamp(0.75rem, 2vw, 1.15rem);
  max-width: min(26rem, 60%);
}

.preview-kicker {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(225, 229, 237, 0.86);
}

.preview-name {
  margin: 0.15rem 0 0;
  color: #f3e8d0;
  font-size: 1rem;
  line-height: 1.2;
}

.preview-status,
.preview-error,
.preview-help {
  margin: 0;
  color: rgba(214, 220, 232, 0.94);
  font-size: 0.82rem;
}

.preview-error {
  color: #ffd3c7;
}

@media (max-width: 980px) {
  .model-debug-page {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
  }

  .model-sidebar {
    min-height: 0;
    padding-bottom: 0;
  }

  .sidebar-panel {
    max-height: min(52vh, 34rem);
    overflow: auto;
  }

  .preview-shell {
    min-height: 56vh;
  }

  .preview-canvas {
    min-height: 56vh;
    border-left: none;
    border-top: 1px solid rgba(150, 168, 194, 0.3);
  }
}
</style>
