import type { ActionType } from '../store/useReaderStore'

export interface ContextParams {
  actionType: ActionType
  selectedText: string
  surroundingContext: string
  chapterTitle: string
  bookTitle: string
  bookAuthor: string
  bookType?: 'pdf' | 'epub'
  pageNumber?: number
  userQuestion?: string
}

export interface BuiltContext {
  systemPrompt: string
  userMessage: string
}

export function buildContext(params: ContextParams): BuiltContext {
  const {
    actionType,
    selectedText,
    surroundingContext,
    chapterTitle,
    bookTitle,
    bookAuthor,
    bookType,
    pageNumber,
    userQuestion
  } = params

  // Build location string: "Chapter 3 · page 42" or just "Chapter 3"
  const locationParts: string[] = []
  if (chapterTitle) locationParts.push(chapterTitle)
  if (pageNumber) locationParts.push(`page ${pageNumber}`)
  const location = locationParts.join(' · ') || 'Unknown section'

  const systemPrompt =
    `You are Lumi, an AI reading assistant embedded in a desktop book reader.\n` +
    `Book: ${bookTitle || 'Unknown'}${bookAuthor ? ` by ${bookAuthor}` : ''}` +
    (bookType ? ` (${bookType.toUpperCase()})` : '') +
    `\nCurrent location: ${location}\n` +
    `Instructions: Be concise and insightful. Use markdown formatting where it aids clarity ` +
    `(e.g. **bold** for key terms, bullet points for lists, > for quotes). ` +
    `Do not add unnecessary preamble — get straight to the answer.`

  let userMessage: string

  switch (actionType) {
    case 'explain':
      userMessage =
        `Explain this passage clearly and simply:\n\n> "${selectedText}"` +
        (surroundingContext ? `\n\n**Surrounding context:**\n${surroundingContext}` : '')
      break

    case 'translate':
      // translate is handled by Google Translate — this fallback is for the LLM path
      userMessage = `Translate this text to English, preserving the original tone and style:\n\n> "${selectedText}"`
      break

    case 'ask':
      userMessage =
        `**Selected passage:**\n> "${selectedText}"\n` +
        (surroundingContext ? `\n**Context:**\n${surroundingContext}\n` : '\n') +
        `\n**Question:** ${userQuestion ?? ''}`
      break

    case 'free':
      userMessage = `The reader is at "${location}" and asks: ${userQuestion ?? ''}`
      break
  }

  return { systemPrompt, userMessage }
}

export function buildSurroundingContext(
  fullText: string,
  selectedText: string,
  charRadius = 600
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
