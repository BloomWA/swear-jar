import confetti from 'canvas-confetti'
import { SWEAR_FAMILIES } from '../config/swears'
import { SegmentDeduper, detectSwears } from '../lib/detector'
import { JarWorld } from '../lib/jarWorld'
import { sfx } from '../lib/sound'
import { createEngine } from '../engines'
import { listInputs } from '../engines/audio'
import type { SpeechEngine, TranscriptPiece } from '../engines/types'
import { actions, useStore, type Hit } from './store'

/** The one physics world. Survives the jar moving between windows. */
export const world = new JarWorld()

world.callbacks = {
  onImpact: (i) => sfx.clink(i),
  onOverflow: () => {
    if (!useStore.getState().overflowed) actions.set({ overflowed: true })
  },
}

useStore.setState({ muted: sfx.muted })

/* ───────────── confetti (one launcher per visible window) ───────────── */

const launchers = new Set<confetti.CreateTypes>()

export function registerConfettiCanvas(canvas: HTMLCanvasElement) {
  const fire = confetti.create(canvas, { resize: true, useWorker: false })
  launchers.add(fire)
  return () => {
    fire.reset()
    launchers.delete(fire)
  }
}

function celebrate(color: string) {
  const colors = [color, '#ffd23f', '#ff4f81', '#22c55e', '#3b82f6', '#ffffff']
  for (const fire of launchers) {
    void fire({ particleCount: 140, spread: 80, startVelocity: 48, origin: { x: 0.5, y: 0.55 }, colors, scalar: 1.1 })
    setTimeout(() => {
      void fire({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors })
      void fire({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors })
    }, 250)
  }
}

/* ───────────── awarding swears ───────────── */

export function award(hits: Hit[], opts?: { combo?: boolean }) {
  if (!hits.length || useStore.getState().pouring) return
  const res = actions.recordHits(hits, opts)
  hits.forEach((h, i) => {
    world.drop({ value: h.value, delay: i * 160, spread: hits.length > 1 ? (i / (hits.length - 1)) * 2 - 1 : 0 })
  })
  sfx.bleep()
  if (res.comboTier) setTimeout(() => sfx.combo(res.comboCount), 250)
  res.milestones.forEach((m, i) => {
    setTimeout(() => {
      sfx.kaching()
      setTimeout(() => sfx.fanfare(), 450)
      celebrate(m.color)
    }, 700 + i * 3800)
  })
}

/* ───────────── live listening ───────────── */

let engine: SpeechEngine | null = null
const deduper = new SegmentDeduper()

function onTranscript(segmentId: string, pieces: TranscriptPiece[], isFinal: boolean) {
  const hits: Hit[] = pieces.flatMap((p) => detectSwears(p.text).map((h) => ({ ...h, speaker: p.speaker })))
  const fresh = deduper.take(segmentId, hits)
  award(fresh)
  const speakers = [...new Set(pieces.map((p) => p.speaker).filter(Boolean))]
  actions.upsertTranscript({
    id: segmentId,
    text: pieces.map((p) => (pieces.length > 1 && p.speaker ? `${p.speaker}: ${p.text}` : p.text)).join(' '),
    final: isFinal,
    speaker: speakers.length === 1 ? speakers[0] : undefined,
  })
}

export async function startListening() {
  sfx.unlock()
  if (engine) return
  const { settings } = useStore.getState()
  const devices = await listInputs().catch(() => [])
  const e = createEngine(
    settings.engine,
    {
      deviceId: settings.deviceId,
      deepgramKey: settings.deepgramKey,
      whisperModel: settings.whisperModel,
      diarize: settings.diarize,
    },
    {
      onTranscript,
      onStatus: (status, message, progress) => {
        actions.setEngine(status, message, progress)
        if (status === 'error' && engine === e) {
          engine = null
          actions.setListening(false)
          actions.setLevel(0)
        }
      },
      onLevel: (l) => actions.setLevel(l),
    },
    devices,
  )
  engine = e
  actions.setListening(true)
  try {
    await e.start()
  } catch (err) {
    e.stop()
    if (engine === e) engine = null
    actions.setListening(false)
    actions.setLevel(0)
    const msg = err instanceof Error ? err.message : String(err)
    actions.setEngine('error', /denied|not allowed|permission/i.test(msg) ? 'Microphone access was blocked. Allow it in the address bar and try again.' : msg)
  }
}

export function pauseListening() {
  engine?.stop()
  engine = null
  deduper.reset()
  actions.setListening(false)
  actions.setLevel(0)
}

/** Switching engine/device while listening restarts the engine. */
export async function restartIfListening() {
  if (!engine) return
  pauseListening()
  await startListening()
}

/* ───────────── test mode ───────────── */

const TEST_LINES = [
  'oh shit, I was on mute the whole time',
  'this fucking printer again',
  'who scheduled a meeting at 4:55 on a Friday, what the fuck',
  'that quarterly report is absolute bullshit',
  'oh s***, can everyone see my screen',
  'the deploy f***ed up production',
  'sorry, my motherfucking dog is barking',
  'well that was a total shitshow',
  'f**king hell, Dave, unmute yourself',
  'circle back on that horseshit later',
  'my wifi is being so shitty today',
  'who the fuck replied all',
]

let testSeq = 0
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const FAKE_SPEAKERS = ['Speaker 1', 'Speaker 2', 'Speaker 3']

/** Feeds a fake transcript through the real detection pipeline. */
export function simulateLine(text = pick(TEST_LINES)) {
  sfx.unlock()
  // fake speaker labels only when the speaker-aware engine is selected
  const { engine, diarize } = useStore.getState().settings
  const speaker = engine === 'deepgram' && diarize ? pick(FAKE_SPEAKERS) : undefined
  onTranscript(`test:${++testSeq}`, [{ text, speaker }], true)
}

export function simulateCombo(n = 5) {
  for (let i = 0; i < n; i++) setTimeout(() => simulateLine(), i * 650)
}

/** Shower of coins worth `dollars`, for demoing the fill/overflow. */
export function makeItRain(dollars = 25) {
  sfx.unlock()
  // the first few $1 words of each family are the everyday ones
  const words = SWEAR_FAMILIES.flatMap((f) =>
    Object.entries(f.words)
      .filter(([, v]) => v === 1)
      .slice(0, 4)
      .map(([w]) => w),
  )
  const hits = Array.from({ length: dollars }, () => detectSwears(pick(words))[0]).filter(Boolean)
  // a shower isn't a combo; don't let it inflate the streak stats
  hits.forEach((h, i) => setTimeout(() => award([h], { combo: false }), i * 90))
}

/* ───────────── reset ───────────── */

let pourAnimation: (() => Promise<void>) | null = null

/** The visible jar registers its shake-and-pour animation here. */
export function setPourAnimation(fn: (() => Promise<void>) | null) {
  pourAnimation = fn
}

/** Shake the jar, tip it out, archive the session to history. */
export async function emptyJar() {
  if (useStore.getState().pouring) return
  sfx.unlock()
  actions.set({ pouring: true })
  try {
    if (pourAnimation && world.tokenCount > 0) await pourAnimation()
  } finally {
    world.clear()
    world.setTilt(0)
    deduper.reset()
    actions.resetSession()
    actions.set({ pouring: false })
  }
}

export function toggleMute() {
  const m = !useStore.getState().muted
  sfx.setMuted(m)
  actions.set({ muted: m })
  if (!m) {
    sfx.unlock()
    sfx.pop()
  }
}
