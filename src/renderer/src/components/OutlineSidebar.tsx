import { useState } from 'react'
import { useReaderStore, type OutlineItem } from '../store/useReaderStore'

interface OutlineNodeProps {
  item: OutlineItem
  depth: number
  currentChapter: string
  onNavigate: (id: string) => void
}

function OutlineNode({ item, depth, currentChapter, onNavigate }: OutlineNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = item.children && item.children.length > 0

  // Highlight active item: for EPUB match href, for PDF match page label
  const isActive =
    currentChapter === item.id ||
    currentChapter === `Page ${item.id}` ||
    currentChapter.endsWith(item.id)

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded px-2 py-1 cursor-pointer transition-colors text-sm
          ${isActive
            ? 'text-amber-500 dark:text-amber-400 bg-amber-500/10'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onNavigate(item.id)}
      >
        {hasChildren ? (
          <button
            className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <path d="M3 2l4 3-4 3V2z" />
            </svg>
          </button>
        ) : (
          <span className="w-2.5 shrink-0" />
        )}
        <span className="truncate leading-5">{item.title}</span>
      </div>

      {hasChildren && expanded && (
        <div>
          {item.children!.map((child, i) => (
            <OutlineNode
              key={i}
              item={child}
              depth={depth + 1}
              currentChapter={currentChapter}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OutlineSidebar() {
  const { outline, currentChapter, navigateOutline } = useReaderStore()

  if (outline.length === 0) {
    return (
      <div
        className="h-full flex items-center justify-center select-none"
        style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}
      >
        <p className="text-zinc-400 dark:text-zinc-600 text-xs text-center px-4">No outline available</p>
      </div>
    )
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}
    >
      <div className="px-3 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">Contents</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1 reader-scroll">
        {outline.map((item, i) => (
          <OutlineNode
            key={i}
            item={item}
            depth={0}
            currentChapter={currentChapter}
            onNavigate={(id) => navigateOutline?.(id)}
          />
        ))}
      </div>
    </div>
  )
}
