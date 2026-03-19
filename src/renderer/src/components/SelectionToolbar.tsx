import { useEffect, useRef, useState } from 'react'
import { useReaderStore } from '../store/useReaderStore'
import { runStreamAction } from '../lib/streamAction'
import { runTranslateAction } from '../lib/translateAction'
import { buildSurroundingContext } from '../lib/contextBuilder'
import { LANGUAGES } from '../lib/googleTranslate'

export default function SelectionToolbar() {
  const { toolbar, selection, hideToolbar, bookMeta, currentChapter, translateTo, setTranslateTo } =
    useReaderStore()
  const [askMode, setAskMode] = useState(false)
  const [question, setQuestion] = useState('')
  const [langPickerOpen, setLangPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!toolbar.visible) {
      setAskMode(false)
      setQuestion('')
      setLangPickerOpen(false)
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

  const handleLLMAction = (type: 'explain' | 'ask', userQuestion?: string): void => {
    const surroundingContext = buildSurroundingContext(document.body.innerText, selection.text)
    runStreamAction({
      actionType: type,
      selectedText: selection.text,
      surroundingContext: selection.context || surroundingContext,
      chapterTitle: currentChapter,
      bookTitle: bookMeta.title,
      bookAuthor: bookMeta.author,
      userQuestion
    })
    hideToolbar()
  }

  const handleTranslate = (lang?: string): void => {
    const target = lang ?? translateTo
    if (lang) setTranslateTo(lang)
    setLangPickerOpen(false)
    runTranslateAction(selection.text, target)
    hideToolbar()
  }

  const targetLang = LANGUAGES.find((l) => l.code === translateTo)

  // Toolbar positioning — stay within viewport
  const margin = 8
  const tw = langPickerOpen ? 320 : askMode ? 300 : 288
  const th = 44
  let x = toolbar.x - tw / 2
  let y = toolbar.y - th - 10
  if (x < margin) x = margin
  if (x + tw > window.innerWidth - margin) x = window.innerWidth - tw - margin
  if (y < margin) y = toolbar.y + 20

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[9999] shadow-xl"
      style={{
        left: x,
        top: y,
        background: 'var(--bg-toolbar)',
        border: '1px solid var(--border)',
        borderRadius: langPickerOpen ? 14 : 9999,
        minWidth: tw,
        transition: 'border-radius 0.15s ease'
      }}
    >
      {/* Main row */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        {!askMode ? (
          <>
            {/* Explain */}
            <button
              className="no-drag px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 transition-colors"
              onClick={() => handleLLMAction('explain')}
            >
              Explain
            </button>

            {/* Translate + language caret */}
            <div className="flex items-center rounded-full overflow-hidden bg-emerald-500/20">
              <button
                className="no-drag px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                onClick={() => handleTranslate()}
                title={`Translate to ${targetLang?.name ?? 'English'}`}
              >
                → {targetLang?.flag ?? '🇬🇧'} {targetLang?.name ?? 'English'}
              </button>
              <button
                className="no-drag pr-2 pl-0.5 py-1 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                onClick={() => setLangPickerOpen((o) => !o)}
                title="Change language"
              >
                {langPickerOpen ? '▴' : '▾'}
              </button>
            </div>

            {/* Ask */}
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
              if (question.trim()) handleLLMAction('ask', question.trim())
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
            <button
              type="button"
              onClick={() => setAskMode(false)}
              className="px-2 py-1 rounded-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ✕
            </button>
          </form>
        )}
      </div>

      {/* Language picker grid */}
      {langPickerOpen && (
        <div
          className="px-2 pb-2 grid gap-1"
          style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleTranslate(lang.code)}
              className={`no-drag flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg text-xs transition-colors
                ${translateTo === lang.code
                  ? 'bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'hover:bg-white/5 text-zinc-600 dark:text-zinc-400'
                }`}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span className="leading-none truncate w-full text-center" style={{ fontSize: 10 }}>
                {lang.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
