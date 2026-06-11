import { describe, expect, it } from 'vitest';
import { renderCellHTML } from '../renderer';

describe('Tab-ML renderer', () => {
  it('renders a cell image even when the cell also has an empty text run', () => {
    const html = renderCellHTML({
      content: [{ type: 'text', text: '' }],
      image: {
        src: 'data:image/png;base64,abc123',
        width: 120,
        height: 80,
      },
    });

    expect(html).toContain('<img');
    expect(html).toContain('src="data:image/png;base64,abc123"');
    expect(html).toContain('width="120"');
    expect(html).toContain('height="80"');
    expect(html).toContain('class="cell-image"');
  });
});
