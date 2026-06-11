/**
 * PRD Writer — Electron 主进程
 * 加载 Vite 构建产物，提供原生窗口体验
 * 支持单实例锁、命令行参数打开文件、文件关联
 */
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let closeConfirmed = false;
let closeRequestPending = false;
let closeRequestId = 0;
const closeResponses = new Map();
const DOCUMENT_EXTENSIONS = ['.prd', '.tab.md', '.md'];
const IGNORED_WORKSPACE_DIRS = new Set(['.git', 'node_modules', 'dist', 'release']);

/**
 * 从 argv 中提取文件路径（.tab.md / .md / .prd）
 */
function extractFilePath(argv) {
  for (let i = argv.length - 1; i >= 1; i--) {
    const arg = argv[i];
    if (
      typeof arg === 'string' &&
      (arg.endsWith('.tab.md') || arg.endsWith('.md') || arg.endsWith('.prd'))
    ) {
      return path.resolve(arg);
    }
  }
  return null;
}

/**
 * 向渲染进程发送文件打开事件
 */
function sendFileToRenderer(filePath) {
  if (!mainWindow || !filePath) return;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    mainWindow.webContents.send('file:open-from-os', { path: filePath, content });
  } catch (err) {
    console.error('Failed to read file:', filePath, err);
  }
}

function createWindow() {
  closeConfirmed = false;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'PRD Writer',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  // 加载 Vite 构建产物
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(indexPath);

  // 窗口准备好后再显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (closeConfirmed || !mainWindow || mainWindow.webContents.isDestroyed()) return;

    event.preventDefault();
    if (closeRequestPending) return;
    closeRequestPending = true;

    const win = mainWindow;
    const requestId = ++closeRequestId;
    closeResponses.set(requestId, (shouldClose) => {
      closeResponses.delete(requestId);
      closeRequestPending = false;
      if (shouldClose && win && !win.isDestroyed()) {
        closeConfirmed = true;
        win.close();
      }
    });

    win.webContents.send('app:request-close', requestId);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    closeConfirmed = false;
    closeRequestPending = false;
    closeResponses.clear();
  });
}

function isWorkspaceDocument(filePath) {
  const lower = filePath.toLowerCase();
  return DOCUMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function collectWorkspaceFiles(rootPath) {
  const result = [];
  const stack = [rootPath];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      console.error('Failed to read workspace directory:', current, err);
      continue;
    }

    for (const entry of entries) {
      const childPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_WORKSPACE_DIRS.has(entry.name)) {
          stack.push(childPath);
        }
      } else if (entry.isFile() && isWorkspaceDocument(childPath)) {
        result.push(childPath);
      }
    }
  }

  return result;
}

// === 单实例锁 ===
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // 第二个实例启动时（Windows 双击已关联的文件）
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const filePath = extractFilePath(commandLine);
      if (filePath) {
        sendFileToRenderer(filePath);
      }
    }
  });

  app.whenReady().then(() => {
    createWindow();

    // 首次启动：检查 process.argv 中是否有文件路径
    const filePath = extractFilePath(process.argv);
    if (filePath) {
      mainWindow.webContents.once('did-finish-load', () => {
        sendFileToRenderer(filePath);
      });
    }
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// macOS 兼容：open-file 事件
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    sendFileToRenderer(filePath);
  }
});

// 文件操作 IPC（供 preload 暴露给渲染进程）
ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'PRD 文档', extensions: ['prd'] },
      { name: 'Tab-ML 文档', extensions: ['tab.md'] },
      { name: 'Markdown', extensions: ['md'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const content = fs.readFileSync(result.filePaths[0], 'utf-8');
  return { path: result.filePaths[0], content };
});

ipcMain.handle('workspace:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择工作区',
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const rootPath = result.filePaths[0];
  return {
    rootPath,
    files: collectWorkspaceFiles(rootPath),
  };
});

ipcMain.handle('workspace:read-file', async (_event, filePath) => {
  return fs.readFileSync(filePath, 'utf-8');
});

ipcMain.handle('file:save', async (_event, content, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'document.prd',
    filters: [
      { name: 'PRD 文档', extensions: ['prd'] },
      { name: 'Tab-ML 文档', extensions: ['tab.md'] },
      { name: 'Markdown', extensions: ['md'] },
    ],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return result.filePath;
});

// 直接保存到指定路径（已有文件覆盖保存）
ipcMain.handle('file:save-to-path', async (_event, content, filePath) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save file:', filePath, err);
    return false;
  }
});

ipcMain.handle('app:confirm-unsaved-close', async (_event, dirtyCount) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['保存并关闭', '不保存', '取消'],
    defaultId: 0,
    cancelId: 2,
    title: '未保存的修改',
    message: dirtyCount > 1 ? `有 ${dirtyCount} 个文档尚未保存。` : '当前文档尚未保存。',
    detail: '请选择保存修改、直接关闭或取消关闭。',
    noLink: true,
  });

  if (result.response === 0) return 'save';
  if (result.response === 1) return 'discard';
  return 'cancel';
});

ipcMain.on('app:close-response', (_event, { requestId, shouldClose }) => {
  const resolve = closeResponses.get(requestId);
  if (resolve) {
    resolve(Boolean(shouldClose));
  }
});
