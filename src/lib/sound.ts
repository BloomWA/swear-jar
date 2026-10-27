/**
 * All sound effects are synthesised with Web Audio, so there are no
 * asset files and nothing to download.
 */

const MUTE_KEY = 'swearjar:muted'

class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private lastClink = 0
  muted = (() => {
    try {
      return localStorage.getItem(MUTE_KEY) === '1'
    } catch {
      return false
    }
  })()

  /** Call from a user gesture (click) so the browser lets us play audio. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.55
      const comp = this.ctx.createDynamicsCompressor()
      this.master.connect(comp).connect(this.ctx.destination)
      const len = this.ctx.sampleRate
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(m: boolean) {
    this.muted = m
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0')
    } catch {
      /* private mode */
    }
  }

  private ready(): AudioContext | null {
    if (this.muted || !this.ctx || !this.master) return null
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine', endFreq?: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(gain, start + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(g).connect(this.master!)
    osc.start(start)
    osc.stop(start + dur + 0.02)
  }

  private noise(start: number, dur: number, gain: number, freq: number, q = 1, endFreq?: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(freq, start)
    if (endFreq) filter.frequency.exponentialRampToValueAtTime(endFreq, start + dur)
    filter.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, start)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    src.connect(filter).connect(g).connect(this.master!)
    src.start(start, Math.random() * 0.5)
    src.stop(start + dur + 0.02)
  }

  /** Metallic coin-on-glass clink. `intensity` 0..1 from impact speed. */
  clink(intensity = 1) {
    const ctx = this.ready()
    if (!ctx) return
    const now = ctx.currentTime
    if (now - this.lastClink < 0.045) return // don't machine-gun on big piles
    this.lastClink = now
    const f = 2200 + Math.random() * 1400
    const g = 0.05 + 0.22 * Math.min(1, intensity)
    this.tone(f, now, 0.18 + 0.2 * intensity, g)
    this.tone(f * 2.76, now, 0.12, g * 0.5)
    this.tone(f * 5.4, now, 0.06, g * 0.25)
  }

  /** The classic TV censor bleep. */
  bleep() {
    const ctx = this.ready()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.value = 1000
    g.gain.setValueAtTime(0.0001, now)
    g.gain.linearRampToValueAtTime(0.12, now + 0.01)
    g.gain.setValueAtTime(0.12, now + 0.2)
    g.gain.linearRampToValueAtTime(0.0001, now + 0.23)
    osc.connect(g).connect(this.master!)
    osc.start(now)
    osc.stop(now + 0.25)
  }

  /** Cash register: bell, drawer rattle, bell. */
  kaching() {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    const bell = (at: number, f: number) => {
      this.tone(f, at, 0.9, 0.22, 'sine')
      this.tone(f * 2.01, at, 0.6, 0.1, 'sine')
      this.tone(f * 3.03, at, 0.35, 0.05, 'triangle')
    }
    this.noise(t, 0.12, 0.35, 3000, 0.8)
    bell(t + 0.05, 1318.5)
    this.noise(t + 0.18, 0.28, 0.3, 5000, 0.6, 1500)
    bell(t + 0.32, 1760)
  }

  /** Rising arpeggio, higher for bigger combos. */
  combo(level: number) {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    const base = 440 * Math.pow(2, Math.min(level, 12) / 12)
    ;[0, 4, 7, 12].forEach((semi, i) => {
      this.tone(base * Math.pow(2, semi / 12), t + i * 0.07, 0.22, 0.09, 'square')
    })
  }

  /** Tiny pop for buttons. */
  pop() {
    const ctx = this.ready()
    if (!ctx) return
    this.tone(700, ctx.currentTime, 0.09, 0.15, 'sine', 300)
  }

  /** Coins rattling while the jar is shaken. */
  rattle(duration = 0.9) {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    for (let i = 0; i < 26; i++) {
      const at = t + Math.random() * duration
      const f = 2000 + Math.random() * 2500
      this.tone(f, at, 0.08, 0.04 + Math.random() * 0.06)
    }
  }

  /** Whoosh + cascade when the jar is tipped out. */
  pour() {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    this.noise(t, 0.7, 0.25, 600, 0.7, 3000)
    for (let i = 0; i < 40; i++) {
      const at = t + 0.2 + Math.random() * 1.1
      this.tone(1800 + Math.random() * 2600, at, 0.1, 0.03 + Math.random() * 0.05)
    }
  }

  /** Little fanfare for badges. */
  fanfare() {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5]
    const times = [0, 0.1, 0.2, 0.3, 0.48, 0.58]
    notes.forEach((f, i) => this.tone(f, t + times[i], i === 5 ? 0.6 : 0.16, 0.12, 'triangle'))
  }
}

export const sfx = new Sfx()
