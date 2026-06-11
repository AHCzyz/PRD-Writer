/**
 * 文件 I/O 处理
 * 支持 File System Access API 打开/保存 .tab.md 文件
 */
import {
  createWorkspaceTreeFromEntries,
  isWorkspaceDocumentPath,
  normalizePath,
  type WorkspaceEntry,
  type WorkspaceDescriptor,
} from '../workspace/workspace-tree';

const FILE_TYPES = [
  {
    description: 'PRD 文档',
    accept: { 'text/plain': ['.prd'] },
  },
  {
    description: 'Tab-ML 文档',
    accept: { 'text/plain': ['.tab.md'] },
  },
  {
    description: 'Markdown',
    accept: { 'text/markdown': ['.md'] },
  },
];

const EXCEL_FILE_TYPES = [
  {
    description: 'Excel 工作簿',
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12': ['.xlsb'],
      'text/csv': ['.csv'],
    },
  },
];

const EXCEL_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.csv'];

const browserWorkspaceFileHandles = new Map<string, any>();

interface WorkspaceOpenOptions {
  onRootSelected?: (workspace: WorkspaceDescriptor) => void;
  onProgress?: (scannedCount: number) => void;
}

export interface ExcelImportFile {
  name: string;
  data: ArrayBuffer;
  path?: string;
}

export function isExcelImportPath(path: string): boolean {
  const normalized = path.toLowerCase();
  return EXCEL_IMPORT_EXTENSIONS.some((ext) => normalized.endsWith(ext));
}

/**
 * 打开文件对话框，读取 .tab.md 文件内容
 */
export async function openFile(): Promise<{ name: string; content: string } | null> {
  try {
    // 尝试使用 File System Access API
    if ('showOpenFilePicker' in window) {
      const [handle] = await (window as any).showOpenFilePicker({
        types: FILE_TYPES,
        multiple: false,
      });
      const file = await handle.getFile();
      const content = await file.text();
      return { name: file.name, content };
    }

    // 降级到传统 input 方式
    return await openFileFallback();
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export async function openExcelFile(): Promise<{ name: string; data: ArrayBuffer } | null> {
  try {
    if ('showOpenFilePicker' in window) {
      const [handle] = await (window as any).showOpenFilePicker({
        types: EXCEL_FILE_TYPES,
        multiple: false,
      });
      const file = await handle.getFile();
      const data = await file.arrayBuffer();
      return { name: file.name, data };
    }

    return await openExcelFileFallback();
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export async function openExcelFolder(): Promise<ExcelImportFile[] | null> {
  const api = (window as any).electronAPI;
  if (api?.openExcelFolder) {
    const files = await api.openExcelFolder();
    if (!files) return null;
    return files.map((file: { name: string; path?: string; data: unknown }) => ({
      name: file.name,
      path: file.path,
      data: toArrayBuffer(file.data),
    }));
  }

  if (supportsDirectoryFileInput()) {
    return await openExcelFolderDirectoryInput();
  }

  if (!('showDirectoryPicker' in window)) {
    window.alert('当前环境不支持选择 Excel 导入目录');
    return null;
  }

  try {
    const rootHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
    const files: ExcelImportFile[] = [];
    await collectBrowserExcelFiles(rootHandle, '', files);
    return files;
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export async function openWorkspace(options: WorkspaceOpenOptions = {}): Promise<WorkspaceDescriptor | null> {
  const api = (window as any).electronAPI;
  if (api?.openWorkspace) {
    const result = await api.openWorkspace();
    if (!result) return null;
    const rootPath = normalizePath(result.rootPath);
    const entries = Array.isArray(result.entries)
      ? result.entries
      : (result.files || []).map((path: string) => ({ kind: 'file', path }));
    options.onRootSelected?.({
      name: rootPath.split('/').pop() || rootPath,
      path: rootPath,
      nodes: [],
    });
    return {
      name: rootPath.split('/').pop() || rootPath,
      path: rootPath,
      nodes: createWorkspaceTreeFromEntries(rootPath, entries),
    };
  }

  if (supportsDirectoryFileInput()) {
    return await openWorkspaceDirectoryInput(options);
  }

  if (!('showDirectoryPicker' in window)) {
    window.alert('当前环境不支持选择工作区目录');
    return null;
  }

  try {
    const rootHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
    const rootPath = normalizePath(rootHandle.name || 'workspace');
    options.onRootSelected?.({
      name: rootHandle.name || 'workspace',
      path: rootPath,
      nodes: [],
    });
    await waitForPaint();

    const entries: WorkspaceEntry[] = [];
    browserWorkspaceFileHandles.clear();
    await collectBrowserWorkspaceEntries(rootHandle, rootPath, entries, options.onProgress);
    return {
      name: rootHandle.name || 'workspace',
      path: rootPath,
      nodes: createWorkspaceTreeFromEntries(rootPath, entries),
    };
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export async function readWorkspaceFile(filePath: string): Promise<string> {
  const api = (window as any).electronAPI;
  if (api?.readWorkspaceFile) {
    return await api.readWorkspaceFile(filePath);
  }

  const handle = browserWorkspaceFileHandles.get(normalizePath(filePath));
  if (!handle) {
    throw new Error(`Workspace file handle not found: ${filePath}`);
  }
  const file = typeof handle.getFile === 'function' ? await handle.getFile() : handle;
  return await file.text();
}

export async function readWorkspaceFileData(filePath: string): Promise<ArrayBuffer> {
  const api = (window as any).electronAPI;
  if (api?.readWorkspaceFileData) {
    return toArrayBuffer(await api.readWorkspaceFileData(filePath));
  }

  const handle = browserWorkspaceFileHandles.get(normalizePath(filePath));
  if (!handle) {
    throw new Error(`Workspace file handle not found: ${filePath}`);
  }
  const file = typeof handle.getFile === 'function' ? await handle.getFile() : handle;
  return await file.arrayBuffer();
}

export async function saveWorkspaceFile(filePath: string, content: string): Promise<boolean> {
  const handle = browserWorkspaceFileHandles.get(normalizePath(filePath));
  if (!handle?.createWritable) return false;

  if (typeof handle.queryPermission === 'function' && typeof handle.requestPermission === 'function') {
    const descriptor = { mode: 'readwrite' };
    const current = await handle.queryPermission(descriptor);
    if (current !== 'granted') {
      const requested = await handle.requestPermission(descriptor);
      if (requested !== 'granted') return false;
    }
  }

  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  return true;
}

function openWorkspaceDirectoryInput(options: WorkspaceOpenOptions): Promise<WorkspaceDescriptor | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    (input as any).webkitdirectory = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) {
        resolve(null);
        return;
      }

      const rootName = getDirectoryInputRootName(files);
      const rootPath = normalizePath(rootName);
      const entries: WorkspaceEntry[] = [];
      const seenDirectories = new Set<string>();

      browserWorkspaceFileHandles.clear();
      options.onRootSelected?.({ name: rootName, path: rootPath, nodes: [] });
      await waitForPaint();

      for (const file of files) {
        const relativePath = normalizePath((file as any).webkitRelativePath || file.name);
        const normalizedPath = relativePath.includes('/') ? relativePath : `${rootPath}/${relativePath}`;
        const parts = normalizedPath.split('/').filter(Boolean);

        for (let index = 1; index < parts.length - 1; index++) {
          const dirPath = parts.slice(0, index + 1).join('/');
          if (!seenDirectories.has(dirPath)) {
            seenDirectories.add(dirPath);
            entries.push({ kind: 'directory', path: dirPath });
          }
        }

        entries.push({ kind: 'file', path: normalizedPath });
        if (isWorkspaceDocumentPath(normalizedPath)) {
          browserWorkspaceFileHandles.set(normalizedPath, file);
        }

        if (entries.length % 100 === 0) {
          options.onProgress?.(entries.length);
          await waitForPaint();
        }
      }

      resolve({
        name: rootName,
        path: rootPath,
        nodes: createWorkspaceTreeFromEntries(rootPath, entries),
      });
    };
    input.click();
  });
}

function supportsDirectoryFileInput(): boolean {
  const input = document.createElement('input');
  input.type = 'file';
  return 'webkitdirectory' in input;
}

function getDirectoryInputRootName(files: File[]): string {
  const firstRelativePath = normalizePath((files[0] as any)?.webkitRelativePath || '');
  const firstPart = firstRelativePath.split('/').filter(Boolean)[0];
  return firstPart || 'workspace';
}

function toArrayBuffer(value: unknown): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  if (value && typeof value === 'object' && 'data' in value && Array.isArray((value as { data: unknown }).data)) {
    return new Uint8Array((value as { data: number[] }).data).buffer;
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value).buffer;
  }
  throw new Error('Unsupported binary file data');
}

/**
 * 保存文件
 */
export async function saveFile(
  content: string,
  suggestedName: string = 'untitled.prd'
): Promise<boolean> {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        types: FILE_TYPES,
        suggestedName,
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    }

    // 降级：下载文件
    saveFileFallback(content, suggestedName);
    return true;
  } catch (err: any) {
    if (err.name === 'AbortError') return false;
    throw err;
  }
}

/**
 * 降级：传统文件打开
 */
function openFileFallback(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.prd,.tab.md,.md';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const content = await file.text();
      resolve({ name: file.name, content });
    };
    input.click();
  });
}

function openExcelFileFallback(): Promise<{ name: string; data: ArrayBuffer } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.xlsm,.xlsb,.csv';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const data = await file.arrayBuffer();
      resolve({ name: file.name, data });
    };
    input.click();
  });
}

function openExcelFolderDirectoryInput(): Promise<ExcelImportFile[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = EXCEL_IMPORT_EXTENSIONS.join(',');
    (input as any).webkitdirectory = true;
    input.onchange = async () => {
      const selectedFiles = Array.from(input.files || []);
      if (selectedFiles.length === 0) {
        resolve(null);
        return;
      }

      const excelFiles = selectedFiles
        .filter((file) => isExcelImportPath((file as any).webkitRelativePath || file.name))
        .sort((a, b) => {
          const aPath = (a as any).webkitRelativePath || a.name;
          const bPath = (b as any).webkitRelativePath || b.name;
          return aPath.localeCompare(bPath, undefined, { sensitivity: 'base' });
        });
      const imported = await Promise.all(
        excelFiles.map(async (file) => ({
          name: file.name,
          path: (file as any).webkitRelativePath || file.name,
          data: await file.arrayBuffer(),
        }))
      );
      resolve(imported);
    };
    input.click();
  });
}

async function collectBrowserExcelFiles(
  directoryHandle: any,
  relativeDir: string,
  files: ExcelImportFile[]
): Promise<void> {
  const iterator =
    typeof directoryHandle.entries === 'function'
      ? directoryHandle.entries()
      : browserDirectoryEntriesFallback(directoryHandle);

  for await (const [name, handle] of iterator) {
    if (handle.kind === 'directory') {
      if (name === '.git' || name === 'node_modules' || name === 'dist' || name === 'release') {
        continue;
      }
      await collectBrowserExcelFiles(handle, relativeDir ? `${relativeDir}/${name}` : name, files);
      continue;
    }

    if (handle.kind === 'file') {
      const relativePath = relativeDir ? `${relativeDir}/${name}` : name;
      if (!isExcelImportPath(relativePath)) continue;
      const file = await handle.getFile();
      files.push({
        name: file.name,
        path: relativePath,
        data: await file.arrayBuffer(),
      });
    }
  }

  files.sort((a, b) => (a.path || a.name).localeCompare(b.path || b.name, undefined, { sensitivity: 'base' }));
}

async function collectBrowserWorkspaceEntries(
  directoryHandle: any,
  currentPath: string,
  entries: WorkspaceEntry[],
  onProgress?: (scannedCount: number) => void,
  counter = { value: 0 }
): Promise<void> {
  const iterator =
    typeof directoryHandle.entries === 'function'
      ? directoryHandle.entries()
      : browserDirectoryEntriesFallback(directoryHandle);

  for await (const [name, handle] of iterator) {
    const childPath = normalizePath(`${currentPath}/${name}`);
    if (handle.kind === 'directory') {
      if (name === '.git' || name === 'node_modules' || name === 'dist' || name === 'release') {
        continue;
      }
      entries.push({ kind: 'directory', path: childPath });
      await reportWorkspaceScanProgress(counter, onProgress);
      await collectBrowserWorkspaceEntries(handle, childPath, entries, onProgress, counter);
      continue;
    }

    if (handle.kind === 'file') {
      entries.push({ kind: 'file', path: childPath });
      if (isWorkspaceDocumentPath(childPath)) {
        browserWorkspaceFileHandles.set(childPath, handle);
      }
      await reportWorkspaceScanProgress(counter, onProgress);
    }
  }
}

async function* browserDirectoryEntriesFallback(directoryHandle: any): AsyncGenerator<[string, any]> {
  if (typeof directoryHandle.values !== 'function') {
    throw new Error('当前浏览器不支持读取目录内容');
  }
  for await (const handle of directoryHandle.values()) {
    yield [handle.name, handle];
  }
}

async function reportWorkspaceScanProgress(
  counter: { value: number },
  onProgress?: (scannedCount: number) => void
) {
  counter.value++;
  if (counter.value % 25 !== 0) return;
  onProgress?.(counter.value);
  await waitForPaint();
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

/**
 * 降级：下载文件
 */
function saveFileFallback(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
