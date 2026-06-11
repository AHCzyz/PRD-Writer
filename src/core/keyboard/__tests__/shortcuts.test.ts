import { describe, expect, it } from 'vitest';
import { isSaveShortcut } from '../shortcuts';

describe('keyboard shortcuts', () => {
  it('detects Ctrl+S and Meta+S regardless of key casing', () => {
    expect(isSaveShortcut({ ctrlKey: true, metaKey: false, key: 's' })).toBe(true);
    expect(isSaveShortcut({ ctrlKey: true, metaKey: false, key: 'S' })).toBe(true);
    expect(isSaveShortcut({ ctrlKey: false, metaKey: true, key: 'S' })).toBe(true);

    expect(isSaveShortcut({ ctrlKey: false, metaKey: false, key: 's' })).toBe(false);
    expect(isSaveShortcut({ ctrlKey: true, metaKey: false, key: 'x' })).toBe(false);
  });
});
