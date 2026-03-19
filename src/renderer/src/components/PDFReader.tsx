import { useEffect, useRef, useState } from 'react'
import { parsePDF, extractPDFOutline, type PdfPage } from '../lib/pdfParser'
import { useReaderStore } from '../store/useReaderStore'
import { buildSurroundingContext } from '../lib/contextBuilder'
import { savePosition, loadPosition } from '../lib/readingPosition'

interface PDFReaderProps {
  buffer: ArrayBuffer
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

  const {
    file,
    setCurrentChapter,
    showToolbar,
    setSelection,
    setNavigation,
    fontSize,
    setOutline,
    setNavigateOutline
  } = useReaderStore()

  useEffect(() => {
    setLoading(true)
    setVeiled(true)
    setError(null)
    restoredRef.current = false
    parsePDF(buffer)
      .then((p) => { setPages(p); setLoading(false) })
      .catch((err) => { setError(err?.message ?? 'Failed to parse PDF'); setLoading(false) })
    extractPDFOutline(buffer).then(setOutline).catch(() => {})
  }, [buffer, setOutline])

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
    setSelection({ text, context })
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
              {page.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
