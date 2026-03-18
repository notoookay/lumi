import { useEffect, useRef, useState } from 'react'
import { useReaderStore } from '../store/useReaderStore'
import { runStreamAction } from '../lib/streamAction'
import { buildSurroundingContext } from '../lib/contextBuilder'

export default function SelectionToolbar() {
  const { toolbar, selection, hideToolbar, bookMeta, currentChapter } = useReaderStore()
  const [askMode, setAskMode] = useState(false)
  const [question, setQuestion] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!toolbar.visible) {
      setAskMode(false)
      setQuestion('')
    }
  }, [toolbar.visible])

  useEffect(() => {
    if (askMode) inputRef.current?.focus()
  }, [askMode])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') hideToolbar()
    }
    const handleClick = (e: MouseEvent): void => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        hideToolbar()
      }
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [hideToolbar])

  if (!toolbar.visible || !selection) return null

  const handleAction = (type: 'explain' | 'translate' | 'ask', q?: string): void => {
    const surroundingContext = buildSurroundingContext(document.body.innerText, selection.text)
    runStreamAction({
      actionType: type,
      selectedText: selection.text,
      surroundingContext: selection.context || surroundingContext,
      chapterTitle: currentChapter,
      bookTitle: bookMeta.title,
      bookAuthor: bookMeta.author,
      userQuestion: q
    })
    hideToolbar()
  }

  const margin = 8
  const tw = 280
  const th = 44
  let x = toolbar.x - tw / 2
  let y = toolbar.y - th - 10
  if (x < margin) x = margin
  if (x + tw > window.innerWidth - margin) x = window.innerWidth - tw - margin
  if (y < margin) y = toolbar.y + 20

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[9999] flex items-center gap-1 px-2 py-1.5 rounded-full shadow-xl"
      style={{
        left: x,
        top: y,
        background: 'var(--bg-toolbar)',
        border: '1px solid var(--border)',
        minWidth: tw
      }}
    >
      {!askMode ? (
        <>
          <button
            className="no-drag px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 transition-colors"
            onClick={() => handleAction('explain')}
          >
            Explain
          </button>
          <button
            className="no-drag px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30 transition-colors"
            onClick={() => handleAction('translate')}
          >
            Translate
          </button>
          <button
            className="no-drag px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/30 transition-colors"
            onClick={() => setAskMode(true)}
          >
            Ask
          </button>
        </>
      ) : (
        <form
          className="flex items-center gap-1 w-full"
          onSubmit={(e) => {
            e.preventDefault()
            if (question.trim()) handleAction('ask', question.trim())
          }}
        >
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about this passage…"
            className="flex-1 bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none px-2"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-40 transition-colors"
          >
            Ask
          </button>
        </form>
      )}
    </div>
  )
}
