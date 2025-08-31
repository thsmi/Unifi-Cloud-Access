// Modules to control application life and create native browser window
const { app, BrowserWindow, session, ipcMain, dialog, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('fs').promises;

const COPIES = 1;
const PAGES_PER_SHEET = 1;

let cookieCorsOverride = [];

const print = async (data) => {

  const win = new BrowserWindow({ show: false });

  win.loadFile(`${__dirname}/print.html`, {
    query: { "vouchers": JSON.stringify(data) }
  });

  const printOptions = {
    // silent: true,
    silent: false,
    printBackground: true,
    color: true,
    margin: {
      marginType: 'printableArea'
    },
    landscape: false,
    pagesPerSheet: PAGES_PER_SHEET,
    collate: false,
    copies: COPIES,
    header: '',
    footer: ''
  };

  win.webContents.on('did-finish-load', () => {
    win.webContents.print(printOptions, (success, failureReason) => {
      if (!success)
        console.log(failureReason);

      win.destroy();
    });
  });
};

const exportAsCsv = async (data) => {
  const filename = dialog.showSaveDialogSync(BrowserWindow.getFocusedWindow(), {
    title: 'Export Vouchers as CSV…',
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!filename)
    return;

  await fs.writeFile(filename, data);
};

const browseForFolder = async() => {
  const folder = dialog.showOpenDialogSync(BrowserWindow.getFocusedWindow(), {
    title: "Export Vouchers as PDF…",
    properties: ['openDirectory']
  });

  if (!folder)
    return null;

  return folder[0];
};

const exportAsPdf = async (voucher, folder) => {

  const options = {
    printBackground: true,
    color: true,
    margin: {
      marginType: 'printableArea'
    },
    landscape: false,
    pagesPerSheet: PAGES_PER_SHEET,
    pageSize: "A4",
    collate: false,
    copies: COPIES,
    header: '',
    footer: ''
  };

  const win = new BrowserWindow({ show: false });
  try {

    const data = await new Promise((resolve) => {
      win.loadFile(`${__dirname}/print.html`, {
        query: { "vouchers": JSON.stringify([voucher]) }
      });

      win.webContents.on('did-finish-load', async () => {
        resolve(await win.webContents.printToPDF(options));
      });
    });

    if ((typeof(folder) === "undefined") || (folder === null)) {
      return new Uint8Array(data);
    }

    await fs.writeFile(
      path.join(folder, `${voucher.id}.pdf`), data);

  } finally {
    win.destroy();
  }

  return undefined;
};

const clearCookies = async() => {
  session.defaultSession.clearStorageData({ storages : ["cookies"]});
};

const hasCookie = async(name) => {
  const cookies = await session.defaultSession.cookies.get({"name":name});

  if (cookies.length)
    return true;

  return false;
};

const setCookieCorsOverride = async (domains) => {
  cookieCorsOverride = domains;
};

const hasEncryption = async () => {
  return safeStorage.isEncryptionAvailable();
};

const encryptString = async (decrypted) => {
  if (decrypted === null)
    return null;

  return safeStorage.encryptString(decrypted).toString('hex');
};

const decryptString = async (encrypted) => {
  if (encrypted === null)
    return null;

  return safeStorage.decryptString(Buffer.from(encrypted, "hex"));
};

const verifyMailCredentials = async (host, port, user, password) => {

  let result = null;

  const { SmtpConnection } = await import("./lib/smtp/smtp.connection.mjs");

  const connection = new SmtpConnection(host, port);

  try {
    await connection.connect(user, password);
  } catch (ex) {
    console.log(ex.message);
    result = ex.message;
  } finally {
    connection.close();
  }

  return result;
};

const sendMail = async(host, port, user, password, sender, recipient, body) => {

  let result = null;

  const { SmtpConnection } = await import("./lib/smtp/smtp.connection.mjs");

  const connection = new SmtpConnection(host, port);
  try {
    await connection.connect(user, password);
    await connection.send(body, sender, recipient);
  } catch (error) {
    console.error('Error while sending mail:', error.message);
    result = error.message;
  } finally {
    connection.close();
  }

  return result;

};

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    // width: 800,
    // height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
    ignoreCertificateErrors: true
  });

  // mainWindow.removeMenu();
  mainWindow.webContents.openDevTools();

  /*const newWindow = new BrowserWindow({
  });
  newWindow.webContents.openDevTools();

  newWindow.loadURL('https://unifi.ui.com/consoles/74ACB913DBB700000000049439040000000004C7D2D5000000005E86EF66:464118488/network/default/insights/hotspot/vouchers');*/

  /*const webrtcWindow = new BrowserWindow({
  });
  webrtcWindow.loadURL('chrome://webrtc-internals');*/

 /*const debugWindow = new BrowserWindow({
    show: true,
    //webSecurity: false,
    //url: 'chrome://webrtc-internals'
    url: "https://www.gogole.com"
  })*/

  ipcMain.handle('print', async (event, vouchers) => { return await print(vouchers); });
  ipcMain.handle('exportAsCsv', async (event, vouchers) => { return await exportAsCsv(vouchers); });
  ipcMain.handle('exportAsPdf', async (event, voucher, folder) => { return await exportAsPdf(voucher, folder); });
  ipcMain.handle('browseForFolder', async () => { return await browseForFolder(); });

  ipcMain.handle("setCookieCorsOverride", async (event, domains) => { return await setCookieCorsOverride(domains); });
  ipcMain.handle("clearCookies", async () => { return await clearCookies(); });
  ipcMain.handle("hasCookie", async(name) => { return await hasCookie(name);});

  // Encryption related callbacks
  ipcMain.handle("hasEncryption", async () => {
    return await hasEncryption();
  });
  ipcMain.handle("encryptString", async (event, plainText) => {
    return await encryptString(plainText);
  });
  ipcMain.handle("decryptString", async (event, encryptedText) => {
    return await decryptString(encryptedText);
  });

  // Fail related callback...
  ipcMain.handle("verifyMailCredentials", async (event, host, port, user, password) => {
    return await verifyMailCredentials(host, port, user, password);
  });
  ipcMain.handle("sendMail", async (event, host, port, user, password, sender, recipient, body) => {
    return await sendMail(host, port, user, password, sender, recipient, body);
  });


  // and load the index.html of the app.
  mainWindow.loadFile('./src/index.html');

  session.defaultSession.webRequest.onHeadersReceived(
    // { urls: ['https://sso.ui.com/api/sso/v1/*', "https://config.ubnt.com/*"] },
    (details, callback) => {

      for (const domain of cookieCorsOverride) {
        if (!details.url.startsWith(domain))
          continue;

        for (const header in details.responseHeaders) {
          if (header.toLocaleLowerCase() !== "set-cookie")
            continue;

          for (const idx in details.responseHeaders[header]) {
            const value = details.responseHeaders[header][idx];
            if (value.includes('SameSite=none'))
              continue;

            details.responseHeaders[header][idx] = value + '; SameSite=none; Secure';
            console.log("    Cookie " + details.responseHeaders[header][idx]);
          }
        }
      }

      /* if (
        details.responseHeaders &&
        details.responseHeaders['set-cookie'] &&
        details.responseHeaders['set-cookie'].length &&
        !details.responseHeaders['set-cookie'][0].includes('SameSite=none')
      ) {
        details.responseHeaders['set-cookie'][0] = details.responseHeaders['set-cookie'][0] + '; SameSite=none; Secure';
      }*/
      callback({ cancel: false, responseHeaders: details.responseHeaders });
    }
  );
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin')
    app.quit();
});

process.on('exit', () => {
  app.quit();
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // Prevent having error
  event.preventDefault();
  // and continue
  callback(true);
});
