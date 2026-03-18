import { useReaderStore } from '../store/useReaderStore'
import PDFReader from './PDFReader'
import EPUBReader from './EPUBReader'

export default function ReaderPanel() {
  const file = useReaderStore((s) => s.file)
  if (!file) return null

  return (
    <div className="flex-1 h-full overflow-hidden" style={{ background: 'var(--bg-panel)' }}>
      {file.type === 'pdf' ? (
        <PDFReader buffer={file.buffer} />
      ) : (
        <EPUBReader buffer={file.buffer} />
      )}
    </div>
  )
}
