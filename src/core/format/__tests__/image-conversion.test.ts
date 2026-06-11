import { describe, expect, it } from 'vitest';
import { markupToTiptapHTML } from '../markup-to-tiptap';
import { tiptapToCell } from '../tiptap-to-markup';
import type { TabMLCell } from '../../../types/tabml';

describe('image cell conversion', () => {
  it('does not duplicate an exclusive cell image when committing editor content', () => {
    const original: TabMLCell = {
      content: [],
      image: { src: 'data:image/png;base64,abc123', width: 120, height: 80 },
    };
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: { src: 'data:image/png;base64,abc123', width: 120, height: 80 },
            },
          ],
        },
      ],
    };

    expect(tiptapToCell(json, original)).toEqual(original);
  });

  it('collapses repeated identical image nodes back to one exclusive cell image', () => {
    const original: TabMLCell = {
      content: [],
      image: { src: 'data:image/png;base64,abc123', width: 120, height: 80 },
    };
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: { src: 'data:image/png;base64,abc123', width: 120, height: 80 },
            },
            {
              type: 'image',
              attrs: { src: 'data:image/png;base64,abc123', width: 120, height: 80 },
            },
          ],
        },
      ],
    };

    expect(tiptapToCell(json, original)).toEqual(original);
  });

  it('does not render both content images and a stale exclusive image', () => {
    const html = markupToTiptapHTML({
      content: [
        {
          type: 'image',
          src: 'data:image/png;base64,abc123',
          width: 120,
          height: 80,
        },
      ],
      image: { src: 'data:image/png;base64,abc123', width: 120, height: 80 },
    });

    expect(html.match(/<img/g)).toHaveLength(1);
  });
});
