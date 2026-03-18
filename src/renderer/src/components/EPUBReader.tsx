import { useEffect, useRef } from 'react'
import Epub, { type Rendition } from 'epubjs'
import { useReaderStore } from '../store/useReaderStore'

interface EPUBReaderProps {
  buffer: ArrayBuffer
}

export default function EPUBReader({ buffer }: EPUBReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const { setBookMeta, setCurrentChapter, showToolbar, setSelection, setNavigation, theme, fontSize, setOutline, setNavigateOutline } = useReaderStore()

  useEffect(() => {
    if (!containerRef.current) return

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

    rendition.display()

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

    rendition.on('locationChanged', (loc: { start: { href: string } }) => {
      setCurrentChapter(loc?.start?.href ?? '')
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

    return () => {
      renditionRef.current = null
      book.destroy()
    }
  }, [buffer, setBookMeta, setCurrentChapter, showToolbar, setSelection, setNavigation, setOutline, setNavigateOutline])

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
      ref={containerRef}
      className="epub-container h-full overflow-hidden"
      style={{ background: 'var(--bg-panel)' }}
    />
  )
}
