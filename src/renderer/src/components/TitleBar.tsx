import { useReaderStore } from '../store/useReaderStore'

interface TitleBarProps {
  onOpenFile: () => void
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export default function TitleBar({ onOpenFile }: TitleBarProps) {
  const { file, bookMeta, currentChapter, goNext, goPrev, theme, toggleTheme, fontSize, increaseFontSize, decreaseFontSize, resetFontSize, outlineOpen, toggleOutline, outline } = useReaderStore()
  const DEFAULT_FONT_SIZE = 17

  return (
    <div
      className="title-bar-drag fixed top-0 left-0 right-0 z-50 flex items-center justify-between pr-4"
      style={{ height: 44, paddingLeft: 76, background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Left: Lumi wordmark + outline toggle */}
      <div className="no-drag flex items-center gap-2">
        <span className="text-amber-400 font-semibold text-base tracking-wide lumi-glow select-none">
          Lumi
        </span>
        {file && outline.length > 0 && (
          <button
            onClick={toggleOutline}
            className={`transition-colors p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800
              ${outlineOpen ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            title={outlineOpen ? 'Hide outline' : 'Show outline'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Center: book title */}
      <div className="absolute left-1/2 -translate-x-1/2 max-w-xs truncate text-zinc-600 dark:text-zinc-400 text-sm select-none">
        {bookMeta.title || (file?.name ?? '')}
      </div>

      {/* Right: chapter + nav + theme toggle + open button */}
      <div className="no-drag flex items-center gap-2">
        {currentChapter && (
          <span className="text-zinc-500 text-xs truncate max-w-[130px]">{currentChapter}</span>
        )}

        {(goPrev || goNext) && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => goPrev?.()}
              disabled={!goPrev}
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 disabled:text-zinc-300 dark:disabled:text-zinc-700 transition-colors px-1.5 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Previous"
            >‹</button>
            <button
              onClick={() => goNext?.()}
              disabled={!goNext}
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 disabled:text-zinc-300 dark:disabled:text-zinc-700 transition-colors px-1.5 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Next"
            >›</button>
          </div>
        )}

        {/* Font size */}
        {file && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={decreaseFontSize}
              disabled={fontSize <= 12}
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 disabled:text-zinc-300 dark:disabled:text-zinc-700 transition-colors px-1.5 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium"
              title="Decrease font size"
            >A−</button>
            {fontSize !== DEFAULT_FONT_SIZE && (
              <button
                onClick={resetFontSize}
                className="text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors px-1.5 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs tabular-nums"
                title="Reset font size"
              >{fontSize}px</button>
            )}
            <button
              onClick={increaseFontSize}
              disabled={fontSize >= 28}
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 disabled:text-zinc-300 dark:disabled:text-zinc-700 transition-colors px-1.5 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-medium"
              title="Increase font size"
            >A+</button>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        <button
          onClick={onOpenFile}
          className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 hover:border-amber-400/50"
        >
          Open File
        </button>
      </div>
    </div>
  )
}
