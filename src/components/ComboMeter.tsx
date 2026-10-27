import { useEffect, useState } from 'react'
import { COMBO_TIERS, COMBO_WINDOW_MS } from '../config/game'
import { useStore } from '../state/store'

/** "COMBO x3" pill with a fuse that burns down over the 30s window. */
export function ComboMeter() {
  const combo = useStore((s) => s.combo)
  const [, tick] = useState(0)
  const remaining = COMBO_WINDOW_MS - (Date.now() - combo.lastAt)
  const live = combo.count >= 2 && remaining > 0
  const primed = combo.count === 1 && remaining > 0

  useEffect(() => {
    if (!live && !primed) return
    const t = setTimeout(() => tick((n) => n + 1), remaining + 30)
    return () => clearTimeout(t)
  }, [live, primed, remaining, combo.lastAt])

  const tier = [...COMBO_TIERS].reverse().find((t) => combo.count >= t.at)
  const color = tier?.color ?? '#a855f7'

  return (
    <div className="flex h-11 items-center justify-center">
      {live ? (
        <div className="flex items-center gap-3 rounded-full border-[3px] border-white bg-white/85 py-1 pl-2 pr-4 shadow-md">
          <span
            className="rounded-full px-3 py-0.5 font-display text-lg text-white"
            style={{ background: color, transform: `scale(${1 + Math.min(combo.count, 10) * 0.025})` }}
          >
            {tier?.emoji ?? '🔥'} COMBO x{combo.count}
          </span>
          <div className="relative h-3 w-28 overflow-hidden rounded-full bg-ink/10" title="Swear again before this runs out to keep the combo going">
            <div
              key={combo.lastAt}
              className="absolute inset-0 origin-left rounded-full"
              style={{
                background: `linear-gradient(90deg, ${color}, #ffd23f)`,
                animation: `drain ${COMBO_WINDOW_MS}ms linear forwards`,
                animationDelay: `${-(COMBO_WINDOW_MS - remaining)}ms`,
              }}
            />
          </div>
        </div>
      ) : primed ? (
        <span key={combo.lastAt} className="text-sm font-semibold text-grape">
          One more in the next 30s and it’s a combo 😈
        </span>
      ) : (
        <span className="text-sm font-medium text-ink-soft">
          {combo.best > 1 ? `Best combo this session: x${combo.best}` : 'Swear twice within 30s for a combo 😈'}
        </span>
      )}
    </div>
  )
}
