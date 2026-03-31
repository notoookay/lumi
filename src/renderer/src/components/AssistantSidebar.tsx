import { useEffect, useRef, useState } from 'react'
import { useReaderStore } from '../store/useReaderStore'
import { runStreamAction } from '../lib/streamAction'
import { exportNotesAsMarkdown } from '../lib/exportNotes'
import ChatBubble from './ChatBubble'
import BookSearch from './BookSearch'
import NotesTab from './NotesTab'

export default function AssistantSidebar() {
  const { chat, clearChat, bookMeta, currentChapter, selection } = useReaderStore()
  const [freeInput, setFreeInput] = useState('')
  const [tab, setTab] = useState<'chat' | 'search' | 'notes'>('chat')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Throttle auto-scroll — streaming updates fire every ~200ms, no need to scroll each one
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [chat.length, chat[chat.length - 1]?.isStreaming])

  const handleFreeQuestion = (e: React.FormEvent): void => {
    e.preventDefault()
    const q = freeInput.trim()
    if (!q) return
    setFreeInput('')
    runStreamAction({
      actionType: 'free',
      selectedText: selection?.text ?? '',
      surroundingContext: selection?.context ?? '',
      chapterTitle: currentChapter,
      bookTitle: bookMeta.title,
      bookAuthor: bookMeta.author,
      userQuestion: q
    })
  }

  const handleSummarize = (): void => {
    runStreamAction({
      actionType: 'free',
      selectedText: '',
      surroundingContext: '',
      chapterTitle: currentChapter,
      bookTitle: bookMeta.title,
      bookAuthor: bookMeta.author,
      userQuestion: `Summarize the key points of "${currentChapter || 'this section'}" in a few bullet points.`
    })
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="no-drag flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-semibold text-sm lumi-glow">Lumi</span>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={() => setTab('chat')}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                tab === 'chat'
                  ? 'text-amber-400 bg-amber-400/10'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setTab('search')}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                tab === 'search'
                  ? 'text-amber-400 bg-amber-400/10'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setTab('notes')}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                tab === 'notes'
                  ? 'text-amber-400 bg-amber-400/10'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Notes
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tab === 'chat' && (
            <>
              {/* Summarize chapter */}
              <button
                onClick={handleSummarize}
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-xs transition-colors"
                title={`Summarize "${currentChapter || 'this chapter'}"`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <line x1="1" y1="3" x2="11" y2="3"/>
                  <line x1="1" y1="6" x2="8" y2="6"/>
                  <line x1="1" y1="9" x2="9.5" y2="9"/>
                </svg>
                Summarize
              </button>

              {chat.length > 0 && (
                <div className="flex items-center gap-2">
                  {/* Export chat as markdown */}
                  <button
                    onClick={() => exportNotesAsMarkdown(chat, bookMeta.title, bookMeta.author)}
                    className="flex items-center gap-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-xs transition-colors"
                    title="Export notes as markdown"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5"/>
                      <path d="M1 10h10"/>
                    </svg>
                    Export
                  </button>
                  <button
                    onClick={clearChat}
                    className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-xs transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {tab === 'chat' ? (
        <>
          {/* Chat area */}
          <div className="flex-1 overflow-y-auto px-4 reader-scroll">
            {chat.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="12" fill="#f59e0b" opacity="0.15" />
                  <circle cx="20" cy="20" r="7" fill="#f59e0b" opacity="0.5" />
                  <circle cx="20" cy="20" r="3.5" fill="#fef3c7" />
                </svg>
                <p className="text-zinc-500 text-sm text-center">Select any text to ask Lumi</p>
              </div>
            ) : (
              <div className="py-2">
                {chat.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Free-form input */}
          <form
            onSubmit={handleFreeQuestion}
            className="no-drag shrink-0 px-3 py-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
            >
              <input
                value={freeInput}
                onChange={(e) => setFreeInput(e.target.value)}
                placeholder="Ask Lumi about this chapter…"
                className="flex-1 bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none"
              />
              <button
                type="submit"
                disabled={!freeInput.trim()}
                className="text-amber-500 dark:text-amber-400 disabled:text-zinc-400 dark:disabled:text-zinc-600 hover:text-amber-400 dark:hover:text-amber-300 transition-colors"
                aria-label="Send"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M13 7L1 1l2 6-2 6 12-6z" />
                </svg>
              </button>
            </div>
          </form>
        </>
      ) : tab === 'search' ? (
        /* Search tab */
        <div className="flex-1 overflow-y-auto px-4 py-3 reader-scroll">
          <BookSearch />
        </div>
      ) : (
        /* Notes tab */
        <div className="flex-1 overflow-y-auto px-4 py-3 reader-scroll">
          <NotesTab />
        </div>
      )}
    </div>
  )
}
