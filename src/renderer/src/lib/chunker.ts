/**
 * Splits book text into overlapping chunks suitable for embedding.
 *
 * Strategy: paragraph-aware chunking with a token budget (~500 tokens ≈ ~2000 chars).
 * Paragraphs are kept whole when possible. A sliding overlap ensures context
 * continuity across chunk boundaries.
 */

export interface TextChunk {
  /** Sequential index within the book */
  index: number
  /** The chunk text */
  text: string
  /** Source metadata — page number (PDF) or chapter title */
  source: string
}

interface ChunkOptions {
  /** Target chunk size in characters (default 2000 ≈ 500 tokens) */
  maxChars?: number
  /** Overlap between consecutive chunks in characters (default 200) */
  overlap?: number
}

/**
 * Chunk an array of pages (PDF) into overlapping windows.
 * Each page's text is split on paragraph boundaries first.
 */
export function chunkPages(
  pages: { pageNum: number; text: string }[],
  opts: ChunkOptions = {}
): TextChunk[] {
  const maxChars = opts.maxChars ?? 2000
  const overlap = opts.overlap ?? 200

  const chunks: TextChunk[] = []
  let buffer = ''
  let bufferSource = ''
  let idx = 0

  for (const page of pages) {
    // Split page text into paragraphs (double newline or sentence-end heuristic)
    const paragraphs = page.text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)

    // If page has no paragraph breaks, treat the whole page as one block
    const blocks = paragraphs.length > 0 ? paragraphs : [page.text.trim()]

    for (const block of blocks) {
      if (!block) continue

      // If adding this block exceeds max, flush the buffer
      if (buffer.length + block.length + 1 > maxChars && buffer.length > 0) {
        chunks.push({ index: idx++, text: buffer.trim(), source: bufferSource })

        // Keep the tail as overlap for the next chunk
        const tail = buffer.slice(-overlap)
        buffer = tail
        bufferSource = `p${page.pageNum}`
      }

      buffer += (buffer ? ' ' : '') + block
      if (!bufferSource) bufferSource = `p${page.pageNum}`
      // Track source as range: "p3-p5"
      const currentPage = `p${page.pageNum}`
      if (bufferSource !== currentPage && !bufferSource.includes('-')) {
        bufferSource = `${bufferSource}-${currentPage}`
      } else if (bufferSource.includes('-')) {
        bufferSource = bufferSource.replace(/-p\d+$/, `-${currentPage}`)
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim()) {
    chunks.push({ index: idx++, text: buffer.trim(), source: bufferSource })
  }

  return chunks
}

/**
 * Chunk a flat string of text (e.g. from EPUB chapter).
 * `source` will be the provided label (chapter title).
 */
export function chunkText(
  text: string,
  source: string,
  opts: ChunkOptions = {}
): TextChunk[] {
  const maxChars = opts.maxChars ?? 2000
  const overlap = opts.overlap ?? 200

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  const chunks: TextChunk[] = []
  let buffer = ''
  let idx = 0

  for (const para of paragraphs) {
    if (buffer.length + para.length + 1 > maxChars && buffer.length > 0) {
      chunks.push({ index: idx++, text: buffer.trim(), source })
      buffer = buffer.slice(-overlap)
    }
    buffer += (buffer ? ' ' : '') + para
  }

  if (buffer.trim()) {
    chunks.push({ index: idx++, text: buffer.trim(), source })
  }

  return chunks
}
