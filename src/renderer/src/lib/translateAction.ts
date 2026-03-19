import { translateText, LANGUAGES } from './googleTranslate'
import { useReaderStore } from '../store/useReaderStore'

export async function runTranslateAction(selectedText: string, targetLang: string): Promise<void> {
  const store = useReaderStore.getState()
  const targetName = LANGUAGES.find((l) => l.code === targetLang)?.name ?? targetLang

  const id = store.addChatMessage({
    actionType: 'translate',
    snippet: selectedText.slice(0, 120),
    userMessage: `Translate to ${targetName}`,
    response: '',
    isStreaming: true,
    isError: false
  })

  try {
    const { translatedText, detectedSourceName } = await translateText(selectedText, targetLang)

    const formatted =
      `**${detectedSourceName} → ${targetName}**\n\n${translatedText}`

    useReaderStore.getState().appendToMessage(id, formatted)
    useReaderStore.getState().finishMessage(id)
  } catch (err) {
    const msg =
      err instanceof Error
        ? `Translation failed — ${err.message}`
        : 'Translation failed — check your connection'
    useReaderStore.getState().setMessageError(id, msg)
  }
}
