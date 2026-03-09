import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { MapgenReproPayload } from '~/game/mapgen/repro';

const DEBUG_ENABLED_STORAGE_KEY = 'simpire:mapgen-debug-enabled';
const INCLUDE_MAP_DATA_STORAGE_KEY = 'simpire:mapgen-debug-include-map-data';

const readStoredFlag = (key: string, fallback: boolean): boolean => {
  try {
    const value = globalThis.localStorage?.getItem(key);

    if (value === '1') {
      return true;
    }

    if (value === '0') {
      return false;
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const writeStoredFlag = (key: string, enabled: boolean) => {
  try {
    globalThis.localStorage?.setItem(key, enabled ? '1' : '0');
  } catch {
    // Ignore persistence failures in restricted browser contexts.
  }
};

export const useMapgenDebugStore = defineStore('mapgenDebug', () => {
  const isEnabled = ref(readStoredFlag(DEBUG_ENABLED_STORAGE_KEY, import.meta.env.DEV));
  const includeFullMapData = ref(readStoredFlag(INCLUDE_MAP_DATA_STORAGE_KEY, false));
  const lastReproPayload = ref<MapgenReproPayload | null>(null);

  const setEnabled = (enabled: boolean) => {
    isEnabled.value = enabled;
    writeStoredFlag(DEBUG_ENABLED_STORAGE_KEY, enabled);
  };

  const toggleEnabled = () => {
    setEnabled(!isEnabled.value);
  };

  const setIncludeFullMapData = (enabled: boolean) => {
    includeFullMapData.value = enabled;
    writeStoredFlag(INCLUDE_MAP_DATA_STORAGE_KEY, enabled);
  };

  const setLastReproPayload = (payload: MapgenReproPayload | null) => {
    lastReproPayload.value = payload;
  };

  return {
    isEnabled,
    includeFullMapData,
    lastReproPayload,
    setEnabled,
    toggleEnabled,
    setIncludeFullMapData,
    setLastReproPayload,
  };
});
