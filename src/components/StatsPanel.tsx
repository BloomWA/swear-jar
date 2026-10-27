import { useEffect, useState } from 'react'
import { MILESTONES } from '../config/game'
import { elapsedMs, topWord, useStore } from '../state/store'

export function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [active])
  return now
}

function Tile({ label, value, accent, sub }: { label: string; value: React.ReactNode; accent: string; sub?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white px-3 py-2.5 shadow-[0_3px_0_rgba(43,27,74,0.07)]">
      <div className="absolute -right-3 -top-3 h-10 w-10 rounded-full opacity-20" style={{ background: accent }} />
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="truncate font-display text-2xl leading-tight" style={{ color: accent }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-ink-soft">{sub}</div>}
    </div>
  )
}

export function StatsPanel() {
  const s = useStore()
  const now = useNow(s.status === 'listening')
  const elapsed = elapsedMs(s, now)
  const minutes = Math.max(elapsed / 60000, 1)
  const rate = s.count / minutes
  const top = topWord(s.words)
  const board = Object.entries(s.words).sort((a, b) => b[1].count - a[1].count || b[1].total - a[1].total)
  const maxCount = board[0]?.[1].count ?? 1
  const speakers = Object.entries(s.speakers).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="card flex flex-col gap-4 p-5">
      <h2 className="font-display text-2xl">📊 The Damage</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="In the jar" value={`$${s.total}`} accent="#22c55e" />
        <Tile label="Swears" value={s.count} accent="#ff4f81" />
        <Tile label="Per minute" value={rate.toFixed(rate >= 10 ? 0 : 1)} accent="#a855f7" sub={s.status === 'listening' ? 'live' : undefined} />
        <Tile label="Session" value={formatDuration(elapsed)} accent="#3b82f6" sub={s.status === 'paused' ? 'paused' : undefined} />
        <Tile label="Fave word" value={top ? top[1].bleeped : '—'} accent={top?.[1].color ?? '#ffb020'} />
        <Tile label="Best combo" value={s.combo.best ? `x${s.combo.best}` : '—'} accent="#ffb020" />
      </div>

      <div>
        <h3 className="mb-2 font-display text-lg">🏆 Word Leaderboard</h3>
        {board.length === 0 ? (
          <p className="rounded-2xl bg-white/70 px-3 py-4 text-center text-sm text-ink-soft">Squeaky clean so far. Suspicious. 🧐</p>
        ) : (
          <ol className="scroll-soft flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
            {board.map(([word, w], i) => (
              <li key={word} className="flex items-center gap-2">
                <span className="w-6 text-center font-display text-ink-soft">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                <div className="relative h-8 flex-1 overflow-hidden rounded-xl bg-white">
                  <div
                    className="absolute inset-y-0 left-0 rounded-xl"
                    style={{ width: `${(w.count / maxCount) * 100}%`, background: `${w.color}33`, transition: 'width .6s cubic-bezier(.3,1.5,.5,1)' }}
                  />
                  <div className="relative flex h-full items-center justify-between px-3">
                    <span className="font-display tracking-wide" style={{ color: w.color }}>
                      {w.bleeped}
                    </span>
                    <span className="text-sm font-semibold">
                      ×{w.count} <span className="text-ink-soft">· ${w.total}</span>
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {speakers.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-lg">🗣 Who Said It</h3>
          <ul className="flex flex-col gap-1.5">
            {speakers.map(([name, sp], i) => (
              <li key={name} className="flex items-center justify-between rounded-xl bg-white px-3 py-1.5 text-sm">
                <span className="font-semibold">
                  {i === 0 ? '😈 ' : ''}
                  {name}
                </span>
                <span>
                  ×{sp.count} · <b>${sp.total}</b>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 font-display text-lg">🎖 Badges</h3>
        <div className="grid grid-cols-5 gap-2">
          {MILESTONES.map((m) => {
            const got = s.earned.includes(m.amount)
            return (
              <div key={m.amount} className="group relative flex flex-col items-center" title={`${m.title} — $${m.amount}`}>
                <div
                  className={`flex aspect-square w-full max-w-16 items-center justify-center rounded-full border-4 text-2xl transition-all ${got ? 'border-white shadow-md' : 'border-dashed border-ink/15 grayscale'}`}
                  style={{ background: got ? `radial-gradient(circle at 35% 30%, #fff 0 10%, ${m.color} 65%)` : '#f4eefb', opacity: got ? 1 : 0.55 }}
                >
                  {got ? m.emoji : '🔒'}
                </div>
                <span className="mt-1 font-display text-xs" style={{ color: got ? m.color : '#6b5b8a' }}>
                  ${m.amount}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
