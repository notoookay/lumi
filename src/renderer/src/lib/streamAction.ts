import { streamCompletion, type Message } from './openrouter'
import { buildContext, type ContextParams } from './contextBuilder'
import { useReaderStore } from '../store/useReaderStore'

export async function runStreamAction(params: ContextParams): Promise<void> {
  const store = useReaderStore.getState()
  const { systemPrompt, userMessage } = buildContext(params)

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
    for await (const delta of streamCompletion(messages, systemPrompt)) {
      useReaderStore.getState().appendToMessage(id, delta)
    }
    useReaderStore.getState().finishMessage(id)
  } catch (err) {
    const msg =
      err instanceof Error && err.message
        ? `Lumi couldn't reach the AI — ${err.message}`
        : "Lumi couldn't reach the AI — check your API key"
    useReaderStore.getState().setMessageError(id, msg)
  }
}
