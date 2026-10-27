import { sfx } from '../lib/sound'
import { emptyJar, pauseListening, startListening } from '../state/game'
import { useStore } from '../state/store'

export function Controls({ compact = false }: { compact?: boolean }) {
  const status = useStore((s) => s.status)
  const engineStatus = useStore((s) => s.engineStatus)
  const progress = useStore((s) => s.engineProgress)
  const pouring = useStore((s) => s.pouring)
  const total = useStore((s) => s.total)
  const loading = engineStatus === 'loading' && status === 'listening'
  const listening = status === 'listening'

  const size = compact ? 'px-4 py-2 text-base' : 'px-7 py-3.5 text-xl'

  return (
    <div className={`flex flex-wrap items-center justify-center ${compact ? 'gap-2' : 'gap-4'}`}>
      {listening ? (
        <button
          className={`btn btn-gold ${size}`}
          onClick={() => {
            sfx.pop()
            pauseListening()
          }}
        >
          {loading ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-white border-t-transparent" />
              {progress != null && progress > 0 ? `Loading ${Math.round(progress * 100)}%` : 'Warming up…'}
            </>
          ) : (
            <>⏸ Pause</>
          )}
        </button>
      ) : (
        <button
          className={`btn btn-mint ${size}`}
          onClick={() => {
            sfx.unlock()
            sfx.pop()
            void startListening()
          }}
        >
          {status === 'paused' ? '▶ Resume' : compact ? '🎙️ Start' : '🎙️ Start listening'}
        </button>
      )}
      <button className={`btn ${size}`} disabled={pouring || total === 0} onClick={() => void emptyJar()} title="Shake the jar out and save this session to history">
        🫗 {compact ? 'Empty' : 'Empty the jar'}
      </button>
    </div>
  )
}
