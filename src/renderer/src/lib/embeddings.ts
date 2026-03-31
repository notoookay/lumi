/**
 * Embedding client — calls OpenRouter's embedding endpoint.
 *
 * Uses a lightweight model (google/text-embedding-004 via OpenRouter)
 * to embed text chunks for RAG retrieval.
 */

const EMBEDDING_MODEL = 'google/text-embedding-004'
const BATCH_SIZE = 64 // max texts per API call

export type Embedding = number[]

/**
 * Embed a batch of texts. Returns one embedding vector per input text.
 * Automatically splits into sub-batches if the input exceeds BATCH_SIZE.
 */
export async function embedTexts(
  texts: string[],
  signal?: AbortSignal
): Promise<Embedding[]> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) throw new Error('VITE_OPENROUTER_API_KEY is not set')

  const results: Embedding[] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const batch = texts.slice(i, i + BATCH_SIZE)

    // 30s timeout per batch — combine with caller's signal if provided
    const timeout = AbortSignal.timeout(30_000)
    const batchSignal = signal
      ? AbortSignal.any([signal, timeout])
      : timeout

    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'lumi-app',
        'X-Title': 'Lumi'
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch
      }),
      signal: batchSignal
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Embedding error ${res.status}: ${text}`)
    }

    const json = await res.json()
    // Response data is sorted by index
    const sorted = (json.data as { index: number; embedding: number[] }[]).sort(
      (a, b) => a.index - b.index
    )
    results.push(...sorted.map((d) => d.embedding))
  }

  return results
}

/**
 * Embed a single query string. Convenience wrapper.
 */
export async function embedQuery(
  text: string,
  signal?: AbortSignal
): Promise<Embedding> {
  const [embedding] = await embedTexts([text], signal)
  return embedding
}
