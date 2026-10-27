import { SWEAR_FAMILIES, allowList, catchVariants, type SwearFamily } from '../config/swears'

export interface SwearHit {
  /** Canonical word (from the config, or the variant heard). */
  word: string
  familyId: string
  color: string
  value: number
  /** Display form, e.g. "F*CK". */
  bleeped: string
  /** True if the engine had censored it ("f***") and we recovered it. */
  wasCensored: boolean
}

interface Entry {
  word: string
  value: number
  family: SwearFamily
}

const index = new Map<string, Entry>()
for (const family of SWEAR_FAMILIES) {
  for (const [word, value] of Object.entries(family.words)) {
    index.set(word.toLowerCase(), { word: word.toLowerCase(), value, family })
  }
}
const dictionary = [...index.values()]
const allowed = new Set(allowList.map((w) => w.toLowerCase()))

const VOWELS = /[aeiouy]/

/** "fucking" -> "F*CKING", "bullshit" -> "BULLSH*T". */
export function bleep(word: string, root?: string): string {
  const w = word.toLowerCase()
  const at = root ? w.indexOf(root) : -1
  let out: string
  if (at >= 0) {
    const r = root!
    const v = r.slice(1).search(VOWELS)
    const pos = v >= 0 ? at + 1 + v : at + 1
    out = w.slice(0, pos) + '*' + w.slice(pos + 1)
  } else {
    const v = w.slice(1).search(VOWELS)
    const pos = v >= 0 ? v + 1 : Math.min(1, w.length - 1)
    out = w.slice(0, pos) + '*' + w.slice(pos + 1)
  }
  return out.toUpperCase()
}

function toHit(entry: Entry, wasCensored = false): SwearHit {
  return {
    word: entry.word,
    familyId: entry.family.id,
    color: entry.family.color,
    value: entry.value,
    bleeped: bleep(entry.word, entry.family.root),
    wasCensored,
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Recover a censored token such as "f***", "s***ty", "f**king" or
 * "m***********" to the best matching dictionary word.
 */
function uncensor(token: string): Entry | null {
  if (!/[a-z]/.test(token)) return null // "****" could be anything
  const parts = token.split(/(\*+)/).filter(Boolean)
  const exact = new RegExp('^' + parts.map((p) => (p[0] === '*' ? `[a-z]{${p.length}}` : escapeRe(p))).join('') + '$')
  const loose = new RegExp('^' + parts.map((p) => (p[0] === '*' ? '[a-z]+' : escapeRe(p))).join('') + '$')
  const exactMatches = dictionary.filter((e) => exact.test(e.word))
  // prefer real words over acronyms ("s***" is "shit", not "stfu"),
  // then whichever is listed first in the config (the common forms)
  const hasRoot = (e: Entry) => (e.word.includes(e.family.root) ? 1 : 0)
  if (exactMatches.length) return exactMatches.sort((a, b) => hasRoot(b) - hasRoot(a) || dictionary.indexOf(a) - dictionary.indexOf(b))[0]
  const looseMatches = dictionary.filter((e) => loose.test(e.word))
  if (looseMatches.length) return looseMatches.sort((a, b) => a.word.length - b.word.length)[0]
  return null
}

function matchToken(token: string): SwearHit | null {
  if (!token || allowed.has(token)) return null
  const direct = index.get(token)
  if (direct) return toHit(direct)
  if (token.includes('*')) {
    const recovered = uncensor(token)
    return recovered ? toHit(recovered, true) : null
  }
  if (catchVariants) {
    for (const family of SWEAR_FAMILIES) {
      if (token.includes(family.root)) {
        return toHit({ word: token, value: family.value, family })
      }
    }
  }
  return null
}

/** Lowercase words; keeps "*" so censored tokens survive. "fuckin'" -> "fuckin". */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .split(/[^a-z0-9*]+/)
    .filter(Boolean)
}

/** Find every swear in a chunk of transcript, in order. */
export function detectSwears(text: string): SwearHit[] {
  const tokens = tokenize(text)
  const hits: SwearHit[] = []
  for (let i = 0; i < tokens.length; i++) {
    // "mother fucker", "bull shit", "shit show" → one compound word
    const pair = i + 1 < tokens.length ? index.get(tokens[i] + tokens[i + 1]) : undefined
    if (pair) {
      hits.push(toHit(pair))
      i++
      continue
    }
    const hit = matchToken(tokens[i])
    if (hit) hits.push(hit)
  }
  return hits
}

/**
 * Streaming engines re-send the same words as interim results get
 * refined. Each segment (one utterance) remembers how many swears it
 * has already paid out, so only genuinely new ones are counted.
 */
export class SegmentDeduper {
  private counted = new Map<string, number>()

  take(segmentId: string, hits: SwearHit[]): SwearHit[] {
    const prev = this.counted.get(segmentId) ?? 0
    if (hits.length > prev) this.counted.set(segmentId, hits.length)
    if (this.counted.size > 500) {
      const oldest = this.counted.keys().next().value
      if (oldest !== undefined) this.counted.delete(oldest)
    }
    return hits.slice(prev)
  }

  reset() {
    this.counted.clear()
  }
}
