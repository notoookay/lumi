/**
 * NotesTab — displays annotations for the current book and user memory entries.
 * Annotations can be clicked to navigate, or deleted.
 * Memory entries can be added manually or deleted.
 */

import { useEffect, useState } from 'react'
import { useReaderStore } from '../store/useReaderStore'
import { removeAnnotation } from '../lib/annotationStore'
import {
  getAllMemoryEntries,
  addMemoryEntry,
  removeMemoryEntry,
  type MemoryEntry
} from '../lib/userMemory'

export default function NotesTab() {
  const { annotations, bookHash, removeAnnotationFromStore, navigateOutline } = useReaderStore()
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([])
  const [newMemory, setNewMemory] = useState('')

  useEffect(() => {
    getAllMemoryEntries().then(setMemoryEntries).catch(() => {})
  }, [])

  const handleDeleteAnnotation = async (id: string): Promise<void> => {
    if (!bookHash) return
    await removeAnnotation(bookHash, id)
    removeAnnotationFromStore(id)
  }

  const handleAddMemory = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const content = newMemory.trim()
    if (!content) return
    setNewMemory('')
    const entry = await addMemoryEntry({ type: 'fact', content })
    setMemoryEntries((prev) => [entry, ...prev])
  }

  const handleDeleteMemory = async (id: string): Promise<void> => {
    await removeMemoryEntry(id)
    setMemoryEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const handleAnnotationClick = (source: string, cfi?: string): void => {
    if (cfi && navigateOutline) {
      // EPUB: navigate to CFI
      navigateOutline(cfi)
    } else if (navigateOutline) {
      // PDF: source is like "Page 42" or "p42" — extract page number
      const match = source.match(/\d+/)
      if (match) navigateOutline(match[0])
    }
  }

  const formatTime = (ts: number): string => {
    const diff = Date.now() - ts
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(ts).toLocaleDateString()
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Annotations section */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
          Highlights ({annotations.length})
        </h3>

        {annotations.length === 0 ? (
          <p className="text-xs text-zinc-500 px-1">
            No highlights yet. Select text and click Highlight to add one.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {[...annotations].sort((a, b) => b.createdAt - a.createdAt).map((a) => (
              <div
                key={a.id}
                className="group rounded-lg px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                style={{ border: '1px solid var(--border)' }}
                onClick={() => handleAnnotationClick(a.source, a.cfi)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-yellow-500 dark:text-yellow-400 line-clamp-2 leading-relaxed">
                      &ldquo;{a.text.slice(0, 120)}{a.text.length > 120 ? '…' : ''}&rdquo;
                    </p>
                    {a.note && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 italic">
                        {a.note}
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {a.source} · {formatTime(a.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteAnnotation(a.id) }}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 text-xs transition-opacity shrink-0"
                    title="Delete highlight"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* User memory section */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
          Memory ({memoryEntries.length})
        </h3>

        <form onSubmit={handleAddMemory} className="mb-2">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
          >
            <input
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              placeholder="Add a memory…"
              className="flex-1 bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none"
              maxLength={150}
            />
            <button
              type="submit"
              disabled={!newMemory.trim()}
              className="text-amber-500 dark:text-amber-400 disabled:text-zinc-500 text-xs transition-colors"
            >
              +
            </button>
          </div>
        </form>

        {memoryEntries.length === 0 ? (
          <p className="text-xs text-zinc-500 px-1">
            Lumi learns about you over time, or add memories manually.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {memoryEntries.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-start gap-2 rounded px-2 py-1.5 hover:bg-white/5 transition-colors"
              >
                <span className="text-xs text-zinc-500 shrink-0 mt-0.5">
                  {entry.type === 'preference' ? '⚙' : entry.type === 'insight' ? '💡' : '📌'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-700 dark:text-zinc-300">{entry.content}</p>
                  {entry.bookTitle && (
                    <p className="text-[10px] text-zinc-500 mt-0.5">from &ldquo;{entry.bookTitle}&rdquo;</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteMemory(entry.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 text-xs transition-opacity shrink-0"
                  title="Delete memory"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
