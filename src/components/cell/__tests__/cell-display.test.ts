import { describe, expect, it } from 'vitest';
import { cellHasImage, shouldShowCellEditor } from '../cell-display';
import { createTextCell, type TabMLCell } from '../../../types/tabml';

describe('cell display mode', () => {
  it('keeps image cells in floating renderer mode while focused but not editing', () => {
    const imageCell: TabMLCell = {
      content: [],
      image: { src: 'image.png', width: 120, height: 80 },
    };

    expect(cellHasImage(imageCell)).toBe(true);
    expect(shouldShowCellEditor(imageCell, true, false)).toBe(false);
    expect(shouldShowCellEditor(imageCell, true, true)).toBe(true);
  });

  it('still mounts the editor for focused text cells to support direct typing', () => {
    expect(shouldShowCellEditor(createTextCell('Text'), true, false)).toBe(true);
    expect(shouldShowCellEditor(createTextCell('Text'), false, false)).toBe(false);
  });

  it('detects inline image content as an image cell', () => {
    const imageCell: TabMLCell = {
      content: [{ type: 'image', src: 'image.png', width: 120, height: 80 }],
    };

    expect(cellHasImage(imageCell)).toBe(true);
  });
});
