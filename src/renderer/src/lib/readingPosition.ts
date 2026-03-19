export interface ReadingPosition {
  /** PDF: 1-based page number */
  page?: number
  /** EPUB: exact CFI string for the current location */
  cfi?: string
}

function storageKey(fileName: string): string {
  return `lumi-pos-${fileName}`
}

export function savePosition(fileName: string, pos: ReadingPosition): void {
  try {
    localStorage.setItem(storageKey(fileName), JSON.stringify(pos))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function loadPosition(fileName: string): ReadingPosition | null {
  try {
    const raw = localStorage.getItem(storageKey(fileName))
    return raw ? (JSON.parse(raw) as ReadingPosition) : null
  } catch {
    return null
  }
}
