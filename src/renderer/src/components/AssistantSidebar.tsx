import { useEffect, useRef, useState } from 'react'
import { useReaderStore } from '../store/useReaderStore'
import { runStreamAction } from '../lib/streamAction'
import ChatBubble from './ChatBubble'

export default function AssistantSidebar() {
  const { chat, clearChat, bookMeta, currentChapter, selection } = useReaderStore()
  const [freeInput, setFreeInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.length, chat[chat.length - 1]?.response])

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
        <span className="text-amber-400 font-semibold text-sm lumi-glow">Lumi</span>
        {chat.length > 0 && (
          <button
            onClick={clearChat}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-xs transition-colors"
          >
            Clear
          </button>
        )}
      </div>

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
    </div>
  )
}
