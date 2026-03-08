import { reactive } from 'vue';
import { defineStore } from 'pinia';

export const useTemplateStore = defineStore('template', () => {
  const mapTiles = reactive([
    [
      {
        type: 'grass',
      },
      {
        type: 'grass',
      },
    ],
    [
      {
        type: 'hill',
      },
      {
        type: 'plains',
      },
      {
        type: 'grass',
      },
    ],
    [
      {
        type: 'water',
      },
      {
        type: 'water',
      },
    ],
  ]);

  return {
    mapTiles,
  };
});
