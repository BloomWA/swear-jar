import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { registerConfettiCanvas } from '../state/game'
import { actions, useStore } from '../state/store'

/** Full-window confetti canvas. Render once per window (main + pop-out). */
export function ConfettiLayer() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => (ref.current ? registerConfettiCanvas(ref.current) : undefined), [])
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />
}

/** "NEW BADGE!" card for milestones. Queued, one at a time. */
export function Celebration({ compact = false }: { compact?: boolean }) {
  const current = useStore((s) => s.celebrations[0])

  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => actions.dismissCelebration(), 3600)
    return () => clearTimeout(t)
  }, [current])

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.amount}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => actions.dismissCelebration()}
        >
          <motion.div
            className={`card relative flex flex-col items-center text-center ${compact ? 'w-[min(300px,90vw)] p-5' : 'w-[min(420px,90vw)] p-8'}`}
            initial={{ scale: 0.3, rotate: -12, y: 60 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            exit={{ scale: 0.6, opacity: 0, y: -40 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.55 }}
          >
            <div className="font-display text-sm tracking-[0.25em] text-hot">NEW BADGE UNLOCKED</div>
            <div
              className="shimmer relative my-4 flex items-center justify-center overflow-hidden rounded-full border-[6px] border-white shadow-[0_8px_0_rgba(43,27,74,0.15)]"
              style={{
                width: compact ? 110 : 150,
                height: compact ? 110 : 150,
                background: `radial-gradient(circle at 35% 30%, #fff 0 8%, ${current.color} 60%)`,
                fontSize: compact ? 54 : 74,
              }}
            >
              {current.emoji}
            </div>
            <div className="font-display text-ink" style={{ fontSize: compact ? 24 : 34, lineHeight: 1.05 }}>
              {current.title}
            </div>
            <div className="mt-1 rounded-full px-3 py-0.5 font-display text-white" style={{ background: current.color }}>
              ${current.amount} in the jar
            </div>
            {!compact && <p className="mt-3 text-ink-soft">{current.blurb}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
