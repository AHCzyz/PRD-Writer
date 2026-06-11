import { describe, expect, it } from 'vitest';
import { constrainImageDimensions, hasImageInClipboard } from '../image-handler';

describe('image clipboard handling', () => {
  it('detects image items synchronously before the paste event returns', () => {
    const event = {
      clipboardData: {
        items: [
          { type: 'text/plain' },
          { type: 'image/png' },
        ],
      },
    } as unknown as ClipboardEvent;

    expect(hasImageInClipboard(event)).toBe(true);
  });

  it('ignores non-image clipboard items', () => {
    const event = {
      clipboardData: {
        items: [{ type: 'text/plain' }],
      },
    } as unknown as ClipboardEvent;

    expect(hasImageInClipboard(event)).toBe(false);
  });

  it('constrains wide images while preserving aspect ratio', () => {
    expect(constrainImageDimensions({ width: 600, height: 400 }, 300)).toEqual({
      width: 300,
      height: 200,
    });
    expect(constrainImageDimensions({ width: 240, height: 160 }, 300)).toEqual({
      width: 240,
      height: 160,
    });
  });
});
