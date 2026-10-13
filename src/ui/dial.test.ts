import { describe, expect, it } from 'vitest';
import { DIAL_MAX, GREAT_FRACTION } from '../core/meter';
import { angleFor } from './dial';

describe('where the needle points', () => {
  it('rests hard left on a free deal and hard right at the stop', () => {
    expect(angleFor(0)).toBe(-110);
    expect(angleFor(DIAL_MAX)).toBe(110);
  });

  it('stands straight up on the great-deal line', () => {
    expect(angleFor(GREAT_FRACTION)).toBeCloseTo(0, 9);
  });

  it('leans right at the redline', () => {
    expect(angleFor(1)).toBeCloseTo(36.667, 3);
  });

  it('never leaves the dial', () => {
    expect(angleFor(-5)).toBe(-110);
    expect(angleFor(99)).toBe(110);
    expect(angleFor(NaN)).toBe(-110);
  });
});
