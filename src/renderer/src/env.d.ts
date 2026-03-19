/// <reference types="vite/client" />

interface ElectronFileResult {
  filePath: string
  fileName: string
  buffer: string
}

interface Window {
  electronAPI: {
    openFile: () => Promise<ElectronFileResult | null>
    openFileByPath: (filePath: string) => Promise<ElectronFileResult | null>
    getAppVersion: () => Promise<string>
  }
}
