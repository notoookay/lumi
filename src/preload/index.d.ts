export interface ElectronAPI {
  openFile: () => Promise<{ filePath: string; fileName: string; buffer: string } | null>
  openFileByPath: (filePath: string) => Promise<{ filePath: string; fileName: string; buffer: string } | null>
  getAppVersion: () => Promise<string>
  ragSave: (bookHash: string, data: string) => Promise<void>
  ragLoad: (bookHash: string) => Promise<string | null>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
