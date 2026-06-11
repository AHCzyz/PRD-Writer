import { describe, expect, it } from 'vitest';
import { useEditorStore } from '../editor-store';
import { getCellText } from '../../types/tabml';

describe('editor store workspace file opening', () => {
  it('reuses an already-open file path instead of creating duplicate tabs', () => {
    const store = useEditorStore.getState();
    const suffix = `workspace-${Date.now()}`;
    const firstPath = `F:/repo/${suffix}/first.prd`;
    const secondPath = `F:/repo/${suffix}/second.prd`;

    store.openFileOrReplace(firstPath, 'First');
    useEditorStore.getState().openFileOrReplace(secondPath, 'Second');
    useEditorStore.getState().openFileOrReplace(firstPath, 'Changed');

    const state = useEditorStore.getState();
    const matching = state.tabs.filter((tab) => tab.filePath === firstPath);
    const active = state.tabs.find((tab) => tab.id === state.activeTabId)!;

    expect(matching).toHaveLength(1);
    expect(active.filePath).toBe(firstPath);
    expect(getCellText(active.document.rows[0].cells[0])).toBe('First');
  });
});
