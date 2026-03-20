import { create } from 'zustand'
import type { Annotation } from '../lib/annotationStore'

export type ActionType = 'explain' | 'translate' | 'ask' | 'free'

export interface OutlineItem {
  title: string
  id: string            // page number (PDF) or href (EPUB)
  children?: OutlineItem[]
}

export interface ChatMessage {
  id: string
  actionType: ActionType
  snippet: string
  userMessage: string
  response: string
  isStreaming: boolean
  isError: boolean
}

export interface ReaderFile {
  name: string
  path: string
  type: 'pdf' | 'epub'
  buffer: ArrayBuffer
}

export interface BookMeta {
  title: string
  author: string
}

export interface Selection {
  text: string
  context: string
  /** EPUB CFI for precise annotation positioning */
  cfi?: string
  /** PDF page number where the selection occurred */
  pageNum?: number
}

export interface ToolbarState {
  visible: boolean
  x: number
  y: number
}

interface ReaderState {
  theme: 'dark' | 'light'
  toggleTheme: () => void
  fontSize: number
  increaseFontSize: () => void
  decreaseFontSize: () => void
  resetFontSize: () => void
  translateTo: string
  setTranslateTo: (lang: string) => void
  file: ReaderFile | null
  bookMeta: BookMeta
  bookHash: string
  currentChapter: string
  selection: Selection | null
  toolbar: ToolbarState
  chat: ChatMessage[]
  annotations: Annotation[]

  // Actions
  setFile: (file: ReaderFile) => void
  setBookMeta: (meta: Partial<BookMeta>) => void
  setBookHash: (hash: string) => void
  setCurrentChapter: (chapter: string) => void
  setSelection: (selection: Selection | null) => void
  showToolbar: (x: number, y: number) => void
  hideToolbar: () => void
  addChatMessage: (msg: Omit<ChatMessage, 'id'>) => string
  appendToMessage: (id: string, delta: string) => void
  finishMessage: (id: string) => void
  setMessageError: (id: string, errorText: string) => void
  clearChat: () => void
  // Annotations
  setAnnotations: (annotations: Annotation[]) => void
  addAnnotationToStore: (annotation: Annotation) => void
  removeAnnotationFromStore: (id: string) => void
  // Navigation — registered by whichever reader is active
  goNext: (() => void) | null
  goPrev: (() => void) | null
  setNavigation: (goNext: () => void, goPrev: () => void) => void
  // Outline sidebar
  outline: OutlineItem[]
  outlineOpen: boolean
  navigateOutline: ((id: string) => void) | null
  setOutline: (outline: OutlineItem[]) => void
  setNavigateOutline: (fn: (id: string) => void) => void
  toggleOutline: () => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  file: null,
  bookMeta: { title: '', author: '' },
  bookHash: '',
  currentChapter: '',
  selection: null,
  toolbar: { visible: false, x: 0, y: 0 },
  chat: [],
  annotations: [],

  theme: 'dark',
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  fontSize: 17,
  increaseFontSize: () => set((s) => ({ fontSize: Math.min(s.fontSize + 1, 28) })),
  decreaseFontSize: () => set((s) => ({ fontSize: Math.max(s.fontSize - 1, 12) })),
  resetFontSize: () => set({ fontSize: 17 }),
  translateTo: 'en',
  setTranslateTo: (lang) => set({ translateTo: lang }),

  goNext: null,
  goPrev: null,
  setNavigation: (goNext, goPrev) => set({ goNext, goPrev }),

  outline: [],
  outlineOpen: false,
  navigateOutline: null,
  setOutline: (outline) => set({ outline }),
  setNavigateOutline: (fn) => set({ navigateOutline: fn }),
  toggleOutline: () => set((s) => ({ outlineOpen: !s.outlineOpen })),

  setFile: (file) => set({ file, chat: [], bookMeta: { title: '', author: '' }, bookHash: '', currentChapter: '', goNext: null, goPrev: null, outline: [], navigateOutline: null, annotations: [] }),
  setBookMeta: (meta) => set((s) => ({ bookMeta: { ...s.bookMeta, ...meta } })),
  setBookHash: (hash) => set({ bookHash: hash }),
  setCurrentChapter: (chapter) => set({ currentChapter: chapter }),
  setSelection: (selection) => set({ selection }),
  showToolbar: (x, y) => set({ toolbar: { visible: true, x, y } }),
  hideToolbar: () => set({ toolbar: { visible: false, x: 0, y: 0 }, selection: null }),

  // Annotations
  setAnnotations: (annotations) => set({ annotations }),
  addAnnotationToStore: (annotation) => set((s) => ({ annotations: [...s.annotations, annotation] })),
  removeAnnotationFromStore: (id) => set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),

  addChatMessage: (msg) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ chat: [...s.chat, { ...msg, id }] }))
    return id
  },

  appendToMessage: (id, delta) =>
    set((s) => ({
      chat: s.chat.map((m) => (m.id === id ? { ...m, response: m.response + delta } : m))
    })),

  finishMessage: (id) =>
    set((s) => ({
      chat: s.chat.map((m) => (m.id === id ? { ...m, isStreaming: false } : m))
    })),

  setMessageError: (id, errorText) =>
    set((s) => ({
      chat: s.chat.map((m) =>
        m.id === id ? { ...m, response: errorText, isStreaming: false, isError: true } : m
      )
    })),

  clearChat: () => set({ chat: [] })
}))
