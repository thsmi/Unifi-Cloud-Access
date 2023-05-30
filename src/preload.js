const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  node: () => { return process.versions.node; },
  chrome: () => { return process.versions.chrome; },
  electron: () => { return process.versions.electron; },
  print: (data) => { return ipcRenderer.invoke('print', data); },
  save: (data) => { return ipcRenderer.invoke("save", data); }
});
