/**
 * Chapter Summary Cache — generates and persists short summaries of
 * each chapter/section using the LLM, then provides a "story so far"
 * context string for any given page/chapter location.
 *
 * Summaries are stored alongside the RAG index in the app userData
 * folder, keyed by book hash.
 */

interface ChapterSummary {
  /** Chapter identifier (e.g. "p1-p10" or chapter href) */
  id: string
  /** Short summary text */
  summary: string
}

interface SummaryCache {
  version: number
  bookHash: string
  summaries: ChapterSummary[]
}

const CACHE_VERSION = 1

/** Load summaries from disk */
async function loadSummaryCache(bookHash: string): Promise<SummaryCache | null> {
  const raw = await window.electronAPI.ragLoad(`${bookHash}_summaries`)
  if (!raw) return null
  try {
    const parsed: SummaryCache = JSON.parse(raw)
    if (parsed.version !== CACHE_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

/** Save summaries to disk */
async function saveSummaryCache(cache: SummaryCache): Promise<void> {
  await window.electronAPI.ragSave(`${cache.bookHash}_summaries`, JSON.stringify(cache))
}

/** In-memory cache for the active book */
let activeCache: SummaryCache | null = null

export function getActiveSummaryCache(): SummaryCache | null {
  return activeCache
}

/**
 * Generate summaries for chapters that don't have one yet.
 * Uses a non-streaming LLM call (single response) for each chapter.
 *
 * `chapters` is an array of { id, text } where id is the chapter identifier
 * and text is the full chapter text (or first ~3000 chars for cost reasons).
 */
export async function generateChapterSummaries(
  bookHash: string,
  chapters: { id: string; text: string }[],
  onProgress?: (done: number, total: number) => void
): Promise<SummaryCache> {
  // Load existing cache
  const existing = await loadSummaryCache(bookHash)
  if (existing && existing.summaries.length >= chapters.length) {
    activeCache = existing
    return existing
  }

  const existingIds = new Set(existing?.summaries.map((s) => s.id) ?? [])
  const summaries: ChapterSummary[] = [...(existing?.summaries ?? [])]
  const toGenerate = chapters.filter((ch) => !existingIds.has(ch.id))

  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) {
    const cache: SummaryCache = { version: CACHE_VERSION, bookHash, summaries }
    activeCache = cache
    return cache
  }

  let done = summaries.length
  const total = chapters.length

  for (const ch of toGenerate) {
    try {
      // Take first ~3000 chars to keep cost low
      const excerpt = ch.text.slice(0, 3000)
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'lumi-app',
          'X-Title': 'Lumi'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          temperature: 0.2,
          max_tokens: 200,
          messages: [
            {
              role: 'system',
              content:
                'You are a book summarizer. Write a 2-3 sentence summary of the following chapter excerpt. ' +
                'Focus on key events, arguments, or concepts introduced. Be factual and concise.'
            },
            {
              role: 'user',
              content: excerpt
            }
          ]
        })
      })

      if (res.ok) {
        const json = await res.json()
        const text = json.choices?.[0]?.message?.content?.trim()
        if (text) {
          summaries.push({ id: ch.id, summary: text })
        }
      }
    } catch {
      // Skip failed chapters
    }

    done++
    onProgress?.(done, total)
  }

  const cache: SummaryCache = { version: CACHE_VERSION, bookHash, summaries }
  await saveSummaryCache(cache)
  activeCache = cache
  return cache
}

/**
 * Build a "Story so far" string from chapter summaries up to the current position.
 *
 * For PDF: `currentId` is like "p42" — we include summaries for chapters
 * whose page range ends before page 42.
 * For EPUB: `currentId` is a chapter href — we include all summaries
 * for chapters that appear before it in the spine order.
 *
 * @param currentId - current chapter/page identifier
 * @param chapterIds - ordered list of all chapter ids (for ordering)
 */
export function buildStorySoFar(
  currentId: string,
  chapterIds: string[]
): string {
  if (!activeCache || activeCache.summaries.length === 0) return ''

  const currentIdx = chapterIds.indexOf(currentId)
  if (currentIdx <= 0) return ''

  // Get summaries for all chapters before the current one
  const previousIds = new Set(chapterIds.slice(0, currentIdx))
  const relevantSummaries = activeCache.summaries.filter((s) => previousIds.has(s.id))

  if (relevantSummaries.length === 0) return ''

  return (
    '**Story so far (summaries of previous chapters):**\n' +
    relevantSummaries.map((s) => `- **${s.id}**: ${s.summary}`).join('\n')
  )
}

/** Clear the active cache (e.g. when switching books). */
export function clearSummaryCache(): void {
  activeCache = null
}
