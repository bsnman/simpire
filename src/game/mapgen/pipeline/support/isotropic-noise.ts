import { clamp } from '/game/mapgen/helpers';

export type FieldNoiseAt = (q: number, r: number, salt?: string) => number;

export type IsotropicFieldSampleConfig = {
  contrast?: number;
  frequency?: number;
  octaves?: number;
  warpAmount?: number;
  warpOctaves?: number;
};

const DEFAULT_SAMPLE_CONFIG: Required<IsotropicFieldSampleConfig> = {
  contrast: 1.18,
  frequency: 0.16,
  octaves: 3,
  warpAmount: 0.55,
  warpOctaves: 2,
};

const SAMPLE_ANGLES = [0, Math.PI / 3, (2 * Math.PI) / 3] as const;
const AXIAL_TO_WORLD_X = Math.sqrt(3);
const AXIAL_TO_WORLD_Y = 1.5;

const lerp = (start: number, end: number, amount: number): number => start + (end - start) * amount;

const smoothstep = (value: number): number => value * value * (3 - 2 * value);

const sampleValueNoise = (noiseAt: FieldNoiseAt, x: number, y: number, salt: string): number => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const v00 = noiseAt(x0, y0, salt);
  const v10 = noiseAt(x1, y0, salt);
  const v01 = noiseAt(x0, y1, salt);
  const v11 = noiseAt(x1, y1, salt);
  const lower = lerp(v00, v10, tx);
  const upper = lerp(v01, v11, tx);

  return lerp(lower, upper, ty);
};

const sampleFractalNoise = (
  noiseAt: FieldNoiseAt,
  x: number,
  y: number,
  salt: string,
  octaves: number,
): number => {
  let amplitude = 1;
  let frequency = 1;
  let value = 0;
  let amplitudeSum = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    value +=
      sampleValueNoise(noiseAt, x * frequency, y * frequency, `${salt}-o${octave}`) * amplitude;
    amplitudeSum += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return amplitudeSum > 0 ? value / amplitudeSum : 0;
};

export const normalizeIsotropicBlend = (value: number, contrast = 1.18): number =>
  clamp((value - 0.5) * contrast + 0.5, 0, 1);

export const sampleIsotropicField = (
  q: number,
  r: number,
  noiseAt: FieldNoiseAt,
  salt: string,
  config: IsotropicFieldSampleConfig = {},
): number => {
  const { contrast, frequency, octaves, warpAmount, warpOctaves } = {
    ...DEFAULT_SAMPLE_CONFIG,
    ...config,
  };
  const fieldX = (q + r / 2) * AXIAL_TO_WORLD_X * frequency;
  const fieldY = r * AXIAL_TO_WORLD_Y * frequency;
  const warpX = sampleFractalNoise(
    noiseAt,
    fieldX + 17.13,
    fieldY - 3.71,
    `${salt}-warp-x`,
    warpOctaves,
  );
  const warpY = sampleFractalNoise(
    noiseAt,
    fieldX - 9.41,
    fieldY + 5.29,
    `${salt}-warp-y`,
    warpOctaves,
  );
  const warpedX = fieldX + (warpX - 0.5) * warpAmount;
  const warpedY = fieldY + (warpY - 0.5) * warpAmount;

  let rotatedBlend = 0;

  for (const [angleIndex, angle] of SAMPLE_ANGLES.entries()) {
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const rotatedX = warpedX * cosAngle - warpedY * sinAngle;
    const rotatedY = warpedX * sinAngle + warpedY * cosAngle;

    rotatedBlend += sampleFractalNoise(
      noiseAt,
      rotatedX,
      rotatedY,
      `${salt}-rot-${angleIndex}`,
      octaves,
    );
  }

  return normalizeIsotropicBlend(rotatedBlend / SAMPLE_ANGLES.length, contrast);
};
