import type { ActionType } from '../store/useReaderStore'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  messages: Message[]
  systemPrompt: string
  actionType?: ActionType
  signal?: AbortSignal
}

/** Per-action tuning: factual tasks get low temperature, open-ended gets more. */
function modelParams(actionType?: ActionType): {
  temperature: number
  max_tokens: number
} {
  switch (actionType) {
    case 'explain':
    case 'translate':
      return { temperature: 0.3, max_tokens: 600 }
    case 'ask':
      return { temperature: 0.4, max_tokens: 800 }
    case 'free':
      return { temperature: 0.7, max_tokens: 1024 }
    default:
      return { temperature: 0.5, max_tokens: 800 }
  }
}

export async function* streamCompletion(
  opts: CompletionOptions
): AsyncGenerator<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) throw new Error('VITE_OPENROUTER_API_KEY is not set')

  const { messages, systemPrompt, actionType, signal } = opts
  const { temperature, max_tokens } = modelParams(actionType)

  // 60s timeout — streaming responses can take a while, but shouldn't hang forever
  const timeout = AbortSignal.timeout(60_000)
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeout])
    : timeout

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
      stream: true,
      temperature,
      max_tokens,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    }),
    signal: combinedSignal
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${text}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process only complete lines; keep the trailing partial in buffer
    const lines = buffer.split('\n')
    buffer = lines.pop()! // last element is either '' or a partial line

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:') || trimmed.includes('[DONE]')) continue
      try {
        const json = JSON.parse(trimmed.slice(5).trim())
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        // malformed SSE line — skip
      }
    }
  }

  // Flush any remaining complete data in the buffer
  if (buffer.trim().startsWith('data:') && !buffer.includes('[DONE]')) {
    try {
      const json = JSON.parse(buffer.trim().slice(5).trim())
      const delta = json.choices?.[0]?.delta?.content
      if (delta) yield delta
    } catch {
      // skip
    }
  }
}
