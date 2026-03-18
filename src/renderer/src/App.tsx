import { useCallback, useEffect } from 'react'
import { useReaderStore } from './store/useReaderStore'
import FileDropzone, { base64ToArrayBuffer } from './components/FileDropzone'
import TitleBar from './components/TitleBar'
import ReaderPanel from './components/ReaderPanel'
import AssistantSidebar from './components/AssistantSidebar'
import OutlineSidebar from './components/OutlineSidebar'
import SelectionToolbar from './components/SelectionToolbar'

export default function App() {
  const { file, setFile, theme, outlineOpen } = useReaderStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const openFile = useCallback(async () => {
    const result = await window.electronAPI.openFile()
    if (!result) return
    const ext = result.fileName.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'epub') return
    const buffer = base64ToArrayBuffer(result.buffer)
    setFile({ name: result.fileName, type: ext as 'pdf' | 'epub', buffer })
  }, [setFile])

  if (!file) {
    return (
      <div className="w-full h-screen" style={{ background: 'var(--bg-base)' }}>
        <TitleBar onOpenFile={openFile} />
        <div style={{ height: 'calc(100vh - 44px)', marginTop: 44 }}>
          <FileDropzone onOpenFile={openFile} />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <TitleBar onOpenFile={openFile} />
      <div className="flex flex-1 overflow-hidden" style={{ marginTop: 44 }}>
        {/* Outline sidebar */}
        {outlineOpen && (
          <div className="shrink-0 overflow-hidden" style={{ width: 220, height: '100%' }}>
            <OutlineSidebar />
          </div>
        )}
        {/* Reader */}
        <div className="flex-1 overflow-hidden" style={{ height: '100%' }}>
          <ReaderPanel />
        </div>
        {/* AI sidebar */}
        <div className="shrink-0" style={{ width: 300, height: '100%' }}>
          <AssistantSidebar />
        </div>
      </div>
      <SelectionToolbar />
    </div>
  )
}
