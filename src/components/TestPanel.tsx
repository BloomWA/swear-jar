import { useEffect, useState } from 'react'
import { sfx } from '../lib/sound'
import { makeItRain, simulateCombo, simulateLine } from '../state/game'

export function TestPanel() {
  const [auto, setAuto] = useState(false)
  const [custom, setCustom] = useState('')

  useEffect(() => {
    if (!auto) return
    let t = 0
    const loop = () => {
      simulateLine()
      t = window.setTimeout(loop, 1200 + Math.random() * 3200)
    }
    t = window.setTimeout(loop, 300)
    return () => clearTimeout(t)
  }, [auto])

  return (
    <div className="card flex flex-col gap-3 p-5">
      <h2 className="flex items-center justify-between font-display text-2xl">
        🧪 Test Mode
        <span className="chip bg-grape/10 text-[11px] text-grape">no mic needed</span>
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-sky px-3 py-2 text-sm" onClick={() => simulateLine()}>
          🤬 One swear
        </button>
        <button className="btn btn-grape px-3 py-2 text-sm" onClick={() => simulateCombo(5)}>
          ⚓ Combo x5
        </button>
        <button className="btn btn-gold px-3 py-2 text-sm" onClick={() => makeItRain(25)}>
          💰 Make it rain
        </button>
        <button
          className={`btn px-3 py-2 text-sm ${auto ? 'btn-mint' : 'btn-ghost'}`}
          onClick={() => {
            sfx.unlock()
            setAuto((a) => !a)
          }}
        >
          {auto ? '⏹ Stop demo' : '🎬 Auto demo'}
        </button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (custom.trim()) simulateLine(custom)
          setCustom('')
        }}
      >
        <input className="field py-1.5 text-sm" placeholder='Type a fake transcript, e.g. "oh f***"' value={custom} onChange={(e) => setCustom(e.target.value)} />
        <button className="btn btn-ghost shrink-0 px-3 py-1.5 text-sm" type="submit">
          Say it
        </button>
      </form>
    </div>
  )
}
