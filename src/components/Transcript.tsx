import { Fragment } from 'react'
import { detectSwears, tokenize } from '../lib/detector'
import { actions, useStore } from '../state/store'

/** Renders a line with swears replaced by bleeped pills. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\s+)/)
  return (
    <>
      {parts.map((p, i) => {
        const token = tokenize(p)[0]
        const hit = token ? detectSwears(token)[0] : undefined
        return hit ? (
          <span key={i} className="mx-0.5 rounded-md px-1.5 font-display text-white" style={{ background: hit.color }}>
            {hit.bleeped}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      })}
    </>
  )
}

export function Transcript() {
  const lines = useStore((s) => s.transcript)
  const show = useStore((s) => s.settings.showTranscript)
  return (
    <div className="card px-4 py-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-display text-base">👂 What the jar heard</span>
        <button
          className="text-xs font-semibold text-grape underline"
          onClick={() => actions.updateSettings({ showTranscript: !show })}
          title="Hide the transcript while screen-sharing"
        >
          {show ? 'hide' : 'show'}
        </button>
      </div>
      {show ? (
        <div className="flex min-h-[3.2rem] flex-col justify-end gap-0.5 text-sm">
          {lines.length === 0 && <span className="text-ink-soft">Nothing yet. Start listening or try Test Mode.</span>}
          {lines.slice(-3).map((l, i, arr) => (
            <div key={l.id} className={`truncate ${l.final ? '' : 'italic text-ink-soft'}`} style={{ opacity: 0.45 + (0.55 * (i + 1)) / arr.length }}>
              {l.speaker && <b className="mr-1">{l.speaker}:</b>}
              <Highlighted text={l.text} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-ink-soft">Transcript hidden 🙈</div>
      )}
    </div>
  )
}
