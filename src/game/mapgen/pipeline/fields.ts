export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const createScalarField = (length: number, initialValue = 0): Float64Array => {
  if (!Number.isInteger(length) || length < 0) {
    throw new Error('Field length must be a non-negative integer.');
  }

  const field = new Float64Array(length);

  if (initialValue !== 0) {
    field.fill(initialValue);
  }

  return field;
};

export const normalizeField = (values: ArrayLike<number>): Float64Array => {
  if (!values.length) {
    return new Float64Array();
  }

  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('Cannot normalize a field with non-finite values.');
    }

    minValue = Math.min(minValue, value);
    maxValue = Math.max(maxValue, value);
  }

  const span = Math.max(1e-9, maxValue - minValue);
  const normalized = new Float64Array(values.length);

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] as number;
    normalized[index] = clamp01((value - minValue) / span);
  }

  return normalized;
};

export const percentileValue = (values: readonly number[], percentile: number): number => {
  if (!values.length) {
    return 0;
  }

  const clampedPercentile = clamp01(percentile);
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.floor(clampedPercentile * (sorted.length - 1));
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
};

export const average = (values: readonly number[]): number => {
  if (!values.length) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};
