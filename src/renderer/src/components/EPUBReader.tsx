import { useEffect, useRef, useState } from 'react'
import Epub, { type Rendition } from 'epubjs'
import { useReaderStore } from '../store/useReaderStore'
import { savePosition, loadPosition } from '../lib/readingPosition'
import { indexEPUBBook, clearActiveIndex } from '../lib/ragPipeline'
import { loadAnnotations } from '../lib/annotationStore'
import { hashBuffer } from '../lib/vectorStore'
import { extractMemoriesFromChat } from '../lib/userMemory'

interface EPUBReaderProps {
  buffer: ArrayBuffer
}

export default function EPUBReader({ buffer }: EPUBReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  // Veil hides the epub iframe until the rendition has settled at the
  // correct position — prevents the flash of the first page before jumping.
  const [veiled, setVeiled] = useState(true)
  const [ragStatus, setRagStatus] = useState<string>('')

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
    setNavigateOutline,
    annotations,
    setAnnotations,
    setBookHash
  } = useReaderStore()

  // Memory extraction on unmount (book switch)
  useEffect(() => {
    return () => {
      const state = useReaderStore.getState()
      if (state.chat.length > 0) {
        extractMemoriesFromChat(state.chat, state.bookMeta.title).catch(() => {})
      }
    }
  }, [])

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

    // RAG: extract text from all spine items and index in background
    clearActiveIndex()
    book.ready.then(async () => {
      try {
        const chapters: { title: string; text: string }[] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const spine = (book as any).spine
        if (!spine?.items) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const item of spine.items as any[]) {
          try {
            const doc = await (book as any).load(item.href)
            const body = doc?.body ?? doc?.documentElement
            const text = body?.textContent ?? ''
            if (text.trim()) {
              chapters.push({ title: item.href, text: text.trim() })
            }
          } catch {
            // skip unloadable spine items
          }
        }
        if (chapters.length > 0) {
          await indexEPUBBook(buffer, chapters, (p) => {
            setRagStatus(p.stage === 'ready' ? '' : (p.detail ?? p.stage))
          })
        }
      } catch {
        setRagStatus('')
      }
    })

    // Load bookHash, annotations, and apply highlights
    hashBuffer(buffer).then((hash) => {
      setBookHash(hash)
      loadAnnotations(hash).then((store) => {
        if (store) {
          setAnnotations(store.annotations)
          // Apply EPUB highlights via rendition annotations API
          for (const a of store.annotations) {
            if (a.cfi) {
              try {
                rendition.annotations.highlight(
                  a.cfi,
                  { id: a.id },
                  () => {},
                  'lumi-highlight',
                  { fill: 'rgba(250, 204, 21, 0.25)', 'fill-opacity': '0.25' }
                )
              } catch {
                // CFI might not be renderable — skip
              }
            }
          }
        }
      }).catch(() => {})
    }).catch(() => {})

    setNavigation(
      () => rendition.next(),
      () => rendition.prev()
    )

    let firstLocation = true

    const onLocationChanged = (loc: { start: { href: string; cfi: string } }): void => {
      const href = loc?.start?.href ?? ''
      setCurrentChapter(href)

      if (file) savePosition(file.name, { cfi: loc?.start?.cfi ?? href })

      // Lift the veil only after the first locationChanged fires — at that
      // point the rendition is settled at the correct (restored) position.
      if (firstLocation) {
        firstLocation = false
        setVeiled(false)
      }
    }

    const onSelected = (cfiRange: string, contents: { window: Window }): void => {
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
      setSelection({ text, context: '', cfi: cfiRange })
      showToolbar(x, y)
    }

    rendition.on('locationChanged', onLocationChanged)
    rendition.on('selected', onSelected)

    // Safety net: if locationChanged never fires (rare edge-case), lift
    // the veil after a generous timeout so the user isn't stuck.
    const safetyTimer = setTimeout(() => setVeiled(false), 4000)

    return () => {
      clearTimeout(safetyTimer)
      rendition.off('locationChanged', onLocationChanged)
      rendition.off('selected', onSelected)
      renditionRef.current = null
      book.destroy()
    }
  }, [buffer, file, setBookMeta, setCurrentChapter, showToolbar, setSelection, setNavigation, setOutline, setNavigateOutline, setBookHash, setAnnotations])

  // Apply EPUB highlights when annotations change
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition) return
    for (const a of annotations) {
      if (a.cfi) {
        try {
          rendition.annotations.highlight(
            a.cfi,
            { id: a.id },
            () => {},
            'lumi-highlight',
            { fill: 'rgba(250, 204, 21, 0.25)', 'fill-opacity': '0.25' }
          )
        } catch {
          // skip
        }
      }
    }
  }, [annotations])

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
      {ragStatus && (
        <div className="absolute top-2 right-4 z-20 text-xs text-zinc-500 dark:text-zinc-500 animate-pulse">
          {ragStatus}
        </div>
      )}

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
