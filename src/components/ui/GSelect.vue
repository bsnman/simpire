<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string;
    id?: string;
    disabled?: boolean;
  }>(),
  {
    id: undefined,
    disabled: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const onChange = (event: { target: unknown }) => {
  const target = event.target as { value?: unknown } | null;

  if (!target || typeof target.value !== 'string') {
    return;
  }

  emit('update:modelValue', target.value);
};
</script>

<template>
  <select
    :id="props.id"
    class="game-select"
    :value="props.modelValue"
    :disabled="props.disabled"
    @change="onChange"
  >
    <slot></slot>
  </select>
</template>

<style scoped>
.game-select {
  width: 100%;
  border: 1px solid rgba(176, 189, 209, 0.34);
  border-radius: 0.72rem;
  background: linear-gradient(160deg, #32455f, #1f2d3f);
  color: #f5f7fb;
  padding: 0.68rem 0.85rem;
  font-size: 1rem;
  font-family: 'Gill Sans', 'Trebuchet MS', sans-serif;
  letter-spacing: 0.02em;
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
}

.game-select:hover {
  border-color: rgba(232, 198, 146, 0.7);
  background: linear-gradient(160deg, #405a7b, #2a3c54);
}

.game-select:focus-visible {
  outline: 2px solid rgba(245, 213, 150, 0.95);
  outline-offset: 2px;
}

.game-select:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
