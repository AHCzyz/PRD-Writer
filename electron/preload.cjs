/**
 * Preload — 安全地向渲染进程暴露 Electron API
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (content, defaultName) => ipcRenderer.invoke('file:save', content, defaultName),
  saveFileToPath: (content, filePath) => ipcRenderer.invoke('file:save-to-path', content, filePath),
  confirmUnsavedClose: (dirtyCount) => ipcRenderer.invoke('app:confirm-unsaved-close', dirtyCount),
  onCloseRequest: (callback) => {
    const listener = async (_event, requestId) => {
      const shouldClose = await callback();
      ipcRenderer.send('app:close-response', { requestId, shouldClose });
    };
    ipcRenderer.on('app:request-close', listener);
    return () => ipcRenderer.removeListener('app:request-close', listener);
  },
  onOpenFileFromOS: (callback) => {
    ipcRenderer.on('file:open-from-os', (_event, data) => callback(data));
  },
});
