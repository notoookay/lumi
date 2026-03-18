import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { OutlineItem } from '../store/useReaderStore'

// Set worker source once at module init
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfPage {
  pageNum: number
  text: string
}

export async function parsePDF(buffer: ArrayBuffer): Promise<PdfPage[]> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  const pages: PdfPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/ {2,}/g, ' ')
      .trim()
    pages.push({ pageNum: i, text })
  }

  return pages
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveOutlineItems(pdf: pdfjsLib.PDFDocumentProxy, items: any[]): Promise<OutlineItem[]> {
  const result: OutlineItem[] = []
  for (const item of items) {
    let pageNum = 1
    try {
      if (item.dest) {
        const dest = typeof item.dest === 'string'
          ? await pdf.getDestination(item.dest)
          : item.dest
        if (dest?.[0]) pageNum = (await pdf.getPageIndex(dest[0])) + 1
      }
    } catch { /* skip unresolvable destinations */ }
    result.push({
      title: item.title ?? '(untitled)',
      id: String(pageNum),
      children: item.items?.length ? await resolveOutlineItems(pdf, item.items) : undefined
    })
  }
  return result
}

export async function extractPDFOutline(buffer: ArrayBuffer): Promise<OutlineItem[]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const raw = await pdf.getOutline()
  if (!raw?.length) return []
  return resolveOutlineItems(pdf, raw)
}
