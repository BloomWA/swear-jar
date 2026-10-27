import { create } from 'zustand'
import { COMBO_TIERS, COMBO_WINDOW_MS, MILESTONES, type ComboTier, type Milestone } from '../config/game'
import type { SwearHit } from '../lib/detector'
import type { EngineId, EngineStatus } from '../engines/types'

export type Hit = SwearHit & { speaker?: string }

export interface Catch {
  id: number
  word: string
  bleeped: string
  value: number
  color: string
  speaker?: string
  wasCensored: boolean
  /** -1..1 horizontal offset for the popup. */
  x: number
}

export interface WordStat {
  count: number
  total: number
  bleeped: string
  color: string
}

export interface ComboBanner {
  id: number
  count: number
  tier: ComboTier
}

export interface TranscriptLine {
  id: string
  text: string
  final: boolean
  speaker?: string
}

export interface SessionRecord {
  id: string
  startedAt: number
  endedAt: number
  durationMs: number
  total: number
  count: number
  topWord?: string
  bestCombo: number
  words: Record<string, WordStat>
}

export interface Settings {
  engine: EngineId
  deviceId: string
  deepgramKey: string
  whisperModel: string
  diarize: boolean
  showTranscript: boolean
}

type ListenStatus = 'idle' | 'listening' | 'paused'

interface State {
  status: ListenStatus
  sessionStart: number | null
  activeMs: number
  resumedAt: number | null
  total: number
  count: number
  words: Record<string, WordStat>
  speakers: Record<string, { count: number; total: number }>
  catches: Catch[]
  combo: { count: number; lastAt: number; best: number }
  comboBanner: ComboBanner | null
  earned: number[]
  celebrations: Milestone[]
  overflowed: boolean
  transcript: TranscriptLine[]
  engineStatus: EngineStatus
  engineMessage?: string
  engineProgress?: number
  level: number
  settings: Settings
  history: SessionRecord[]
  overlay: boolean
  muted: boolean
  pouring: boolean
}

const SETTINGS_KEY = 'swearjar:settings'
const HISTORY_KEY = 'swearjar:history'
const CURRENT_KEY = 'swearjar:current'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}
function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked */
  }
}

const defaultSettings: Settings = {
  engine: 'whisper',
  deviceId: 'default',
  deepgramKey: '',
  whisperModel: 'onnx-community/whisper-base',
  diarize: true,
  showTranscript: true,
}

/** A session left over from a closed tab is archived on startup. */
function bootHistory(): SessionRecord[] {
  const history = loadArray<SessionRecord>(HISTORY_KEY)
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    if (raw) {
      const rec = JSON.parse(raw) as SessionRecord
      if (rec.count > 0 && !history.some((h) => h.id === rec.id)) history.unshift(rec)
      localStorage.removeItem(CURRENT_KEY)
      save(HISTORY_KEY, history)
    }
  } catch {
    /* ignore */
  }
  return history
}

const freshSession = () => ({
  status: 'idle' as ListenStatus,
  sessionStart: null,
  activeMs: 0,
  resumedAt: null,
  total: 0,
  count: 0,
  words: {},
  speakers: {},
  catches: [],
  combo: { count: 0, lastAt: 0, best: 0 },
  comboBanner: null,
  earned: [],
  celebrations: [],
  overflowed: false,
  transcript: [],
})

export const useStore = create<State>(() => ({
  ...freshSession(),
  engineStatus: 'idle',
  level: 0,
  settings: load(SETTINGS_KEY, defaultSettings),
  history: bootHistory(),
  overlay: new URLSearchParams(location.search).has('overlay'),
  muted: false,
  pouring: false,
}))

const set = useStore.setState
const get = useStore.getState

export function elapsedMs(s: Pick<State, 'activeMs' | 'resumedAt'>, now = Date.now()) {
  return s.activeMs + (s.resumedAt ? now - s.resumedAt : 0)
}

export function topWord(words: Record<string, WordStat>): [string, WordStat] | undefined {
  return Object.entries(words).sort((a, b) => b[1].count - a[1].count || b[1].total - a[1].total)[0]
}

function snapshot(s: State): SessionRecord {
  const now = Date.now()
  return {
    id: String(s.sessionStart ?? now),
    startedAt: s.sessionStart ?? now,
    endedAt: now,
    durationMs: elapsedMs(s, now),
    total: s.total,
    count: s.count,
    topWord: topWord(s.words)?.[1].bleeped,
    bestCombo: s.combo.best,
    words: s.words,
  }
}

let catchId = 0
let bannerId = 0

export interface RecordResult {
  comboTier?: ComboTier
  comboCount: number
  milestones: Milestone[]
}

export const actions = {
  recordHits(hits: Hit[], { combo: countCombo = true } = {}): RecordResult {
    const s = get()
    const now = Date.now()
    let total = s.total
    let combo = { ...s.combo }
    const words = { ...s.words }
    const speakers = { ...s.speakers }
    const catches = [...s.catches]
    let tierHit: ComboTier | undefined

    for (const h of hits) {
      total += h.value
      if (countCombo) {
        combo = now - combo.lastAt <= COMBO_WINDOW_MS ? { ...combo, count: combo.count + 1, lastAt: now } : { ...combo, count: 1, lastAt: now }
        combo.best = Math.max(combo.best, combo.count)
        const tier = COMBO_TIERS.find((t) => t.at === combo.count)
        if (tier) tierHit = tier
        else if (combo.count > COMBO_TIERS[COMBO_TIERS.length - 1].at && combo.count % 5 === 0) {
          tierHit = { ...COMBO_TIERS[COMBO_TIERS.length - 1], title: `Combo x${combo.count}!!` }
        }
      }
      const w = words[h.word] ?? { count: 0, total: 0, bleeped: h.bleeped, color: h.color }
      words[h.word] = { ...w, count: w.count + 1, total: w.total + h.value }
      if (h.speaker) {
        const sp = speakers[h.speaker] ?? { count: 0, total: 0 }
        speakers[h.speaker] = { count: sp.count + 1, total: sp.total + h.value }
      }
      catches.push({
        id: ++catchId,
        word: h.word,
        bleeped: h.bleeped,
        value: h.value,
        color: h.color,
        speaker: h.speaker,
        wasCensored: h.wasCensored,
        x: Math.random() * 2 - 1,
      })
    }

    const milestones = MILESTONES.filter((m) => s.total < m.amount && total >= m.amount && !s.earned.includes(m.amount))
    set({
      total,
      count: s.count + hits.length,
      combo,
      words,
      speakers,
      catches: catches.slice(-12),
      sessionStart: s.sessionStart ?? now,
      earned: [...s.earned, ...milestones.map((m) => m.amount)],
      celebrations: [...s.celebrations, ...milestones],
      comboBanner: tierHit ? { id: ++bannerId, count: combo.count, tier: tierHit } : s.comboBanner,
    })
    save(CURRENT_KEY, snapshot(get()))
    return { comboTier: tierHit, comboCount: combo.count, milestones }
  },

  dismissCatch(id: number) {
    set({ catches: get().catches.filter((c) => c.id !== id) })
  },
  dismissBanner(id: number) {
    if (get().comboBanner?.id === id) set({ comboBanner: null })
  },
  dismissCelebration() {
    set({ celebrations: get().celebrations.slice(1) })
  },

  setListening(on: boolean) {
    const s = get()
    const now = Date.now()
    if (on && s.status !== 'listening') {
      set({ status: 'listening', resumedAt: now, sessionStart: s.sessionStart ?? now })
    } else if (!on && s.status === 'listening') {
      set({ status: 'paused', activeMs: elapsedMs(s, now), resumedAt: null })
    }
  },

  upsertTranscript(line: TranscriptLine) {
    const t = get().transcript.filter((l) => l.id !== line.id)
    t.push(line)
    set({ transcript: t.slice(-6) })
  },

  setEngine(status: EngineStatus, message?: string, progress?: number) {
    set({ engineStatus: status, engineMessage: message, engineProgress: progress })
  },

  setLevel(level: number) {
    set({ level })
  },

  updateSettings(patch: Partial<Settings>) {
    const settings = { ...get().settings, ...patch }
    set({ settings })
    save(SETTINGS_KEY, settings)
  },

  /** Archive the session to history and start a fresh one. */
  resetSession() {
    const s = get()
    let history = s.history
    if (s.count > 0) {
      history = [snapshot(s), ...history].slice(0, 100)
      save(HISTORY_KEY, history)
    }
    try {
      localStorage.removeItem(CURRENT_KEY)
    } catch {
      /* ignore */
    }
    set({ ...freshSession(), history, status: s.status === 'listening' ? 'listening' : 'idle', resumedAt: s.status === 'listening' ? Date.now() : null, sessionStart: s.status === 'listening' ? Date.now() : null })
  },

  deleteHistory(id?: string) {
    const history = id ? get().history.filter((h) => h.id !== id) : []
    set({ history })
    save(HISTORY_KEY, history)
  },

  set,
}

// keep the in-progress session safe if the tab closes mid-meeting
window.addEventListener('beforeunload', () => {
  const s = get()
  if (s.count > 0) save(CURRENT_KEY, snapshot(s))
})
