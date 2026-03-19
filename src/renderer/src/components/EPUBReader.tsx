import { useEffect, useRef, useState } from 'react'
import Epub, { type Rendition } from 'epubjs'
import { useReaderStore } from '../store/useReaderStore'
import { savePosition, loadPosition } from '../lib/readingPosition'

interface EPUBReaderProps {
  buffer: ArrayBuffer
}

export default function EPUBReader({ buffer }: EPUBReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  // Veil hides the epub iframe until the rendition has settled at the
  // correct position — prevents the flash of the first page before jumping.
  const [veiled, setVeiled] = useState(true)

  const {
    file,
    setBookMeta,
    setCurrentChapter,
    showToolbar,
    setSelection,
    setNavigation,
    theme,
    fontSize,
    setOutline,
    setNavigateOutline
  } = useReaderStore()

  useEffect(() => {
    if (!containerRef.current) return
    setVeiled(true)

    const book = Epub(buffer.slice(0))

    book.loaded.metadata.then((meta) => {
      setBookMeta({ title: meta.title ?? '', author: meta.creator ?? '' })
    })

    const rendition = book.renderTo(containerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'scrolled-doc',
      allowScriptedContent: false
    })

    renditionRef.current = rendition

    // Restore saved position, or start from the beginning
    const saved = file ? loadPosition(file.name) : null
    rendition.display(saved?.cfi ?? undefined)

    // Extract TOC
    book.loaded.navigation.then((nav) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapItems = (items: any[]): import('../store/useReaderStore').OutlineItem[] =>
        items.map((item) => ({
          title: item.label?.trim() ?? item.href ?? '(untitled)',
          id: item.href ?? '',
          children: item.subitems?.length ? mapItems(item.subitems) : undefined
        }))
      setOutline(mapItems(nav.toc))
    })

    setNavigateOutline((id: string) => rendition.display(id))

    setNavigation(
      () => rendition.next(),
      () => rendition.prev()
    )

    let firstLocation = true

    rendition.on('locationChanged', (loc: { start: { href: string; cfi: string } }) => {
      const href = loc?.start?.href ?? ''
      setCurrentChapter(href)

      if (file) savePosition(file.name, { cfi: loc?.start?.cfi ?? href })

      // Lift the veil only after the first locationChanged fires — at that
      // point the rendition is settled at the correct (restored) position.
      if (firstLocation) {
        firstLocation = false
        setVeiled(false)
      }
    })

    rendition.on('selected', (_cfiRange: string, contents: { window: Window }) => {
      const sel = contents.window.getSelection()
      if (!sel || sel.isCollapsed) return
      const text = sel.toString().trim()
      if (!text) return
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const iframe = containerRef.current?.querySelector('iframe')
      const iframeRect = iframe?.getBoundingClientRect()
      const x = (iframeRect?.left ?? 0) + rect.left + rect.width / 2
      const y = (iframeRect?.top ?? 0) + rect.top
      setSelection({ text, context: '' })
      showToolbar(x, y)
    })

    // Safety net: if locationChanged never fires (rare edge-case), lift
    // the veil after a generous timeout so the user isn't stuck.
    const safetyTimer = setTimeout(() => setVeiled(false), 4000)

    return () => {
      clearTimeout(safetyTimer)
      renditionRef.current = null
      book.destroy()
    }
  }, [buffer, file, setBookMeta, setCurrentChapter, showToolbar, setSelection, setNavigation, setOutline, setNavigateOutline])

  // Apply theme to epubjs rendition
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition) return
    if (theme === 'dark') {
      rendition.themes.override('color', '#e4e4e7')
      rendition.themes.override('background', '#1e1e1e')
    } else {
      rendition.themes.override('color', '#1a1814')
      rendition.themes.override('background', '#f1ece5')
    }
  }, [theme])

  // Apply font size to epubjs rendition
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition) return
    rendition.themes.fontSize(`${fontSize}px`)
  }, [fontSize])

  return (
    <div
      className="epub-container h-full overflow-hidden relative"
      style={{ background: 'var(--bg-panel)' }}
    >
      {/* Veil: covers the iframe until the rendition is at the right position */}
      {veiled && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: 'var(--bg-panel)' }}
        >
          <span className="text-zinc-500 text-sm">Opening…</span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
