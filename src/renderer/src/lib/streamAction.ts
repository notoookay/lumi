import { streamCompletion, type Message } from './openrouter'
import { buildContext, type ContextParams } from './contextBuilder'
import { useReaderStore } from '../store/useReaderStore'

export async function runStreamAction(params: ContextParams): Promise<void> {
  const store = useReaderStore.getState()
  const { systemPrompt, userMessage } = buildContext(params)

  const messages: Message[] = [{ role: 'user', content: userMessage }]

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
