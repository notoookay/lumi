import { useCallback } from 'react'
import { useReaderStore } from '../store/useReaderStore'

interface FileDropzoneProps {
  onOpenFile: () => void
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export default function FileDropzone({ onOpenFile }: FileDropzoneProps) {
  const setFile = useReaderStore((s) => s.setFile)

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const droppedFile = e.dataTransfer.files[0]
      if (!droppedFile) return
      const ext = droppedFile.name.split('.').pop()?.toLowerCase()
      if (ext !== 'pdf' && ext !== 'epub') return
      // Electron extends the File object with a `path` property
      const filePath = (droppedFile as File & { path?: string }).path ?? ''
      const reader = new FileReader()
      reader.onload = (ev) => {
        const buffer = ev.target?.result as ArrayBuffer
        setFile({ name: droppedFile.name, path: filePath, type: ext as 'pdf' | 'epub', buffer })
      }
      reader.readAsArrayBuffer(droppedFile)
    },
    [setFile]
  )

  return (
    <div
      className="flex flex-col items-center justify-center w-full h-full select-none"
      style={{ background: 'var(--bg-base)' }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Glow icon */}
      <div className="mb-8 relative">
        <div
          className="w-24 h-24 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.08) 50%, transparent 70%)',
            filter: 'blur(4px)'
          }}
        />
        <svg
          className="absolute inset-0 m-auto w-12 h-12"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="24" cy="24" r="12" fill="#f59e0b" opacity="0.9" />
          <circle cx="24" cy="24" r="6" fill="#fef3c7" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
            <line
              key={i}
              x1="24"
              y1="24"
              x2={24 + 20 * Math.cos((deg * Math.PI) / 180)}
              y2={24 + 20 * Math.sin((deg * Math.PI) / 180)}
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.5"
            />
          ))}
        </svg>
      </div>

      <h1 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
        Open a book to get started
      </h1>
      <p className="text-zinc-500 text-sm mb-8">Let Lumi guide you through your next read</p>

      <button
        onClick={onOpenFile}
        className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold rounded-lg transition-colors text-sm"
      >
        Open File
      </button>

      <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-4">Supports PDF and EPUB · or drag & drop</p>
    </div>
  )
}

export { base64ToArrayBuffer }
