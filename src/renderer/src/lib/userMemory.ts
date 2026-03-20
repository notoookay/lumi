/**
 * User Memory — cross-book persistent memory about the reader.
 *
 * Stores short factual entries (preferences, knowledge connections,
 * reading insights) that persist across books. Injected into every
 * LLM system prompt as bullet points.
 *
 * Memory entries are auto-extracted from chat sessions on book switch,
 * or can be added/removed manually.
 */

import type { ChatMessage } from '../store/useReaderStore'

export interface MemoryEntry {
  id: string
  type: 'fact' | 'preference' | 'insight'
  content: string
  bookTitle?: string
  createdAt: number
}

interface UserMemory {
  version: number
  entries: MemoryEntry[]
}

const MEMORY_VERSION = 1
const MAX_ENTRIES = 50
const MAX_CONTEXT_CHARS = 2000

/** In-memory cache */
let memoryCache: UserMemory | null = null

/** Load user memory from disk. */
export async function loadUserMemory(): Promise<UserMemory> {
  if (memoryCache) return memoryCache

  const raw = await window.electronAPI.ragLoad('_user_memory')
  if (raw) {
    try {
      const parsed: UserMemory = JSON.parse(raw)
      if (parsed.version === MEMORY_VERSION) {
        memoryCache = parsed
        return parsed
      }
    } catch {
      // corrupted — start fresh
    }
  }

  const fresh: UserMemory = { version: MEMORY_VERSION, entries: [] }
  memoryCache = fresh
  return fresh
}

/** Persist user memory to disk. */
async function saveUserMemory(memory: UserMemory): Promise<void> {
  memoryCache = memory
  await window.electronAPI.ragSave('_user_memory', JSON.stringify(memory))
}

/** Add a memory entry. Enforces MAX_ENTRIES by dropping oldest. */
export async function addMemoryEntry(
  params: Omit<MemoryEntry, 'id' | 'createdAt'>
): Promise<MemoryEntry> {
  const memory = await loadUserMemory()
  const entry: MemoryEntry = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    ...params,
    createdAt: Date.now()
  }

  memory.entries.push(entry)
  // Cap at MAX_ENTRIES, keeping newest
  if (memory.entries.length > MAX_ENTRIES) {
    memory.entries = memory.entries.slice(-MAX_ENTRIES)
  }

  await saveUserMemory(memory)
  return entry
}

/** Remove a memory entry by ID. */
export async function removeMemoryEntry(id: string): Promise<void> {
  const memory = await loadUserMemory()
  memory.entries = memory.entries.filter((e) => e.id !== id)
  await saveUserMemory(memory)
}

/**
 * Build a formatted context string for injection into the LLM system prompt.
 * Returns empty string if no memories exist.
 */
export async function getMemoryContext(): Promise<string> {
  const memory = await loadUserMemory()
  if (memory.entries.length === 0) return ''

  let result = ''
  // Most recent entries first for relevance
  const sorted = [...memory.entries].sort((a, b) => b.createdAt - a.createdAt)

  for (const entry of sorted) {
    const line = `- ${entry.content}${entry.bookTitle ? ` (from "${entry.bookTitle}")` : ''}\n`
    if (result.length + line.length > MAX_CONTEXT_CHARS) break
    result += line
  }

  return result.trim()
}

/**
 * Extract memorable facts from a chat session using an LLM call.
 * Called on book switch to capture insights before chat is cleared.
 *
 * Fires a non-streaming completion asking for 0-3 facts worth remembering.
 */
export async function extractMemoriesFromChat(
  chat: ChatMessage[],
  bookTitle: string
): Promise<void> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) return

  // Only process completed, non-error messages
  const messages = chat.filter((m) => !m.isStreaming && !m.isError && m.response)
  if (messages.length === 0) return

  // Build a summary of the conversation
  const conversationText = messages
    .map((m) => `User: ${m.userMessage}\nAssistant: ${m.response}`)
    .slice(-5) // Last 5 exchanges at most
    .join('\n---\n')
    .slice(0, 3000) // Cap total size

  try {
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
        temperature: 0.1,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content:
              'You extract memorable facts about a reader from their conversation with a reading assistant. ' +
              'Return a JSON array of 0-3 objects with { "type": "fact"|"preference"|"insight", "content": "..." }. ' +
              'Only include genuinely useful information worth remembering across books: ' +
              'reader preferences, knowledge level, interests, or key takeaways. ' +
              'Each content string should be under 150 characters. ' +
              'Return an empty array [] if nothing is worth remembering. ' +
              'Return ONLY the JSON array, no other text.'
          },
          {
            role: 'user',
            content: `Book: "${bookTitle}"\n\nConversation:\n${conversationText}`
          }
        ]
      })
    })

    if (!res.ok) return

    const json = await res.json()
    const text = json.choices?.[0]?.message?.content?.trim()
    if (!text) return

    // Parse the JSON response
    let entries: { type: string; content: string }[]
    try {
      // Handle possible markdown code fences
      const cleaned = text.replace(/^```json?\s*/, '').replace(/\s*```$/, '')
      entries = JSON.parse(cleaned)
    } catch {
      return
    }

    if (!Array.isArray(entries)) return

    // Load existing memory for deduplication
    const memory = await loadUserMemory()
    const existingContents = new Set(
      memory.entries.map((e) => e.content.toLowerCase().trim())
    )

    for (const entry of entries.slice(0, 3)) {
      if (!entry.content || !entry.type) continue
      const content = entry.content.slice(0, 150)
      const type = (['fact', 'preference', 'insight'].includes(entry.type)
        ? entry.type
        : 'fact') as MemoryEntry['type']

      // Simple deduplication: skip if very similar content already exists
      const lower = content.toLowerCase().trim()
      if (existingContents.has(lower)) continue

      // Check for substring overlap (catch near-duplicates)
      let isDuplicate = false
      for (const existing of existingContents) {
        if (existing.includes(lower.slice(0, 40)) || lower.includes(existing.slice(0, 40))) {
          isDuplicate = true
          break
        }
      }
      if (isDuplicate) continue

      await addMemoryEntry({ type, content, bookTitle })
      existingContents.add(lower)
    }
  } catch {
    // Extraction failed — not critical, skip silently
  }
}

/** Get all memory entries for UI display. */
export async function getAllMemoryEntries(): Promise<MemoryEntry[]> {
  const memory = await loadUserMemory()
  return [...memory.entries].sort((a, b) => b.createdAt - a.createdAt)
}
