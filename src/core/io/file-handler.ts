/**
 * 文件 I/O 处理
 * 支持 File System Access API 打开/保存 .tab.md 文件
 */
import {
  createWorkspaceTreeFromPaths,
  isWorkspaceDocumentPath,
  normalizePath,
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

const browserWorkspaceFileHandles = new Map<string, any>();

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

export async function openWorkspace(): Promise<WorkspaceDescriptor | null> {
  const api = (window as any).electronAPI;
  if (api?.openWorkspace) {
    const result = await api.openWorkspace();
    if (!result) return null;
    const rootPath = normalizePath(result.rootPath);
    return {
      name: rootPath.split('/').pop() || rootPath,
      path: rootPath,
      nodes: createWorkspaceTreeFromPaths(rootPath, result.files || []),
    };
  }

  if (!('showDirectoryPicker' in window)) {
    window.alert('当前环境不支持选择工作区目录');
    return null;
  }

  try {
    const rootHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    const rootPath = normalizePath(rootHandle.name || 'workspace');
    const files: string[] = [];
    browserWorkspaceFileHandles.clear();
    await collectBrowserWorkspaceFiles(rootHandle, rootPath, files);
    return {
      name: rootHandle.name || 'workspace',
      path: rootPath,
      nodes: createWorkspaceTreeFromPaths(rootPath, files),
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
  const file = await handle.getFile();
  return await file.text();
}

export async function saveWorkspaceFile(filePath: string, content: string): Promise<boolean> {
  const handle = browserWorkspaceFileHandles.get(normalizePath(filePath));
  if (!handle?.createWritable) return false;

  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  return true;
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
    input.accept = '.prd,.tab.md,.txt';
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

async function collectBrowserWorkspaceFiles(
  directoryHandle: any,
  currentPath: string,
  files: string[]
): Promise<void> {
  for await (const [name, handle] of directoryHandle.entries()) {
    const childPath = normalizePath(`${currentPath}/${name}`);
    if (handle.kind === 'directory') {
      if (name === '.git' || name === 'node_modules' || name === 'dist' || name === 'release') {
        continue;
      }
      await collectBrowserWorkspaceFiles(handle, childPath, files);
      continue;
    }

    if (handle.kind === 'file' && isWorkspaceDocumentPath(childPath)) {
      files.push(childPath);
      browserWorkspaceFileHandles.set(childPath, handle);
    }
  }
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
