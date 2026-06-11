export interface WorkspaceFileNode {
  kind: 'file';
  name: string;
  path: string;
}

export interface WorkspaceDirectoryNode {
  kind: 'directory';
  name: string;
  path: string;
  children: WorkspaceNode[];
}

export type WorkspaceNode = WorkspaceFileNode | WorkspaceDirectoryNode;

export interface WorkspaceDescriptor {
  name: string;
  path: string;
  nodes: WorkspaceNode[];
}

export interface WorkspaceEntry {
  kind: 'file' | 'directory';
  path: string;
}

const DOCUMENT_EXTENSIONS = ['.prd', '.tab.md', '.md'];
const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'release']);

interface MutableDirectory {
  kind: 'directory';
  name: string;
  path: string;
  children: Map<string, MutableDirectory | WorkspaceFileNode>;
}

export function isWorkspaceDocumentPath(path: string): boolean {
  const normalized = path.toLowerCase();
  return DOCUMENT_EXTENSIONS.some((ext) => normalized.endsWith(ext));
}

export function createWorkspaceTreeFromPaths(rootPath: string, filePaths: string[]): WorkspaceNode[] {
  return createWorkspaceTreeFromEntries(
    rootPath,
    filePaths.map((path) => ({ kind: 'file', path }))
  );
}

export function createWorkspaceTreeFromEntries(rootPath: string, entries: WorkspaceEntry[]): WorkspaceNode[] {
  const root = normalizePath(rootPath).replace(/\/+$/, '');
  const rootDir: MutableDirectory = {
    kind: 'directory',
    name: root.split('/').pop() || root,
    path: root,
    children: new Map(),
  };

  for (const entry of entries) {
    const entryPath = normalizePath(entry.path);
    if (entry.kind === 'file' && !isWorkspaceDocumentPath(entryPath)) continue;
    if (!isInsideRoot(root, entryPath)) continue;

    const relative = entryPath.slice(root.length).replace(/^\/+/, '');
    if (!relative) continue;
    const parts = relative.split('/').filter(Boolean);
    if (parts.some((part) => IGNORED_DIRECTORIES.has(part))) continue;

    let dir = rootDir;
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      const childPath = `${dir.path}/${part}`;
      const isLeaf = index === parts.length - 1;
      const isFile = isLeaf && entry.kind === 'file';
      if (isFile) {
        dir.children.set(part, {
          kind: 'file',
          name: part,
          path: childPath,
        });
        continue;
      }

      const existing = dir.children.get(part);
      if (existing?.kind === 'directory') {
        dir = existing;
        continue;
      }

      const nextDir: MutableDirectory = {
        kind: 'directory',
        name: part,
        path: childPath,
        children: new Map(),
      };
      dir.children.set(part, nextDir);
      dir = nextDir;
    }
  }

  return finalizeChildren(rootDir.children);
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function isInsideRoot(root: string, filePath: string): boolean {
  return filePath === root || filePath.startsWith(`${root}/`);
}

function finalizeChildren(children: Map<string, MutableDirectory | WorkspaceFileNode>): WorkspaceNode[] {
  return Array.from(children.values())
    .map((node) => {
      if (node.kind === 'file') return node;
      const directory: WorkspaceDirectoryNode = {
        kind: 'directory',
        name: node.name,
        path: node.path,
        children: finalizeChildren(node.children),
      };
      return directory;
    })
    .sort(compareNodes);
}

function compareNodes(a: WorkspaceNode, b: WorkspaceNode): number {
  if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}
