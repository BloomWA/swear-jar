import { openInput, stopStream, type InputDevice } from './audio'
import type { EngineCallbacks, EngineOptions, SpeechEngine } from './types'

const TARGET_RATE = 16000

/** One worker + loaded model, shared across start/stop so pausing is instant. */
let shared: { model: string; worker: Worker; ready: Promise<string> } | null = null

function getWorker(model: string, cb: EngineCallbacks) {
  if (shared && shared.model === model) return shared
  shared?.worker.terminate()
  const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
  const files = new Map<string, number>()
  const ready = new Promise<string>((resolve, reject) => {
    worker.addEventListener('message', function onMsg(e) {
      const m = e.data
      if (m.type === 'progress' && m.file) {
        files.set(m.file, m.progress ?? 0)
        const avg = [...files.values()].reduce((a, b) => a + b, 0) / files.size
        cb.onStatus('loading', 'Downloading Whisper model (one-time)…', avg / 100)
      } else if (m.type === 'ready') {
        worker.removeEventListener('message', onMsg)
        resolve(m.device)
      } else if (m.type === 'error') {
        worker.removeEventListener('message', onMsg)
        reject(new Error(m.message))
      }
    })
  })
  ready.catch(() => {
    if (shared?.worker === worker) shared = null
    worker.terminate()
  })
  worker.postMessage({ type: 'load', model })
  shared = { model, worker, ready }
  return shared
}

function downsample(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === TARGET_RATE) return input
  const ratio = fromRate / TARGET_RATE
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio
    const i0 = Math.floor(pos)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const f = pos - i0
    out[i] = input[i0] * (1 - f) + input[i1] * f
  }
  return out
}

/**
 * Local Whisper: we cut the audio into utterances at natural pauses
 * (so words aren't sliced in half), skip silence (Whisper hallucinates
 * on it), and transcribe each chunk in a Web Worker.
 */
export class WhisperEngine implements SpeechEngine {
  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private running = false
  private seq = 0
  private chunks: Float32Array[] = []
  private chunkLen = 0
  private speechMs = 0
  private silentMs = 0
  private noiseFloor = 0.004
  private busy = false
  private queue: Float32Array[] = []
  private onWorkerMsg = (e: MessageEvent) => this.handleWorker(e)
  private worker: Worker | null = null

  constructor(
    private opts: EngineOptions,
    private cb: EngineCallbacks,
    private devices: InputDevice[],
  ) {}

  async start() {
    this.running = true
    const model = this.opts.whisperModel || 'onnx-community/whisper-base'
    const w = getWorker(model, this.cb)
    this.cb.onStatus('loading', 'Loading Whisper…', 0)
    let device: string
    try {
      device = await w.ready
    } catch (e) {
      this.running = false
      throw new Error(`Couldn't load Whisper: ${(e as Error).message}`)
    }
    if (!this.running) return
    this.worker = w.worker
    this.worker.addEventListener('message', this.onWorkerMsg)

    this.stream = await openInput(this.opts.deviceId, this.devices)
    this.ctx = new AudioContext()
    await this.ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}capture-worklet.js`)
    const src = this.ctx.createMediaStreamSource(this.stream)
    const node = new AudioWorkletNode(this.ctx, 'capture-processor')
    const sink = this.ctx.createGain()
    sink.gain.value = 0
    src.connect(node).connect(sink).connect(this.ctx.destination)
    const rate = this.ctx.sampleRate
    node.port.onmessage = (e: MessageEvent<Float32Array>) => this.onAudio(downsample(e.data, rate))
    this.cb.onStatus('listening', `Listening · Whisper on ${device === 'webgpu' ? 'GPU' : 'CPU'}`)
  }

  stop() {
    this.running = false
    this.worker?.removeEventListener('message', this.onWorkerMsg)
    this.worker = null
    stopStream(this.stream)
    this.stream = null
    void this.ctx?.close()
    this.ctx = null
    this.chunks = []
    this.chunkLen = 0
    this.queue = []
    this.busy = false
    this.cb.onStatus('idle')
  }

  private onAudio(frame: Float32Array) {
    if (!this.running) return
    let sum = 0
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
    const rms = Math.sqrt(sum / frame.length)
    this.cb.onLevel?.(Math.min(1, rms * 6))

    const ms = (frame.length / TARGET_RATE) * 1000
    // slowly track the background noise level
    this.noiseFloor = rms < this.noiseFloor ? this.noiseFloor * 0.9 + rms * 0.1 : this.noiseFloor * 0.998 + rms * 0.002
    const loud = rms > Math.max(0.01, this.noiseFloor * 2.5)

    this.chunks.push(frame)
    this.chunkLen += frame.length
    if (loud) {
      this.speechMs += ms
      this.silentMs = 0
    } else {
      this.silentMs += ms
    }
    const lenMs = (this.chunkLen / TARGET_RATE) * 1000

    if (this.speechMs < 150 && this.silentMs > 1000) {
      // nothing but silence: keep a short pre-roll and drop the rest
      const keep = this.chunks.slice(-4)
      this.chunks = keep
      this.chunkLen = keep.reduce((a, c) => a + c.length, 0)
      this.speechMs = 0
      return
    }
    const pauseEnded = lenMs > 1200 && this.silentMs > 380 && this.speechMs > 200
    if (pauseEnded || lenMs > 8000) this.flush()
  }

  private flush() {
    const audio = new Float32Array(this.chunkLen)
    let o = 0
    for (const c of this.chunks) {
      audio.set(c, o)
      o += c.length
    }
    this.chunks = []
    this.chunkLen = 0
    this.speechMs = 0
    this.silentMs = 0
    this.queue.push(audio)
    if (this.queue.length > 4) this.queue.shift() // fall behind gracefully
    this.pump()
  }

  private pump() {
    if (this.busy || !this.worker || !this.queue.length) return
    this.busy = true
    const audio = this.queue.shift()!
    this.worker.postMessage({ type: 'transcribe', id: ++this.seq, audio }, [audio.buffer])
  }

  private handleWorker(e: MessageEvent) {
    const m = e.data
    if (m.type === 'result') {
      this.busy = false
      const text = String(m.text || '')
        .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ') // [BLANK_AUDIO], (music)
        .trim()
      if (text) this.cb.onTranscript(`whisper:${m.id}`, [{ text }], true)
      this.pump()
    } else if (m.type === 'error') {
      this.busy = false
      console.warn('[whisper]', m.message)
      this.pump()
    }
  }
}
