import { createRouter, createWebHistory } from 'vue-router';

import HomeView from '~/views/HomeView.vue';
import CreateGameView from '~/views/CreateGameView.vue';
import GameView from '~/views/GameView.vue';
import ModelDebugView from '~/views/ModelDebugView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/home',
    },
    {
      path: '/home',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/create-game',
      name: 'create-game',
      component: CreateGameView,
    },
    {
      path: '/game/:gameId',
      name: 'game',
      component: GameView,
      props: true,
    },
    {
      path: '/model-debug/',
      name: 'model-debug',
      component: ModelDebugView,
    },
  ],
});

export default router;
