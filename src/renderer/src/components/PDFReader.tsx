import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react'
import { parsePDF, extractPDFOutline, type PdfPage } from '../lib/pdfParser'
import { useReaderStore } from '../store/useReaderStore'
import { buildSurroundingContext } from '../lib/contextBuilder'
import { savePosition, loadPosition } from '../lib/readingPosition'
import { indexPDFBook, clearActiveIndex } from '../lib/ragPipeline'
import { loadAnnotations } from '../lib/annotationStore'
import { hashBuffer } from '../lib/vectorStore'
import { extractMemoriesFromChat } from '../lib/userMemory'
import type { Annotation } from '../lib/annotationStore'

interface PDFReaderProps {
  buffer: ArrayBuffer
}

/**
 * Render page text with highlight overlays for annotations.
 * Splits the text at annotation boundaries and wraps matches in <mark>.
 */
function renderHighlightedText(
  pageText: string,
  pageNum: number,
  annotations: Annotation[]
): ReactNode {
  // Find annotations that match text on this page
  const pageAnnotations = annotations.filter(
    (a) => a.pageNum === pageNum && pageText.includes(a.text)
  )

  if (pageAnnotations.length === 0) return pageText

  // Build a list of non-overlapping highlight ranges sorted by position
  const ranges: { start: number; end: number; annotation: Annotation }[] = []
  for (const a of pageAnnotations) {
    const idx = pageText.indexOf(a.text)
    if (idx !== -1) {
      // Check for overlap with existing ranges
      const overlaps = ranges.some(
        (r) => idx < r.end && idx + a.text.length > r.start
      )
      if (!overlaps) {
        ranges.push({ start: idx, end: idx + a.text.length, annotation: a })
      }
    }
  }

  ranges.sort((a, b) => a.start - b.start)

  const parts: ReactNode[] = []
  let cursor = 0
  for (const r of ranges) {
    if (r.start > cursor) {
      parts.push(pageText.slice(cursor, r.start))
    }
    parts.push(
      <mark
        key={r.annotation.id}
        className="bg-yellow-400/30 dark:bg-yellow-500/20 rounded-sm px-0.5"
        title={r.annotation.note || undefined}
      >
        {pageText.slice(r.start, r.end)}
      </mark>
    )
    cursor = r.end
  }
  if (cursor < pageText.length) {
    parts.push(pageText.slice(cursor))
  }

  return <>{parts}</>
}

export default function PDFReader({ buffer }: PDFReaderProps) {
  const [pages, setPages] = useState<PdfPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Veil hides content until we've scrolled to the restored position,
  // so the user never sees a flash of page 1 before jumping.
  const [veiled, setVeiled] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const currentPageRef = useRef(1)
  const restoredRef = useRef(false)

  const [ragStatus, setRagStatus] = useState<string>('')

  const {
    file,
    setCurrentChapter,
    showToolbar,
    setSelection,
    setNavigation,
    fontSize,
    setOutline,
    setNavigateOutline,
    annotations,
    setAnnotations,
    setBookHash
  } = useReaderStore()

  // Memoize annotations filtered for current book type
  const pdfAnnotations = useMemo(
    () => annotations.filter((a) => a.pageNum !== undefined),
    [annotations]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setVeiled(true)
    setError(null)
    restoredRef.current = false
    parsePDF(buffer)
      .then((p) => { if (!cancelled) { setPages(p); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err?.message ?? 'Failed to parse PDF'); setLoading(false) } })
    extractPDFOutline(buffer).then((o) => { if (!cancelled) setOutline(o) }).catch(() => {})
    return () => { cancelled = true }
  }, [buffer, setOutline])

  // RAG: index book text in background once pages are ready
  useEffect(() => {
    if (pages.length === 0) return
    clearActiveIndex()
    indexPDFBook(buffer, pages, (p) => {
      setRagStatus(p.stage === 'ready' ? '' : (p.detail ?? p.stage))
    }).catch(() => setRagStatus(''))

    // Set bookHash and load annotations
    hashBuffer(buffer).then((hash) => {
      setBookHash(hash)
      loadAnnotations(hash).then((store) => {
        if (store) setAnnotations(store.annotations)
      }).catch(() => {})
    }).catch(() => {})
  }, [buffer, pages, setBookHash, setAnnotations])

  // Memory extraction on unmount (book switch)
  useEffect(() => {
    return () => {
      const state = useReaderStore.getState()
      if (state.chat.length > 0) {
        extractMemoriesFromChat(state.chat, state.bookMeta.title).catch(() => {})
      }
    }
  }, [])

  // Once pages are mounted, jump to saved position then lift the veil
  useEffect(() => {
    if (pages.length === 0 || restoredRef.current) return
    restoredRef.current = true

    const saved = file ? loadPosition(file.name) : null

    if (saved?.page && saved.page > 1) {
      // Give the DOM one more frame to finish painting all page divs
      const t = requestAnimationFrame(() => {
        const idx = Math.max(0, Math.min(pages.length - 1, saved.page! - 1))
        pageRefs.current[idx]?.scrollIntoView()
        // Tiny extra delay so the browser settles before we reveal
        setTimeout(() => setVeiled(false), 50)
      })
      return () => cancelAnimationFrame(t)
    }

    setVeiled(false)
    return undefined
  }, [pages, file])

  // IntersectionObserver: track + persist current page
  useEffect(() => {
    if (pages.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          const el = visible[0].target as HTMLDivElement
          const num = el.dataset.page
          if (num) {
            const pageNum = Number(num)
            currentPageRef.current = pageNum
            setCurrentChapter(`Page ${num}`)
            if (file) savePosition(file.name, { page: pageNum })
          }
        }
      },
      { threshold: 0.3 }
    )
    pageRefs.current.forEach((el) => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [pages, file, setCurrentChapter])

  // Register prev/next navigation for the title bar
  useEffect(() => {
    if (pages.length === 0) return
    const scrollToPage = (pageNum: number): void => {
      const idx = Math.max(0, Math.min(pages.length - 1, pageNum - 1))
      pageRefs.current[idx]?.scrollIntoView({ behavior: 'smooth' })
    }
    setNavigation(
      () => scrollToPage(currentPageRef.current + 1),
      () => scrollToPage(currentPageRef.current - 1)
    )
  }, [pages, setNavigation])

  // Register outline navigation
  useEffect(() => {
    setNavigateOutline((id: string) => {
      const pageNum = parseInt(id, 10)
      if (!isNaN(pageNum)) {
        const idx = Math.max(0, Math.min(pages.length - 1, pageNum - 1))
        pageRefs.current[idx]?.scrollIntoView({ behavior: 'smooth' })
      }
    })
  }, [pages, setNavigateOutline])

  const handleMouseUp = (): void => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return
    const text = sel.toString().trim()
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const allText = pages.map((p) => p.text).join('\n\n')
    const context = buildSurroundingContext(allText, text)
    setSelection({ text, context, pageNum: currentPageRef.current })
    showToolbar(rect.left + rect.width / 2, rect.top)
  }

  if (loading || error) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ background: 'var(--bg-panel)' }}
      >
        {error
          ? <span className="text-red-500 dark:text-red-400 px-8 text-center">{error}</span>
          : <span className="text-zinc-500">Loading PDF…</span>
        }
      </div>
    )
  }

  return (
    <div className="relative h-full" style={{ background: 'var(--bg-panel)' }}>
      {/* Veil: blocks the flash of page-1 while we scroll to the saved position */}
      {veiled && (
        <div
          className="absolute inset-0 z-10"
          style={{ background: 'var(--bg-panel)' }}
        />
      )}

      {ragStatus && (
        <div className="absolute top-2 right-4 z-20 text-xs text-zinc-500 dark:text-zinc-500 animate-pulse">
          {ragStatus}
        </div>
      )}

      <div
        ref={containerRef}
        className="h-full overflow-y-auto reader-scroll px-8 py-6"
        onMouseUp={handleMouseUp}
      >
        {pages.map((page, i) => (
          <div
            key={page.pageNum}
            ref={(el) => { pageRefs.current[i] = el }}
            data-page={page.pageNum}
            className="pdf-page max-w-2xl mx-auto"
          >
            <div className="text-zinc-400 dark:text-zinc-600 text-xs mb-3 select-none">
              Page {page.pageNum}
            </div>
            <p
              className="reader-text text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap"
              style={{ fontSize }}
            >
              {renderHighlightedText(page.text, page.pageNum, pdfAnnotations)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
