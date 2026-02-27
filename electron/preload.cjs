const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Database access
    getItems: () => ipcRenderer.invoke('get-items'),
    saveInvoice: (invoiceData) => ipcRenderer.invoke('save-invoice', invoiceData),
    syncData: (syncPayload) => ipcRenderer.invoke('sync-data', syncPayload)
});
