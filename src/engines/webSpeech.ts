import { LevelMeter, stopStream } from './audio'
import type { EngineCallbacks, SpeechEngine } from './types'

type SRCtor = new () => SpeechRecognition

function getSR(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const webSpeechSupported = () => !!getSR()

/**
 * Chrome's built-in recogniser. Chrome censors profanity ("f***"), which
 * the detector un-censors. It always uses the OS default microphone.
 */
export class WebSpeechEngine implements SpeechEngine {
  private rec: SpeechRecognition | null = null
  private running = false
  private session = 0
  private meterStream: MediaStream | null = null
  private meter: LevelMeter | null = null

  constructor(private cb: EngineCallbacks) {}

  async start() {
    const SR = getSR()
    if (!SR) throw new Error('This browser has no Web Speech API. Use Chrome or Edge, or switch to Whisper.')
    this.running = true

    // A separate stream just for the level meter (also triggers the permission prompt).
    this.meterStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.meter = new LevelMeter(this.meterStream, (l) => this.cb.onLevel?.(l))

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.maxAlternatives = 1
    rec.onresult = (e: SpeechRecognitionEvent) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        this.cb.onTranscript(`ws:${this.session}:${i}`, [{ text: r[0].transcript }], r.isFinal)
      }
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.cb.onStatus('error', 'Microphone permission was blocked.')
        this.stop(false)
      } else if (e.error === 'network') {
        this.cb.onStatus('error', 'Web Speech needs an internet connection (it uses Google’s servers).')
        this.stop(false)
      }
    }
    // Chrome ends the session after silence or ~60s; quietly restart.
    rec.onend = () => {
      if (!this.running) return
      this.session++
      try {
        rec.start()
      } catch {
        /* already started */
      }
    }
    this.rec = rec
    this.session++
    rec.start()
    this.cb.onStatus('listening', 'Listening · Web Speech')
  }

  stop(report = true) {
    this.running = false
    try {
      this.rec?.abort()
    } catch {
      /* not started */
    }
    this.rec = null
    this.meter?.close()
    this.meter = null
    stopStream(this.meterStream)
    this.meterStream = null
    if (report) this.cb.onStatus('idle')
  }
}
