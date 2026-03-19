import type { ChatMessage } from '../store/useReaderStore'

const ACTION_LABELS: Record<string, string> = {
  explain: 'Explain',
  translate: 'Translate',
  ask: 'Ask',
  free: 'Question'
}

export function exportNotesAsMarkdown(
  chat: ChatMessage[],
  bookTitle: string,
  bookAuthor: string
): void {
  const completed = chat.filter((m) => !m.isError && !m.isStreaming && m.response)
  if (completed.length === 0) return

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const lines: string[] = [
    `# Lumi Notes — ${bookTitle || 'Untitled'}`,
    '',
    bookAuthor ? `**Author:** ${bookAuthor}  ` : '',
    `**Exported:** ${date}`,
    '',
    '---',
    ''
  ].filter((l) => l !== undefined)

  for (const msg of completed) {
    const label = ACTION_LABELS[msg.actionType] ?? msg.actionType

    lines.push(`## ${label}`)
    lines.push('')

    // Show the quoted snippet for non-free actions
    if (msg.snippet && msg.actionType !== 'free') {
      const snippet = msg.snippet.length >= 120 ? msg.snippet + '…' : msg.snippet
      lines.push(`> "${snippet}"`)
      lines.push('')
    }

    // For free/ask, show the user question
    if (msg.actionType === 'free' || msg.actionType === 'ask') {
      lines.push(`**Question:** ${msg.userMessage.replace(/^.*?asks?:\s*/i, '')}`)
      lines.push('')
    }

    lines.push(msg.response)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  const markdown = lines.join('\n')
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  const safeName = (bookTitle || 'lumi-notes').replace(/[^a-z0-9]/gi, '-').toLowerCase()
  anchor.download = `${safeName}-notes.md`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
