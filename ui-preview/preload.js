const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = ['zone', 'cmd', 'open-tab', 'maximized', 'debug-hover'];

contextBridge.exposeInMainWorld('lum', {
  win: (action) => ipcRenderer.send('win', action),
  copy: (text) => ipcRenderer.send('copy', String(text)),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  sample: (id, width, fx0, fx1) => ipcRenderer.invoke('sample', id, width, fx0, fx1),
  hook: (id) => ipcRenderer.invoke('hook', id),
  on: (channel, fn) => {
    if (CHANNELS.includes(channel)) ipcRenderer.on(channel, (_e, data) => fn(data));
  }
});
