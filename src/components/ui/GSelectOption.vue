<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    value: string;
    disabled?: boolean;
  }>(),
  {
    disabled: false,
  },
);
</script>

<template>
  <option class="game-select-option" :value="props.value" :disabled="props.disabled">
    <slot></slot>
  </option>
</template>

<style scoped>
.game-select-option {
  color: #111924;
  background-color: #f5f7fb;
}

.game-select-option:checked {
  color: #f5f7fb;
  background-color: #2a3c54;
}

.game-select-option:disabled {
  color: rgba(17, 25, 36, 0.5);
}
</style>
