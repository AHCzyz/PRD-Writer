/**
 * 文件 I/O 处理
 * 支持 File System Access API 打开/保存 .tab.md 文件
 */

const FILE_TYPES = [
  {
    description: 'Tab-ML 文档',
    accept: { 'text/plain': ['.tab.md', '.prd'] },
  },
];

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

/**
 * 保存文件
 */
export async function saveFile(
  content: string,
  suggestedName: string = 'untitled.tab.md'
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
    input.accept = '.tab.md,.prd,.txt';
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
