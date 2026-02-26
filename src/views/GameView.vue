<script setup lang="ts">
import { Application, Container, Sprite, Assets } from 'pixi.js';
import { onMounted, ref } from 'vue';

const props = defineProps<{ gameId: string }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

const app = new Application();

const drawPixi = async () => {
  // Initialize the application
  await app.init({ background: '#1099bb', resizeTo: window });

  // Append the application canvas to the document body
  document.body.appendChild(app.canvas);

  // Create and add a container to the stage
  const container = new Container();

  app.stage.addChild(container);

  // Load the bunny texture
  const texture = await Assets.load('https://pixijs.com/assets/bunny.png');

  // Create a 5x5 grid of bunnies in the container
  for (let i = 0; i < 25; i++) {
    const bunny = new Sprite(texture);

    bunny.x = (i % 5) * 40;
    bunny.y = Math.floor(i / 5) * 40;
    container.addChild(bunny);
  }

  // Move the container to the center
  container.x = app.screen.width / 2;
  container.y = app.screen.height / 2;

  // Center the bunny sprites in local container coordinates
  container.pivot.x = container.width / 2;
  container.pivot.y = container.height / 2;

  // Listen for animate update
  app.ticker.add((time) => {
    // Continuously rotate the container!
    // * use delta to create frame-independent transform *
    container.rotation -= 0.01 * time.deltaTime;
  });
};

onMounted(() => {
  drawPixi();
});
</script>

<template>
  <div class="page game-page">
    <canvas :ref="canvasRef" :id="props.gameId" class="game-canvas"></canvas>
  </div>
</template>

<style scoped>
.game-page {
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-canvas {
  border: 2px solid #555;
  background-color: #222;
  width: 100%;
  height: 98vh;
}

.back-link {
  display: inline-block;
  margin-top: 1.5rem;
  color: #7eb4ff;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}
</style>
