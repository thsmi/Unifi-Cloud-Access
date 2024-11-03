const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  node: () => { return process.versions.node; },
  chrome: () => { return process.versions.chrome; },
  electron: () => { return process.versions.electron; },
  print: (data) => { return ipcRenderer.invoke('print', data); },
  exportAsCsv: (data) => { return ipcRenderer.invoke("exportAsCsv", data); },
  exportAsPdf: (voucher, folder) => { return ipcRenderer.invoke("exportAsPdf", voucher, folder); },
  browseForFolder: () => { return ipcRenderer.invoke("browseForFolder"); },
  clearCookies: () => { return ipcRenderer.invoke("clearCookies"); },
  setCookieCorsOverride: (domains) => { return ipcRenderer.invoke("setCookieCorsOverride", domains); },
  hasEncryption: () => { return ipcRenderer.invoke("hasEncryption"); },
  encryptString: (decrypted) => {
    return ipcRenderer.invoke("encryptString", decrypted);
  },
  decryptString: (encrypted) => {
    return ipcRenderer.invoke("decryptString", encrypted);
  },

  verifyMailCredentials: (host, port, user, password) => {
    return ipcRenderer.invoke("verifyMailCredentials", host, port, user, password);
  },
  sendMail: (host, port, user, password, sender, recipient, body) => {
    return ipcRenderer.invoke("sendMail", host, port, user, password, sender, recipient, body);
  }

});



