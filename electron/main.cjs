const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database.cjs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
    });

    // Depending on whether we run in prod or dev
    const startUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(__dirname, '../dist/index.html')}`;

    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(startUrl);
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC listeners for the database interactions
ipcMain.handle('get-items', async () => {
    return await db.getItems();
});

ipcMain.handle('save-invoice', async (event, invoiceData) => {
    return await db.saveInvoice(invoiceData);
});

// Sync data handling
ipcMain.handle('sync-data', async (event, syncPayload) => {
    return await db.syncLocalDatabase(syncPayload);
});
