export interface Language {
  code: string
  name: string
  flag: string
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh-CN', name: 'Chinese', flag: '🇨🇳' },
  { code: 'zh-TW', name: 'Chinese (Trad.)', flag: '🇹🇼' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
]

export interface TranslateResult {
  translatedText: string
  detectedSourceLang: string
  detectedSourceName: string
}

/** Uses the free unofficial Google Translate endpoint — no API key required. */
export async function translateText(
  text: string,
  targetLang: string
): Promise<TranslateResult> {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t` +
    `&q=${encodeURIComponent(text)}`

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Google Translate returned ${res.status}`)

  // Response shape: [[[translated, original, ...], ...], null, detectedLang, ...]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any
  try {
    data = await res.json()
  } catch {
    throw new Error('Google Translate returned an invalid response')
  }

  if (!Array.isArray(data?.[0])) {
    throw new Error('Google Translate response format has changed — translation unavailable')
  }

  const translatedText = (data[0] as string[][]).map((chunk) => chunk[0]).join('')
  const detectedCode: string = data[2] ?? 'auto'
  const detectedSourceName =
    LANGUAGES.find((l) => l.code.toLowerCase().startsWith(detectedCode.toLowerCase()))?.name ??
    detectedCode.toUpperCase()

  return { translatedText, detectedSourceLang: detectedCode, detectedSourceName }
}
