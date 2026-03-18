export interface ElectronAPI {
  openFile: () => Promise<{ filePath: string; fileName: string; buffer: string } | null>
  getAppVersion: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
