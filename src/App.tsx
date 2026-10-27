import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Celebration, ConfettiLayer } from './components/Celebration'
import { ComboMeter } from './components/ComboMeter'
import { Controls } from './components/Controls'
import { HistoryDrawer } from './components/HistoryDrawer'
import { JarScene, useSailorMode } from './components/JarScene'
import { Odometer } from './components/Odometer'
import { SourcePanel } from './components/SourcePanel'
import { StatsPanel } from './components/StatsPanel'
import { TestPanel } from './components/TestPanel'
import { Transcript } from './components/Transcript'
import { sfx } from './lib/sound'
import { pauseListening, simulateLine, startListening, toggleMute } from './state/game'
import { actions, useStore } from './state/store'

interface DocumentPiP {
  requestWindow(opts: { width: number; height: number }): Promise<Window>
}
const docPip = (): DocumentPiP | undefined => (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture

/** Copy this page's styles (incl. @font-face) into the pop-out window. */
function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const base = sheet.href ?? location.href
      const css = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join('\n')
        .replace(/url\((['"]?)(?!data:|https?:|blob:)([^'")]+)\1\)/g, (_m, q: string, u: string) => `url(${q}${new URL(u, base).href}${q})`)
      const style = target.document.createElement('style')
      style.textContent = css
      target.document.head.appendChild(style)
    } catch {
      if (sheet.href) {
        const link = target.document.createElement('link')
        link.rel = 'stylesheet'
        link.href = sheet.href
        target.document.head.appendChild(link)
      }
    }
  }
}

function BigTotal({ size }: { size: string }) {
  const total = useStore((s) => s.total)
  return (
    <div className="relative z-40 flex flex-col items-center">
      <div className="font-display leading-none text-white text-outline drop-shadow-[0_6px_0_rgba(43,27,74,0.25)]" style={{ fontSize: size }}>
        <Odometer value={total} />
      </div>
    </div>
  )
}

function StatusPill() {
  const status = useStore((s) => s.status)
  const engineStatus = useStore((s) => s.engineStatus)
  const label =
    engineStatus === 'error' ? '⚠️ Mic trouble' : status === 'listening' ? (engineStatus === 'loading' ? 'Warming up…' : 'Listening') : status === 'paused' ? 'Paused' : 'Not listening'
  const dot = engineStatus === 'error' ? 'bg-hot' : status === 'listening' ? (engineStatus === 'loading' ? 'bg-gold' : 'live-dot bg-mint') : 'bg-ink/25'
  return (
    <span className="chip border-2 border-white bg-white/80 px-3 py-1 text-sm shadow-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

function IconButton({ onClick, title, children, active = false }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`btn ${active ? 'btn-grape' : 'btn-ghost'} h-11 px-4 text-sm`}
      title={title}
      onClick={() => {
        sfx.unlock()
        sfx.pop()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

/** The compact jar + total view used for overlay mode and the pop-out window. */
function OverlayView({ inPip = false }: { inPip?: boolean }) {
  const muted = useStore((s) => s.muted)
  const count = useStore((s) => s.count)
  return (
    <div className="flex h-full min-h-screen flex-col items-center gap-1 px-3 pb-3 pt-2">
      <div className="flex w-full items-center justify-between">
        <span className="font-display text-sm text-ink-soft">🫙 {count} swear{count === 1 ? '' : 's'}</span>
        <div className="flex gap-1.5">
          <button className="btn btn-ghost h-8 w-8 text-sm" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
          {!inPip && (
            <button className="btn btn-ghost h-8 px-3 text-xs" onClick={() => actions.set({ overlay: false })} title="Back to full view">
              ⤢ Full
            </button>
          )}
        </div>
      </div>
      <BigTotal size="clamp(44px, 16vw, 84px)" />
      <div className="min-h-0 w-full flex-1">
        <JarScene compact />
      </div>
      <ComboMeter />
      <Controls compact />
      <Celebration compact />
      <ConfettiLayer />
    </div>
  )
}

export default function App() {
  const overlay = useStore((s) => s.overlay)
  const muted = useStore((s) => s.muted)
  const sailor = useSailorMode()
  const [pip, setPip] = useState<Window | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  // keyboard: T = test swear, Space = start/pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, select, textarea, button')) return
      if (e.key === 't' || e.key === 'T') simulateLine()
      if (e.key === ' ') {
        e.preventDefault()
        if (useStore.getState().status === 'listening') pauseListening()
        else void startListening()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (pip) pip.document.body.className = `app-bg ${sailor ? 'sailor' : ''}`
  }, [pip, sailor])

  const openPip = async () => {
    const api = docPip()
    if (!api) {
      actions.set({ overlay: true })
      return
    }
    try {
      const w = await api.requestWindow({ width: 360, height: 600 })
      copyStyles(w)
      w.document.title = 'Swear Jar'
      w.document.body.style.margin = '0'
      w.addEventListener('pagehide', () => setPip(null))
      setPip(w)
    } catch {
      actions.set({ overlay: true })
    }
  }

  if (overlay && !pip) {
    return (
      <div className={`app-bg h-full ${sailor ? 'sailor' : ''}`}>
        <OverlayView />
      </div>
    )
  }

  return (
    <div className={`app-bg min-h-full transition-[background] duration-700 ${sailor ? 'sailor' : ''}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 pb-1 pt-4">
        <div className="flex items-center gap-3">
          <span className="wiggle inline-block text-5xl drop-shadow-md">🫙</span>
          <div>
            <h1 className="font-display text-4xl leading-none tracking-wide text-hot drop-shadow-[0_3px_0_rgba(43,27,74,0.15)]">
              Digital Swear Jar
            </h1>
            <p className="text-sm font-medium text-ink-soft">Every naughty word costs you a buck. Pay up, potty mouth.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill />
          <IconButton onClick={toggleMute} title={muted ? 'Unmute sounds' : 'Mute sounds'}>
            {muted ? '🔇 Muted' : '🔊 Sound'}
          </IconButton>
          <IconButton onClick={() => setHistoryOpen(true)} title="Past meetings">
            🗓 History
          </IconButton>
          <IconButton onClick={() => actions.set({ overlay: true })} title="Compact view: just the jar and total">
            🪟 Overlay
          </IconButton>
          {docPip() && (
            <IconButton onClick={() => (pip ? pip.close() : void openPip())} title="Always-on-top mini window" active={!!pip}>
              {pip ? '↙ Bring back' : '📌 Pop out'}
            </IconButton>
          )}
        </div>
      </header>

      <main className="grid grid-cols-1 gap-5 px-5 pb-8 pt-2 lg:grid-cols-[300px_minmax(0,1fr)_320px] xl:grid-cols-[330px_minmax(0,1fr)_350px]">
        <section className="order-2 flex flex-col gap-5 lg:order-1">
          <SourcePanel />
          <TestPanel />
        </section>

        <section className="order-1 flex min-w-0 flex-col items-center gap-3 lg:order-2">
          <div className="flex flex-col items-center">
            <span className="chip -mb-2 bg-ink px-4 py-1 font-display text-sm tracking-[0.2em] text-white">IN THE JAR</span>
            <BigTotal size="clamp(64px, 9vw, 120px)" />
          </div>
          <div className="w-full" style={{ height: 'clamp(360px, 54vh, 700px)' }}>
            {pip ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <span className="wiggle text-7xl">🫙↗</span>
                <p className="font-display text-2xl">The jar is in the pop-out window</p>
                <button className="btn btn-grape px-5 py-2.5" onClick={() => pip.close()}>
                  ↙ Bring it back
                </button>
              </div>
            ) : (
              <JarScene />
            )}
          </div>
          <ComboMeter />
          <Controls />
          <div className="w-full max-w-xl">
            <Transcript />
          </div>
          <p className="text-xs text-ink-soft">
            Shortcuts: <kbd className="rounded bg-white px-1.5 font-semibold">Space</kbd> start/pause ·{' '}
            <kbd className="rounded bg-white px-1.5 font-semibold">T</kbd> fake a swear
          </p>
        </section>

        <section className="order-3">
          <StatsPanel />
        </section>
      </main>

      {!pip && <Celebration />}
      <ConfettiLayer />
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
      {pip && createPortal(<OverlayView inPip />, pip.document.body)}
    </div>
  )
}
