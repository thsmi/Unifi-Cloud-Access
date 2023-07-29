const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  node: () => { return process.versions.node; },
  chrome: () => { return process.versions.chrome; },
  electron: () => { return process.versions.electron; },
  print: (data) => { return ipcRenderer.invoke('print', data); },
  exportAsCsv: (data) => { return ipcRenderer.invoke("exportAsCsv", data); },
  exportAsPdf : (folder, voucher) => { return ipcRenderer.invoke("exportAsPdf", folder, voucher); },
  browseForFolder : () => { return ipcRenderer.invoke("browseForFolder");}
});
