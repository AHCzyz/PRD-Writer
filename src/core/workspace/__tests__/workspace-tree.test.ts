import { describe, expect, it } from 'vitest';
import { createWorkspaceTreeFromEntries, createWorkspaceTreeFromPaths } from '../workspace-tree';

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
      { kind: 'file', name: 'z-note.txt', path: 'F:/repo/z-note.txt' },
    ]);
  });

  it('keeps scanned directories even when they do not contain supported documents', () => {
    const tree = createWorkspaceTreeFromEntries('F:\\repo', [
      { kind: 'directory', path: 'F:\\repo\\docs' },
      { kind: 'directory', path: 'F:\\repo\\empty' },
      { kind: 'directory', path: 'F:\\repo\\node_modules' },
      { kind: 'file', path: 'F:\\repo\\docs\\brief.prd' },
      { kind: 'file', path: 'F:\\repo\\empty\\image.png' },
    ]);

    expect(tree).toEqual([
      {
        kind: 'directory',
        name: 'docs',
        path: 'F:/repo/docs',
        children: [{ kind: 'file', name: 'brief.prd', path: 'F:/repo/docs/brief.prd' }],
      },
      {
        kind: 'directory',
        name: 'empty',
        path: 'F:/repo/empty',
        children: [],
      },
    ]);
  });
});
