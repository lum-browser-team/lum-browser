const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = ['zone', 'cmd', 'open-tab', 'maximized', 'debug-hover'];

contextBridge.exposeInMainWorld('lum', {
  win: (action) => ipcRenderer.send('win', action),
  copy: (text) => ipcRenderer.send('copy', String(text)),
  qr: (text) => ipcRenderer.invoke('qr', String(text)),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  sample: (id, width, opts) => ipcRenderer.invoke('sample', id, width, opts),
  hook: (id) => ipcRenderer.invoke('hook', id),
  on: (channel, fn) => {
    if (CHANNELS.includes(channel)) ipcRenderer.on(channel, (_e, data) => fn(data));
  }
});
