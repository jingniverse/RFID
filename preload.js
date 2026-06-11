const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadRecipients: () => ipcRenderer.invoke('load-recipients'),
  saveRecipients: (recipients) => ipcRenderer.invoke('save-recipients', recipients),
  closeApp: () => ipcRenderer.send('close-app')
});
