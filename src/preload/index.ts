import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (): Promise<{ filePath: string; fileName: string; buffer: string } | null> =>
    ipcRenderer.invoke('open-file'),
  openFileByPath: (
    filePath: string
  ): Promise<{ filePath: string; fileName: string; buffer: string } | null> =>
    ipcRenderer.invoke('open-file-by-path', filePath),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),

  // RAG index persistence
  ragSave: (bookHash: string, data: string): Promise<void> =>
    ipcRenderer.invoke('rag-save', bookHash, data),
  ragLoad: (bookHash: string): Promise<string | null> =>
    ipcRenderer.invoke('rag-load', bookHash)
})
