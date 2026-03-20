/**
 * RAG pipeline — orchestrates indexing (chunk → embed → persist) and
 * retrieval (query → embed → search → format context).
 *
 * Indexing runs once per book on first open and is cached to disk.
 * Retrieval is called at query time from streamAction.
 */

import { chunkPages, chunkText, type TextChunk } from './chunker'
import { embedTexts, embedQuery } from './embeddings'
import {
  hashBuffer,
  saveIndex,
  loadIndex,
  retrieve,
  cosineSimilarity,
  type BookIndex
} from './vectorStore'
import { generateChapterSummaries, clearSummaryCache } from './chapterSummaryCache'
import {
  loadAnnotations,
  getActiveAnnotationStore,
  clearActiveAnnotations
} from './annotationStore'

/** In-memory cache of the active book's index so we don't re-read disk each query. */
let activeIndex: BookIndex | null = null

/** Returns the active index (or null if no book is indexed yet). */
export function getActiveIndex(): BookIndex | null {
  return activeIndex
}

export interface IndexingProgress {
  stage: 'checking' | 'chunking' | 'embedding' | 'saving' | 'ready'
  detail?: string
}

/**
 * Index a PDF book: chunk pages, embed, persist.
 * If a cached index exists on disk, loads it instead.
 * Calls `onProgress` so the UI can show indexing status.
 */
export async function indexPDFBook(
  buffer: ArrayBuffer,
  pages: { pageNum: number; text: string }[],
  onProgress?: (p: IndexingProgress) => void
): Promise<BookIndex> {
  onProgress?.({ stage: 'checking', detail: 'Checking for cached index…' })
  const bookHash = await hashBuffer(buffer)

  // Preload annotations for this book (non-blocking)
  loadAnnotations(bookHash).catch(() => {})

  // Try loading from disk cache
  const cached = await loadIndex(bookHash)
  if (cached) {
    activeIndex = cached
    onProgress?.({ stage: 'ready', detail: `Loaded ${cached.chunks.length} chunks from cache` })
    return cached
  }

  // Chunk
  onProgress?.({ stage: 'chunking', detail: 'Splitting book into chunks…' })
  const chunks = chunkPages(pages)

  if (chunks.length === 0) {
    const empty: BookIndex = { version: 1, bookHash, chunks: [], embeddings: [] }
    activeIndex = empty
    onProgress?.({ stage: 'ready', detail: 'No text to index' })
    return empty
  }

  // Embed
  onProgress?.({
    stage: 'embedding',
    detail: `Embedding ${chunks.length} chunks…`
  })
  const embeddings = await embedTexts(chunks.map((c) => c.text))

  // Persist
  onProgress?.({ stage: 'saving', detail: 'Saving index to disk…' })
  const index: BookIndex = { version: 1, bookHash, chunks, embeddings }
  await saveIndex(index)

  activeIndex = index
  onProgress?.({ stage: 'ready', detail: `Indexed ${chunks.length} chunks` })

  // Generate chapter summaries in background (non-blocking)
  // Group chunks by their source to form "chapters" for summarization
  const chapterMap = new Map<string, string>()
  for (const chunk of chunks) {
    const existing = chapterMap.get(chunk.source) ?? ''
    chapterMap.set(chunk.source, existing + ' ' + chunk.text)
  }
  const chapterEntries = Array.from(chapterMap.entries()).map(([id, text]) => ({ id, text }))
  generateChapterSummaries(bookHash, chapterEntries).catch(() => {})

  return index
}

/**
 * Index EPUB text (flat string per chapter).
 * Call once with all chapters concatenated or per-chapter.
 */
export async function indexEPUBBook(
  buffer: ArrayBuffer,
  chapters: { title: string; text: string }[],
  onProgress?: (p: IndexingProgress) => void
): Promise<BookIndex> {
  onProgress?.({ stage: 'checking', detail: 'Checking for cached index…' })
  const bookHash = await hashBuffer(buffer)

  // Preload annotations for this book (non-blocking)
  loadAnnotations(bookHash).catch(() => {})

  const cached = await loadIndex(bookHash)
  if (cached) {
    activeIndex = cached
    onProgress?.({ stage: 'ready', detail: `Loaded ${cached.chunks.length} chunks from cache` })
    return cached
  }

  onProgress?.({ stage: 'chunking', detail: 'Splitting book into chunks…' })
  const chunks: TextChunk[] = []
  let idx = 0
  for (const ch of chapters) {
    if (!ch.text.trim()) continue
    for (const chunk of chunkText(ch.text, ch.title)) {
      chunks.push({ ...chunk, index: idx++ })
    }
  }

  if (chunks.length === 0) {
    const empty: BookIndex = { version: 1, bookHash, chunks: [], embeddings: [] }
    activeIndex = empty
    onProgress?.({ stage: 'ready', detail: 'No text to index' })
    return empty
  }

  onProgress?.({
    stage: 'embedding',
    detail: `Embedding ${chunks.length} chunks…`
  })
  const embeddings = await embedTexts(chunks.map((c) => c.text))

  onProgress?.({ stage: 'saving', detail: 'Saving index to disk…' })
  const index: BookIndex = { version: 1, bookHash, chunks, embeddings }
  await saveIndex(index)

  activeIndex = index
  onProgress?.({ stage: 'ready', detail: `Indexed ${chunks.length} chunks` })

  // Generate chapter summaries in background (non-blocking)
  const chapterEntries = chapters.map((ch) => ({ id: ch.title, text: ch.text }))
  generateChapterSummaries(bookHash, chapterEntries).catch(() => {})

  return index
}

/** Annotation retrieval result for hybrid search */
interface AnnotationResult {
  text: string
  note: string
  source: string
  score: number
}

/**
 * Retrieve relevant passages for a query string.
 * Performs hybrid search: book chunks + user annotations (boosted).
 * Returns formatted context string ready to inject into the prompt,
 * or empty string if no index is available.
 */
export async function retrieveContext(
  query: string,
  topK = 5
): Promise<string> {
  if (!activeIndex || activeIndex.chunks.length === 0) return ''

  const qEmbed = await embedQuery(query)

  // 1. Book chunk results
  const bookResults = retrieve(activeIndex, qEmbed, topK)

  // 2. Annotation results (boosted)
  const annotationResults: AnnotationResult[] = []
  const annotStore = getActiveAnnotationStore()
  if (annotStore && annotStore.annotations.length > 0) {
    for (let i = 0; i < annotStore.annotations.length; i++) {
      const emb = annotStore.embeddings[i]
      if (!emb || emb.length === 0) continue
      const raw = cosineSimilarity(qEmbed, emb)
      const boosted = Math.min(raw * 1.15, 1.0) // 15% boost for user annotations
      annotationResults.push({
        text: annotStore.annotations[i].text,
        note: annotStore.annotations[i].note,
        source: annotStore.annotations[i].source,
        score: boosted
      })
    }
    annotationResults.sort((a, b) => b.score - a.score)
  }

  // 3. Merge and format — interleave book and annotation results by score
  type ScoredItem = { type: 'book' | 'annotation'; formatted: string; score: number }
  const merged: ScoredItem[] = []

  for (const r of bookResults) {
    if (r.score > 0.3) {
      merged.push({
        type: 'book',
        formatted: `[${r.chunk.source}] ${r.chunk.text}`,
        score: r.score
      })
    }
  }

  for (const r of annotationResults.slice(0, 3)) {
    if (r.score > 0.3) {
      merged.push({
        type: 'annotation',
        formatted: `[Your note @ ${r.source}] ${r.text}${r.note ? ' | Note: ' + r.note : ''}`,
        score: r.score
      })
    }
  }

  merged.sort((a, b) => b.score - a.score)
  const top = merged.slice(0, topK)

  if (top.length === 0) return ''
  return top.map((r) => r.formatted).join('\n\n---\n\n')
}

/** Clear the active index, annotations, and summary cache (e.g. when switching books). */
export function clearActiveIndex(): void {
  activeIndex = null
  clearSummaryCache()
  clearActiveAnnotations()
}
