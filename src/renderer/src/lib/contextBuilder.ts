import type { ActionType } from '../store/useReaderStore'

export interface ContextParams {
  actionType: ActionType
  selectedText: string
  surroundingContext: string
  chapterTitle: string
  bookTitle: string
  bookAuthor: string
  userQuestion?: string
}

export interface BuiltContext {
  systemPrompt: string
  userMessage: string
}

export function buildContext(params: ContextParams): BuiltContext {
  const { actionType, selectedText, surroundingContext, chapterTitle, bookTitle, bookAuthor, userQuestion } = params

  const systemPrompt =
    `You are Lumi, an AI reading assistant embedded in a desktop book reader.\n` +
    `Book: ${bookTitle || 'Unknown'}${bookAuthor ? ` by ${bookAuthor}` : ''}\n` +
    `Current section: ${chapterTitle || 'Unknown'}\n` +
    `Be concise and clear. Illuminate the text for the reader.`

  let userMessage: string

  switch (actionType) {
    case 'explain':
      userMessage =
        `Explain this passage simply:\n\n"${selectedText}"` +
        (surroundingContext ? `\n\nContext: ${surroundingContext}` : '')
      break

    case 'translate':
      userMessage = `Translate to English, preserving tone:\n\n"${selectedText}"`
      break

    case 'ask':
      userMessage =
        `Selected passage: "${selectedText}"\n` +
        (surroundingContext ? `Context: ${surroundingContext}\n\n` : '\n') +
        `Question: ${userQuestion ?? ''}`
      break

    case 'free':
      userMessage = `The user is reading "${chapterTitle || bookTitle}" and asks: ${userQuestion ?? ''}`
      break
  }

  return { systemPrompt, userMessage }
}

export function buildSurroundingContext(
  fullText: string,
  selectedText: string,
  charRadius = 400
): string {
  const idx = fullText.indexOf(selectedText)
  if (idx === -1) return ''
  const start = Math.max(0, idx - charRadius)
  const end = Math.min(fullText.length, idx + selectedText.length + charRadius)
  let ctx = fullText.slice(start, end)
  if (start > 0) ctx = '…' + ctx
  if (end < fullText.length) ctx = ctx + '…'
  return ctx
}
