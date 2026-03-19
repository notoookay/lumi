import { useState, useCallback } from 'react'
import { useReaderStore } from '../store/useReaderStore'
import {
  loadShelf,
  removeShelfEntry,
  type BookshelfEntry,
  relativeTime
} from '../lib/bookshelf'
import { base64ToArrayBuffer } from './FileDropzone'
import FileDropzone from './FileDropzone'

interface BookshelfScreenProps {
  onOpenFile: () => void
}

export default function BookshelfScreen({ onOpenFile }: BookshelfScreenProps) {
  const setFile = useReaderStore((s) => s.setFile)
  const [shelf, setShelf] = useState<BookshelfEntry[]>(() => loadShelf())
  const [errorPath, setErrorPath] = useState<string | null>(null)

  const openEntry = useCallback(
    async (entry: BookshelfEntry) => {
      const result = await window.electronAPI.openFileByPath(entry.filePath)
      if (!result) {
        // File missing — flash the card, offer removal
        setErrorPath(entry.filePath)
        setTimeout(() => setErrorPath(null), 2500)
        return
      }
      const ext = result.fileName.split('.').pop()?.toLowerCase()
      if (ext !== 'pdf' && ext !== 'epub') return
      const buffer = base64ToArrayBuffer(result.buffer)
      setFile({ name: result.fileName, path: result.filePath, type: ext as 'pdf' | 'epub', buffer })
    },
    [setFile]
  )

  const handleRemove = (e: React.MouseEvent, filePath: string): void => {
    e.stopPropagation()
    removeShelfEntry(filePath)
    setShelf(loadShelf())
  }

  const handleRemoveMissing = (filePath: string): void => {
    removeShelfEntry(filePath)
    setShelf(loadShelf())
    setErrorPath(null)
  }

  // No history yet — show the original drop zone
  if (shelf.length === 0) {
    return <FileDropzone onOpenFile={onOpenFile} />
  }

  return (
    <div
      className="flex flex-col w-full h-full overflow-y-auto reader-scroll select-none"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-10 pt-10 pb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Your Library</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{shelf.length} {shelf.length === 1 ? 'book' : 'books'}</p>
        </div>
        <button
          onClick={onOpenFile}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 2v10M2 7h10" />
          </svg>
          Open Book
        </button>
      </div>

      {/* "File not found" banner */}
      {errorPath && (
        <div className="mx-10 mb-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs">
          <span>This file couldn't be found — it may have been moved or deleted.</span>
          <button
            onClick={() => handleRemoveMissing(errorPath)}
            className="shrink-0 underline hover:no-underline"
          >
            Remove from library
          </button>
        </div>
      )}

      {/* Book grid */}
      <div
        className="px-10 pb-10 grid gap-6"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}
      >
        {shelf.map((entry) => (
          <BookCard
            key={entry.filePath}
            entry={entry}
            isError={errorPath === entry.filePath}
            onOpen={() => openEntry(entry)}
            onRemove={(e) => handleRemove(e, entry.filePath)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Individual book card ─────────────────────────────────────────────────────

interface BookCardProps {
  entry: BookshelfEntry
  isError: boolean
  onOpen: () => void
  onRemove: (e: React.MouseEvent) => void
}

function BookCard({ entry, isError, onOpen, onRemove }: BookCardProps) {
  const displayTitle = entry.title || entry.fileName.replace(/\.(pdf|epub)$/i, '')

  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col text-left outline-none"
      title={displayTitle}
    >
      {/* Cover */}
      <div
        className="relative w-full rounded-lg overflow-hidden transition-transform duration-150 group-hover:-translate-y-1 group-hover:shadow-2xl"
        style={{
          aspectRatio: '2 / 3',
          background: isError ? '#7f1d1d' : entry.coverColor,
          boxShadow: '3px 4px 12px rgba(0,0,0,0.45)'
        }}
      >
        {/* Spine highlight */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2 rounded-l-lg"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        />

        {/* Title on cover */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 gap-2">
          {/* Book icon */}
          <svg
            width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <p
            className="text-white/90 font-semibold text-center leading-tight"
            style={{ fontSize: 11, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {displayTitle}
          </p>
        </div>

        {/* Format badge */}
        <div
          className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-white/60 font-mono uppercase"
          style={{ fontSize: 9, background: 'rgba(0,0,0,0.3)' }}
        >
          {entry.type}
        </div>

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          title="Remove from library"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
            <path d="M1 1l6 6M7 1L1 7" />
          </svg>
        </button>
      </div>

      {/* Metadata below cover */}
      <div className="mt-2 px-0.5">
        <p
          className="text-zinc-700 dark:text-zinc-300 font-medium leading-tight truncate"
          style={{ fontSize: 11 }}
        >
          {displayTitle}
        </p>
        {entry.author && (
          <p className="text-zinc-500 truncate mt-0.5" style={{ fontSize: 10 }}>
            {entry.author}
          </p>
        )}
        <p className="text-zinc-400 dark:text-zinc-600 mt-0.5" style={{ fontSize: 10 }}>
          {relativeTime(entry.lastOpened)}
        </p>
      </div>
    </button>
  )
}
