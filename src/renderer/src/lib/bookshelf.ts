const SHELF_KEY = 'lumi-bookshelf'
const MAX_ENTRIES = 24

export interface BookshelfEntry {
  filePath: string
  fileName: string
  title: string
  author: string
  type: 'pdf' | 'epub'
  lastOpened: number // Unix ms timestamp
  coverColor: string
}

// A palette of muted, book-spine-like colours
const COVER_PALETTE = [
  '#4A3728', // warm brown
  '#2C3E50', // navy
  '#1B4332', // forest green
  '#4A235A', // plum
  '#7B341E', // burnt sienna
  '#1A3A4A', // dark teal
  '#3D1A24', // burgundy
  '#2D3561', // indigo
  '#3B2F00', // dark gold
  '#1C3A2A', // dark emerald
  '#4A3000', // dark amber
  '#2A1A3E', // dark violet
]

function coverColorFor(filePath: string): string {
  let hash = 0
  for (let i = 0; i < filePath.length; i++) {
    hash = filePath.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COVER_PALETTE[Math.abs(hash) % COVER_PALETTE.length]
}

export function loadShelf(): BookshelfEntry[] {
  try {
    const raw = localStorage.getItem(SHELF_KEY)
    return raw ? (JSON.parse(raw) as BookshelfEntry[]) : []
  } catch {
    return []
  }
}

function persist(entries: BookshelfEntry[]): void {
  try {
    localStorage.setItem(SHELF_KEY, JSON.stringify(entries))
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export function upsertShelfEntry(
  entry: Omit<BookshelfEntry, 'coverColor' | 'lastOpened'>
): void {
  const shelf = loadShelf().filter((e) => e.filePath !== entry.filePath)
  const next: BookshelfEntry = {
    ...entry,
    lastOpened: Date.now(),
    coverColor: coverColorFor(entry.filePath)
  }
  persist([next, ...shelf].slice(0, MAX_ENTRIES))
}

export function removeShelfEntry(filePath: string): void {
  persist(loadShelf().filter((e) => e.filePath !== filePath))
}

/** Human-readable relative time label */
export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  const hr = Math.floor(diff / 3_600_000)
  const day = Math.floor(diff / 86_400_000)

  if (min < 2) return 'just now'
  if (hr < 1) return `${min}m ago`
  if (hr < 24) return `${hr}h ago`
  if (day === 1) return 'yesterday'
  if (day < 30) return `${day} days ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}
