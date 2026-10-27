import { AnimatePresence, motion } from 'framer-motion'
import { actions, useStore } from '../state/store'
import { formatDuration } from './StatsPanel'

export function HistoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const history = useStore((s) => s.history)
  const max = Math.max(1, ...history.map((h) => h.total))
  const lifetime = history.reduce((a, h) => a + h.total, 0)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-[min(420px,100vw)] flex-col gap-4 bg-cream p-6 shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-3xl">🗓 Past Meetings</h2>
              <button className="btn btn-ghost h-10 w-10 text-lg" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="card flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold text-ink-soft">Lifetime swear tax</span>
              <span className="font-display text-3xl text-mint">${lifetime}</span>
            </div>
            <ul className="scroll-soft flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {history.length === 0 && (
                <li className="py-10 text-center text-ink-soft">
                  No past sessions yet.
                  <br />
                  Empty the jar to save one here.
                </li>
              )}
              {history.map((h) => (
                <li key={h.id} className="group card relative px-4 py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">
                      {new Date(h.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                      <span className="ml-1.5 text-ink-soft">{new Date(h.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                    </span>
                    <span className="font-display text-2xl text-mint">${h.total}</span>
                  </div>
                  <div className="my-1.5 h-2.5 overflow-hidden rounded-full bg-ink/8">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold to-hot" style={{ width: `${(h.total / max) * 100}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-ink-soft">
                    <span>🤬 {h.count} swears</span>
                    <span>⏱ {formatDuration(h.durationMs)}</span>
                    {h.topWord && <span>⭐ {h.topWord}</span>}
                    {h.bestCombo > 1 && <span>🔥 x{h.bestCombo}</span>}
                  </div>
                  <button
                    className="absolute right-2 top-2 hidden rounded-full bg-white px-2 text-xs text-ink-soft shadow group-hover:block"
                    onClick={() => actions.deleteHistory(h.id)}
                    title="Delete"
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
            {history.length > 0 && (
              <button className="self-center text-xs font-semibold text-ink-soft underline" onClick={() => confirm('Delete all saved sessions?') && actions.deleteHistory()}>
                Clear history
              </button>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
