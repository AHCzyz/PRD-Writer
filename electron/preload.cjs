/**
 * Preload — 安全地向渲染进程暴露 Electron API
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (content, defaultName) => ipcRenderer.invoke('file:save', content, defaultName),
});
