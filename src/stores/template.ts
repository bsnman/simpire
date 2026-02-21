import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export const useTemplateStore = defineStore('template', () => {
  const counter = ref(0);
  const label = ref('Template');

  const counterLabel = computed(() => `${label.value}: ${counter.value}`);

  const increment = () => {
    counter.value += 1;
  };

  const reset = () => {
    counter.value = 0;
  };

  const setLabel = (nextLabel: string) => {
    label.value = nextLabel;
  };

  return {
    counter,
    label,
    counterLabel,
    increment,
    reset,
    setLabel,
  };
});
