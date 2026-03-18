import type { ChatMessage } from '../store/useReaderStore'

const chipStyles: Record<string, string> = {
  explain: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  translate: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  ask: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  free: 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400'
}

const chipLabels: Record<string, string> = {
  explain: 'Explain',
  translate: 'Translate',
  ask: 'Ask',
  free: 'Question'
}

interface ChatBubbleProps {
  message: ChatMessage
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const { actionType, snippet, userMessage, response, isStreaming, isError } = message

  return (
    <div className="flex flex-col gap-2 py-3 border-b border-zinc-200 dark:border-zinc-800/60 last:border-0">
      {/* Action chip + snippet */}
      <div className="flex items-start gap-2 flex-wrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${chipStyles[actionType] ?? chipStyles.free}`}
        >
          {chipLabels[actionType] ?? actionType}
        </span>
        {snippet && actionType !== 'free' && (
          <span className="text-zinc-500 text-xs italic leading-5 line-clamp-2">
            &ldquo;{snippet.length > 80 ? snippet.slice(0, 80) + '…' : snippet}&rdquo;
          </span>
        )}
        {actionType === 'free' && (
          <span className="text-zinc-600 dark:text-zinc-400 text-xs leading-5">{userMessage}</span>
        )}
      </div>

      {/* Response */}
      {(response || isStreaming) && (
        <div
          className={`text-sm leading-relaxed ${isError ? 'text-red-500 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300'} whitespace-pre-wrap`}
        >
          {response}
          {isStreaming && <span className="streaming-cursor ml-0.5 text-amber-400">|</span>}
        </div>
      )}

      {isStreaming && !response && (
        <div className="flex gap-1 items-center text-zinc-500 text-xs">
          <span className="streaming-cursor">|</span>
          <span>Thinking…</span>
        </div>
      )}
    </div>
  )
}
