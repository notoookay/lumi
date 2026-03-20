import { streamCompletion, type Message } from './openrouter'
import { buildContext, type ContextParams } from './contextBuilder'
import { useReaderStore } from '../store/useReaderStore'
import { retrieveContext } from './ragPipeline'
import { getMemoryContext } from './userMemory'

/** Tracks the active stream so it can be cancelled by a subsequent request. */
let activeController: AbortController | null = null

export function abortActiveStream(): void {
  activeController?.abort()
  activeController = null
}

export async function runStreamAction(params: ContextParams): Promise<void> {
  // Cancel any in-flight stream before starting a new one
  abortActiveStream()

  const controller = new AbortController()
  activeController = controller

  const store = useReaderStore.getState()

  // Retrieve relevant passages from the book's RAG index (non-blocking — skip if it fails)
  let ragContext = ''
  if (params.actionType !== 'translate') {
    const query = params.userQuestion || params.selectedText
    try {
      ragContext = await retrieveContext(query)
    } catch {
      // RAG retrieval failed — proceed without it
    }
  }

  // Load cross-book user memory (non-blocking — skip if it fails)
  let userMemory = ''
  if (params.actionType !== 'translate') {
    try {
      userMemory = await getMemoryContext()
    } catch {
      // Memory load failed — proceed without it
    }
  }

  const { systemPrompt, userMessage } = buildContext({ ...params, ragContext, userMemory })

  // Conversation memory: pass last 3 completed exchanges as history so the
  // model can reference prior Q&A within the same reading session.
  const history: Message[] = store.chat
    .filter((m) => !m.isStreaming && !m.isError && m.response)
    .slice(-3)
    .flatMap((m) => [
      { role: 'user' as const, content: m.userMessage },
      { role: 'assistant' as const, content: m.response }
    ])

  const messages: Message[] = [...history, { role: 'user', content: userMessage }]

  const id = store.addChatMessage({
    actionType: params.actionType,
    snippet: params.selectedText.slice(0, 120),
    userMessage,
    response: '',
    isStreaming: true,
    isError: false
  })

  try {
    // Batch deltas and flush via rAF to avoid a re-render per SSE chunk
    let pending = ''
    let rafId: number | null = null

    const flush = (): void => {
      if (!pending) return
      useReaderStore.getState().appendToMessage(id, pending)
      pending = ''
      rafId = null
    }

    for await (const delta of streamCompletion({
      messages,
      systemPrompt,
      actionType: params.actionType,
      signal: controller.signal
    })) {
      pending += delta
      if (rafId === null) {
        rafId = requestAnimationFrame(flush)
      }
    }

    // Flush any remaining buffered text
    if (rafId !== null) cancelAnimationFrame(rafId)
    flush()

    useReaderStore.getState().finishMessage(id)
  } catch (err) {
    if (controller.signal.aborted) return // intentional cancel — no error

    const msg =
      err instanceof Error && err.message
        ? `Lumi couldn't reach the AI — ${err.message}`
        : "Lumi couldn't reach the AI — check your API key"
    useReaderStore.getState().setMessageError(id, msg)
  } finally {
    if (activeController === controller) activeController = null
  }
}
