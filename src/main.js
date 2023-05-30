// Modules to control application life and create native browser window
const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');

const path = require('path');
const fs = require('fs').promises;

const COPIES = 1;
const PAGES_PER_SHEET = 1;

const print = async(data) => {

  const win = new BrowserWindow({ show: false });

  win.loadFile(`${__dirname}/print.html`, {
    query: {"vouchers": JSON.stringify(data)}
  });

  const printOptions = {
    // silent: true,
    silent:false,
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

const save = async (data) => {
  const filename = dialog.showSaveDialogSync(BrowserWindow.getFocusedWindow(), {
    title: 'Export Vouchers…',
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!filename)
    return;

  await fs.writeFile(filename, data);
};


const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    // width: 800,
    // height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // mainWindow.removeMenu();
  mainWindow.webContents.openDevTools();

  ipcMain.handle('print', async (event, args) => { return await print(args); } );
  ipcMain.handle('save', async (event, args) => { return await save(args); } );

  // and load the index.html of the app.
  mainWindow.loadFile('./src/index.html');

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://sso.ui.com/api/sso/v1/*', "https://config.ubnt.com/*"] },
    (details, callback) => {

      if (
        details.responseHeaders &&
        details.responseHeaders['set-cookie'] &&
        details.responseHeaders['set-cookie'].length &&
        !details.responseHeaders['set-cookie'][0].includes('SameSite=none')
      ) {
        details.responseHeaders['set-cookie'][0] = details.responseHeaders['set-cookie'][0] + '; SameSite=none';
      }
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
