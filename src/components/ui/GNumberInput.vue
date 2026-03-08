<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number;
    id?: string;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
  }>(),
  {
    id: undefined,
    min: undefined,
    max: undefined,
    step: 1,
    disabled: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const onInput = (event: { target: unknown }) => {
  const target = event.target as { value?: unknown } | null;

  if (!target || typeof target.value !== 'string') {
    return;
  }

  const value = Number.parseFloat(target.value);

  if (!Number.isFinite(value)) {
    return;
  }

  emit('update:modelValue', value);
};
</script>

<template>
  <input
    :id="props.id"
    type="number"
    class="game-number-input"
    :value="props.modelValue"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :disabled="props.disabled"
    @input="onInput"
  />
</template>

<style scoped>
.game-number-input {
  width: 100%;
  border: 1px solid rgba(176, 189, 209, 0.34);
  border-radius: 0.72rem;
  background: linear-gradient(160deg, #2b3f58, #1b2a3b);
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

.game-number-input:hover {
  border-color: rgba(232, 198, 146, 0.7);
  background: linear-gradient(160deg, #385173, #22344a);
}

.game-number-input:focus-visible {
  outline: 2px solid rgba(245, 213, 150, 0.95);
  outline-offset: 2px;
}

.game-number-input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
