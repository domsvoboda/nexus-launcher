import { expect, it } from 'vitest';
import { resolutionZoom } from './window-zoom.js';

it('keeps 100% up to the design size and scales larger windows by their limiting side', () => {
  expect(resolutionZoom(1440, 900)).toBe(1);
  expect(resolutionZoom(1600, 1000)).toBe(1);
  expect(resolutionZoom(1920, 1080)).toBe(1.1);
  expect(resolutionZoom(2560, 1440)).toBe(1.45);
  expect(resolutionZoom(3840, 2160)).toBe(2.15);
  expect(resolutionZoom(3440, 1080)).toBe(1.1);
  expect(resolutionZoom(10000, 8000)).toBe(2.5);
  expect(resolutionZoom(0, 0)).toBe(1);
});
