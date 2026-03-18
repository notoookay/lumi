import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (): Promise<{ filePath: string; fileName: string; buffer: string } | null> =>
    ipcRenderer.invoke('open-file'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version')
})
