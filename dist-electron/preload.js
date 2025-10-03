import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  // Storage operations
  storeGet: (key) => ipcRenderer.invoke("store-get", key),
  storeSet: (key, value) => ipcRenderer.invoke("store-set", key, value),
  storeDelete: (key) => ipcRenderer.invoke("store-delete", key),
  // Listen for store updates from other windows
  onStoreUpdated: (callback) => {
    ipcRenderer.on("store-updated", (event, key, value) => callback(key, value));
  },
  // Quick entry controls
  quickEntrySubmitted: () => ipcRenderer.send("quick-entry-submitted"),
  hideQuickEntry: () => ipcRenderer.send("hide-quick-entry"),
  // Listen for focus request
  onFocusInput: (callback) => {
    ipcRenderer.on("focus-input", callback);
  }
});
//# sourceMappingURL=preload.js.map
