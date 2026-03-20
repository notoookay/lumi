/**
 * Vector store — persists chunk embeddings to disk via IPC, runs similarity
 * search in-renderer for speed.
 *
 * Storage layout (in app userData):
 *   lumi-rag/<bookHash>.json  →  { chunks, embeddings, version }
 *
 * The book hash is a SHA-256 of the raw file buffer, so re-opening the same
 * file reuses the cached index.
 */

import type { TextChunk } from './chunker'
import type { Embedding } from './embeddings'

export interface BookIndex {
  version: number
  bookHash: string
  chunks: TextChunk[]
  embeddings: Embedding[]
}

const INDEX_VERSION = 1

/** SHA-256 hex digest of an ArrayBuffer */
export async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Save a book index to disk via main process IPC */
export async function saveIndex(index: BookIndex): Promise<void> {
  await window.electronAPI.ragSave(index.bookHash, JSON.stringify(index))
}

/** Load a book index from disk. Returns null if not found or version mismatch. */
export async function loadIndex(bookHash: string): Promise<BookIndex | null> {
  const raw = await window.electronAPI.ragLoad(bookHash)
  if (!raw) return null
  try {
    const parsed: BookIndex = JSON.parse(raw)
    if (parsed.version !== INDEX_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

/** Cosine similarity between two vectors */
export function cosineSimilarity(a: Embedding, b: Embedding): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1)
}

export interface RetrievalResult {
  chunk: TextChunk
  score: number
}

/**
 * Retrieve top-k chunks most similar to the query embedding.
 */
export function retrieve(
  index: BookIndex,
  queryEmbedding: Embedding,
  topK = 5
): RetrievalResult[] {
  const scored = index.chunks.map((chunk, i) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, index.embeddings[i])
  }))

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}
