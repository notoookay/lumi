/**
 * Annotation Store — per-book highlights and notes with embeddings.
 *
 * Annotations are persisted to `{userData}/lumi-rag/{bookHash}_annotations.json`
 * via the same IPC bridge used for RAG indexes. Each annotation gets an
 * embedding vector so it can participate in hybrid retrieval.
 */

import { embedTexts } from './embeddings'

export interface Annotation {
  id: string
  /** Highlighted text verbatim */
  text: string
  /** User's optional note (empty string if none) */
  note: string
  /** Location: "p42" (PDF) or chapter href (EPUB) */
  source: string
  /** EPUB CFI for precise re-rendering */
  cfi?: string
  /** PDF page number */
  pageNum?: number
  /** Unix ms timestamp */
  createdAt: number
}

export interface AnnotationStoreData {
  version: number
  bookHash: string
  annotations: Annotation[]
  /** Parallel array — one embedding per annotation */
  embeddings: number[][]
}

const STORE_VERSION = 1

/** In-memory cache for the active book's annotations */
let activeStore: AnnotationStoreData | null = null

/** Returns the active annotation store (or null if none loaded). */
export function getActiveAnnotationStore(): AnnotationStoreData | null {
  return activeStore
}

/** Load annotations from disk for a given book. */
export async function loadAnnotations(bookHash: string): Promise<AnnotationStoreData | null> {
  const raw = await window.electronAPI.ragLoad(`${bookHash}_annotations`)
  if (!raw) return null
  try {
    const parsed: AnnotationStoreData = JSON.parse(raw)
    if (parsed.version !== STORE_VERSION) return null
    activeStore = parsed
    return parsed
  } catch {
    return null
  }
}

/** Persist annotations to disk. */
async function saveAnnotations(store: AnnotationStoreData): Promise<void> {
  await window.electronAPI.ragSave(`${store.bookHash}_annotations`, JSON.stringify(store))
}

/** Ensure an active store exists for the given bookHash. */
async function ensureStore(bookHash: string): Promise<AnnotationStoreData> {
  if (activeStore && activeStore.bookHash === bookHash) return activeStore
  const loaded = await loadAnnotations(bookHash)
  if (loaded) return loaded
  const fresh: AnnotationStoreData = {
    version: STORE_VERSION,
    bookHash,
    annotations: [],
    embeddings: []
  }
  activeStore = fresh
  return fresh
}

/**
 * Add a new annotation. Computes its embedding, persists to disk,
 * and returns the created Annotation object.
 */
export async function addAnnotation(
  bookHash: string,
  params: {
    text: string
    note: string
    source: string
    cfi?: string
    pageNum?: number
  }
): Promise<Annotation> {
  const store = await ensureStore(bookHash)

  const annotation: Annotation = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    text: params.text,
    note: params.note,
    source: params.source,
    cfi: params.cfi,
    pageNum: params.pageNum,
    createdAt: Date.now()
  }

  // Compute embedding for the annotation (text + note combined)
  const embeddingInput = params.text + (params.note ? ' | Note: ' + params.note : '')
  let embedding: number[] = []
  try {
    const [emb] = await embedTexts([embeddingInput])
    embedding = emb
  } catch {
    // Embedding failed — store annotation without embedding (won't appear in RAG, but still saved)
    embedding = []
  }

  store.annotations.push(annotation)
  store.embeddings.push(embedding)
  await saveAnnotations(store)

  return annotation
}

/** Remove an annotation by ID. Splices both the annotation and its embedding. */
export async function removeAnnotation(bookHash: string, annotationId: string): Promise<void> {
  const store = await ensureStore(bookHash)
  const idx = store.annotations.findIndex((a) => a.id === annotationId)
  if (idx === -1) return
  store.annotations.splice(idx, 1)
  store.embeddings.splice(idx, 1)
  await saveAnnotations(store)
}

/** Clear the active annotation store (e.g. when switching books). */
export function clearActiveAnnotations(): void {
  activeStore = null
}
