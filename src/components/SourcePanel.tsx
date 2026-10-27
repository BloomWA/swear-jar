import { useEffect, useState } from 'react'
import { DISPLAY_AUDIO, hasDeviceLabels, listInputs, requestLabels, type InputDevice } from '../engines/audio'
import { ENGINES, WHISPER_MODELS, type EngineId } from '../engines/types'
import { webSpeechSupported } from '../engines/webSpeech'
import { sfx } from '../lib/sound'
import { restartIfListening } from '../state/game'
import { actions, useStore, type Settings } from '../state/store'

function LevelMeter() {
  const level = useStore((s) => s.level)
  const bars = 16
  return (
    <div className="flex h-6 items-end gap-[3px]" aria-label="input level">
      {Array.from({ length: bars }, (_, i) => {
        const on = level * bars * 1.4 > i
        const hue = i < bars * 0.6 ? '#22c55e' : i < bars * 0.85 ? '#ffb020' : '#ff4f81'
        return (
          <span
            key={i}
            className="w-[5px] rounded-full transition-all duration-75"
            style={{ height: `${30 + (i / bars) * 70}%`, background: on ? hue : 'rgba(43,27,74,0.1)' }}
          />
        )
      })}
    </div>
  )
}

export function SourcePanel() {
  const settings = useStore((s) => s.settings)
  const status = useStore((s) => s.status)
  const engineStatus = useStore((s) => s.engineStatus)
  const message = useStore((s) => s.engineMessage)
  const progress = useStore((s) => s.engineProgress)
  const [devices, setDevices] = useState<InputDevice[]>([])
  const engine = ENGINES.find((e) => e.id === settings.engine)!

  const refresh = () => listInputs().then(setDevices).catch(() => setDevices([]))
  useEffect(() => {
    void refresh()
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refresh)
  }, [])
  // labels appear once permission is granted, e.g. after starting
  useEffect(() => {
    if (status === 'listening') void refresh()
  }, [status, engineStatus])

  const update = (patch: Partial<Settings>, restart = true) => {
    actions.updateSettings(patch)
    if (restart) void restartIfListening()
  }

  const hasLoopback = devices.some((d) => d.isLoopback)

  return (
    <div className="card flex flex-col gap-4 p-5">
      <h2 className="font-display text-2xl">🎧 Ears</h2>

      <div className="grid gap-2">
        {ENGINES.map((e) => {
          const active = e.id === settings.engine
          const unsupported = e.id === 'webspeech' && !webSpeechSupported()
          return (
            <button
              key={e.id}
              disabled={unsupported}
              onClick={() => {
                sfx.pop()
                update({ engine: e.id as EngineId })
              }}
              className={`flex items-start gap-3 rounded-2xl border-[3px] px-3 py-2.5 text-left transition-all ${
                active ? 'border-grape bg-grape/10 shadow-[0_4px_0_#a855f733]' : 'border-transparent bg-white hover:-translate-y-0.5 hover:border-grape/30'
              } ${unsupported ? 'opacity-50' : ''}`}
            >
              <span className="text-2xl leading-none">{e.emoji}</span>
              <span className="flex-1">
                <span className="flex items-center gap-2 font-display text-base">
                  {e.name}
                  {e.id === 'whisper' && <span className="chip bg-mint/15 py-0 text-[10px] text-mint-dark">RECOMMENDED</span>}
                </span>
                <span className="block text-xs leading-snug text-ink-soft">{unsupported ? 'Not supported in this browser' : e.tagline}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className={`rounded-2xl px-3 py-2 text-xs leading-snug ${engine.cloud ? 'bg-gold/15 text-[#8a5a00]' : 'bg-mint/12 text-mint-dark'}`}>
        <b>{engine.cloud ? '☁️ Heads up: ' : '🔒 Private: '}</b>
        {engine.privacy}
      </div>

      {engine.supportsDevicePicker ? (
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-sm font-semibold">
            Audio source
            {!hasDeviceLabels(devices) && (
              <button className="text-xs font-semibold text-grape underline" onClick={() => requestLabels().then(refresh).catch(() => {})}>
                show device names
              </button>
            )}
          </span>
          <select className="field" value={settings.deviceId} onChange={(e) => update({ deviceId: e.target.value })}>
            {devices.length === 0 && <option value="default">Default microphone</option>}
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.isLoopback ? '🔊 ' : '🎙️ '}
                {d.label}
                {d.isLoopback ? '  (system audio)' : ''}
              </option>
            ))}
            <option value={DISPLAY_AUDIO}>🖥️ Share a tab / screen’s audio…</option>
          </select>
          <span className="text-xs leading-snug text-ink-soft">
            {settings.deviceId === DISPLAY_AUDIO
              ? 'Chrome will ask what to share. Tick “Share tab audio” (Zoom web) or “Share system audio” (Windows / newer macOS).'
              : hasLoopback
                ? 'Pick the 🔊 device to hear everyone on the call, not just you.'
                : 'Mic catches you. To catch the whole call, set up a loopback device (BlackHole / Stereo Mix) — see README.'}
          </span>
        </label>
      ) : (
        <p className="rounded-2xl bg-white px-3 py-2 text-xs text-ink-soft">
          Web Speech always uses your <b>system default</b> input. To catch the whole call, switch to Whisper and pick a loopback device.
        </p>
      )}

      {settings.engine === 'whisper' && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Whisper model</span>
          <select className="field" value={settings.whisperModel} onChange={(e) => update({ whisperModel: e.target.value })}>
            {WHISPER_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {settings.engine === 'deepgram' && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Deepgram API key</span>
            <input
              className="field"
              type="password"
              placeholder="paste key (stored only in this browser)"
              value={settings.deepgramKey}
              onChange={(e) => update({ deepgramKey: e.target.value }, false)}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4 accent-grape" checked={settings.diarize} onChange={(e) => update({ diarize: e.target.checked })} />
            “Who said it” mode (speaker labels)
          </label>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2">
        <div className="min-w-0 flex-1 text-xs">
          {engineStatus === 'error' ? (
            <span className="font-semibold text-hot">⚠️ {message}</span>
          ) : status === 'listening' ? (
            <span className="flex items-center gap-2 font-semibold">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${engineStatus === 'listening' ? 'live-dot bg-mint' : 'bg-gold'}`} />
              <span className="truncate">{message ?? 'Starting…'}</span>
            </span>
          ) : (
            <span className="text-ink-soft">Not listening</span>
          )}
          {engineStatus === 'loading' && progress != null && progress > 0 && (
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-grape transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
        </div>
        <LevelMeter />
      </div>
    </div>
  )
}
