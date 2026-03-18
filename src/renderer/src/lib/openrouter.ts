export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function* streamCompletion(
  messages: Message[],
  systemPrompt: string
): AsyncGenerator<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) throw new Error('VITE_OPENROUTER_API_KEY is not set')

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
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${text}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
        try {
          const json = JSON.parse(trimmed.slice(5).trim())
          const delta = json.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch {
          // malformed SSE line — skip
        }
      }
    }
  }
}
