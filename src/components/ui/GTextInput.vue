<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string;
    id?: string;
    placeholder?: string;
    disabled?: boolean;
    spellcheck?: boolean;
  }>(),
  {
    id: undefined,
    placeholder: '',
    disabled: false,
    spellcheck: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const onInput = (event: { target: unknown }) => {
  const target = event.target as { value?: unknown } | null;

  if (!target || typeof target.value !== 'string') {
    return;
  }

  emit('update:modelValue', target.value);
};
</script>

<template>
  <input
    :id="props.id"
    type="text"
    class="game-text-input"
    :value="props.modelValue"
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :spellcheck="props.spellcheck"
    @input="onInput"
  />
</template>

<style scoped>
.game-text-input {
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

.game-text-input::placeholder {
  color: rgba(214, 220, 232, 0.7);
}

.game-text-input:hover {
  border-color: rgba(232, 198, 146, 0.7);
  background: linear-gradient(160deg, #385173, #22344a);
}

.game-text-input:focus-visible {
  outline: 2px solid rgba(245, 213, 150, 0.95);
  outline-offset: 2px;
}

.game-text-input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
