import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{(?<body>[^}]*)\\}`));
  return match?.groups?.body ?? '';
}

describe('cell layout CSS', () => {
  it('keeps long cell text on one visual line unless the text contains explicit line breaks', () => {
    const wrapper = cssBlock('.cell-wrapper');
    const renderer = cssBlock('.cell-renderer');
    const editor = cssBlock('.cell-editor-content .ProseMirror');

    expect(wrapper).toContain('white-space: pre;');
    expect(wrapper).not.toContain('word-break: break-word');
    expect(renderer).toContain('white-space: pre;');
    expect(editor).toContain('white-space: pre;');
  });
});
