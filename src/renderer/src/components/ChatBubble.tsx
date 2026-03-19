import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  const [copied, setCopied] = useState(false)

  const handleCopy = (): void => {
    navigator.clipboard.writeText(response).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

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

      {/* Thinking indicator */}
      {isStreaming && !response && (
        <div className="flex gap-1 items-center text-zinc-500 text-xs">
          <span className="streaming-cursor">|</span>
          <span>Thinking…</span>
        </div>
      )}

      {/* Response — markdown rendered */}
      {(response || isStreaming) && response && (
        <div className="group relative">
          {isError ? (
            <p className="text-sm leading-relaxed text-red-500 dark:text-red-400">{response}</p>
          ) : (
            <div className="prose-lumi text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {response + (isStreaming ? '▌' : '')}
              </ReactMarkdown>
            </div>
          )}

          {/* Copy button — appears on hover when response is complete */}
          {!isStreaming && !isError && response && (
            <button
              onClick={handleCopy}
              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-500 hover:text-zinc-300"
              title="Copy response"
            >
              {copied ? (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" className="text-emerald-400">
                  <path d="M11 3L5.5 8.5 2 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <rect x="4" y="4" width="8" height="8" rx="1.5"/>
                  <path d="M2 9V2h7" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
