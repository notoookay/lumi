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
    ragSave: (bookHash: string, data: string) => Promise<void>
    ragLoad: (bookHash: string) => Promise<string | null>
  }
}
