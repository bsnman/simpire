import { createRouter, createWebHistory } from 'vue-router';

import HomeView from '../views/HomeView.vue';
import GameView from '../views/GameView.vue';

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
      path: '/game/:id',
      name: 'game',
      component: GameView,
      props: true,
    },
  ],
});

export default router;
