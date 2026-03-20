/**
 * BookSearch — semantic search over the full book via RAG index.
 * "What did it say about X?" → retrieves top-k passages.
 */

import { useState } from 'react'
import { getActiveIndex } from '../lib/ragPipeline'
import { embedQuery } from '../lib/embeddings'
import { retrieve, type RetrievalResult } from '../lib/vectorStore'

export default function BookSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RetrievalResult[]>([])
  const [searching, setSearching] = useState(false)
  const [noIndex, setNoIndex] = useState(false)

  const handleSearch = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    const index = getActiveIndex()
    if (!index || index.chunks.length === 0) {
      setNoIndex(true)
      return
    }
    setNoIndex(false)
    setSearching(true)

    try {
      const qEmbed = await embedQuery(q)
      const hits = retrieve(index, qEmbed, 8).filter((r) => r.score > 0.25)
      setResults(hits)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div
          className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            className="text-zinc-400 shrink-0"
          >
            <circle cx="5" cy="5" r="3.5" />
            <line x1="7.5" y1="7.5" x2="10.5" y2="10.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the book…"
            className="flex-1 bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none"
          />
        </div>
      </form>

      {noIndex && (
        <p className="text-xs text-zinc-500 px-1">
          Book is still being indexed — try again shortly.
        </p>
      )}

      {searching && (
        <p className="text-xs text-zinc-500 px-1 animate-pulse">Searching…</p>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto reader-scroll">
          {results.map((r, i) => (
            <div
              key={i}
              className="rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-amber-500 dark:text-amber-400 font-medium">
                  {r.chunk.source}
                </span>
                <span className="text-zinc-400 text-[10px]">
                  {(r.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-zinc-700 dark:text-zinc-300 line-clamp-4 leading-relaxed">
                {r.chunk.text.slice(0, 300)}
                {r.chunk.text.length > 300 ? '…' : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {!searching && results.length === 0 && query.trim() && !noIndex && (
        <p className="text-xs text-zinc-500 px-1">
          No results. Try a different query.
        </p>
      )}
    </div>
  )
}
