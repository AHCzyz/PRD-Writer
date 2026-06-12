import { describe, expect, it } from 'vitest';
import { isCellImageInteractionTarget } from '../image-target';

function fakeTarget(match: boolean): EventTarget {
  return {
    closest: (selector: string) =>
      match && selector === '.cell-image, .tabml-image' ? {} : null,
  } as unknown as EventTarget;
}

describe('image interaction target detection', () => {
  it('recognizes rendered and editor image elements', () => {
    const calls: string[] = [];
    const target = {
      closest: (selector: string) => {
        calls.push(selector);
        return selector.includes('.tabml-image') ? {} : null;
      },
    } as unknown as EventTarget;

    expect(isCellImageInteractionTarget(target)).toBe(true);
    expect(calls).toEqual(['.cell-image, .tabml-image']);
  });

  it('ignores non-image targets and null targets', () => {
    expect(isCellImageInteractionTarget(fakeTarget(false))).toBe(false);
    expect(isCellImageInteractionTarget(null)).toBe(false);
  });
});
