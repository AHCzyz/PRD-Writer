import { describe, expect, it } from 'vitest';
import { createWorkspaceTreeFromPaths } from '../workspace-tree';

describe('workspace tree', () => {
  it('builds a recursive document tree from workspace paths', () => {
    const tree = createWorkspaceTreeFromPaths('F:\\repo', [
      'F:\\repo\\z-note.txt',
      'F:\\repo\\a.prd',
      'F:\\repo\\b\\two.prd',
      'F:\\repo\\b\\one.md',
      'F:\\repo\\b\\image.png',
      'F:\\repo\\.git\\ignored.prd',
    ]);

    expect(tree).toEqual([
      {
        kind: 'directory',
        name: 'b',
        path: 'F:/repo/b',
        children: [
          { kind: 'file', name: 'one.md', path: 'F:/repo/b/one.md' },
          { kind: 'file', name: 'two.prd', path: 'F:/repo/b/two.prd' },
        ],
      },
      { kind: 'file', name: 'a.prd', path: 'F:/repo/a.prd' },
    ]);
  });
});
