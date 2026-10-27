import { LevelMeter, openInput, stopStream, type InputDevice } from './audio'
import type { EngineCallbacks, EngineOptions, SpeechEngine, TranscriptPiece } from './types'

interface DGWord {
  word: string
  punctuated_word?: string
  speaker?: number
}

/**
 * Deepgram live streaming. profanity_filter=false gives us the words
 * uncensored, and diarize=true gives speaker labels for "who said it".
 * NOTE: this streams audio to Deepgram's servers.
 */
export class DeepgramEngine implements SpeechEngine {
  private ws: WebSocket | null = null
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private meter: LevelMeter | null = null
  private keepAlive = 0
  private running = false

  constructor(
    private opts: EngineOptions,
    private cb: EngineCallbacks,
    private devices: InputDevice[],
  ) {}

  async start() {
    const key = this.opts.deepgramKey?.trim()
    if (!key) throw new Error('Add your Deepgram API key in the audio settings first.')
    this.running = true
    this.cb.onStatus('loading', 'Connecting to Deepgram…')
    this.stream = await openInput(this.opts.deviceId, this.devices)
    this.meter = new LevelMeter(this.stream, (l) => this.cb.onLevel?.(l))

    const params = new URLSearchParams({
      model: 'nova-3',
      language: 'en',
      profanity_filter: 'false',
      punctuate: 'true',
      smart_format: 'false',
      interim_results: 'true',
      endpointing: '250',
      diarize: this.opts.diarize ? 'true' : 'false',
    })
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', key])
    this.ws = ws

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error('Could not connect to Deepgram. Check your API key and network.'))
    })

    ws.onmessage = (e) => this.handle(e.data)
    ws.onclose = (e) => {
      if (!this.running) return
      this.cb.onStatus('error', e.code === 1008 || e.code === 4001 ? 'Deepgram rejected the API key.' : `Deepgram disconnected (${e.code}).`)
      this.stop(false)
    }

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined)
    this.recorder.ondataavailable = (e) => {
      if (e.data.size && ws.readyState === WebSocket.OPEN) ws.send(e.data)
    }
    this.recorder.start(250)
    this.keepAlive = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'KeepAlive' }))
    }, 8000)
    this.cb.onStatus('listening', 'Listening · Deepgram')
  }

  private handle(raw: string) {
    let data: {
      type?: string
      start?: number
      is_final?: boolean
      channel?: { alternatives?: { transcript: string; words?: DGWord[] }[] }
    }
    try {
      data = JSON.parse(raw)
    } catch {
      return
    }
    if (data.type !== 'Results') return
    const alt = data.channel?.alternatives?.[0]
    if (!alt?.transcript) return
    const pieces: TranscriptPiece[] = []
    if (this.opts.diarize && alt.words?.length) {
      // group consecutive words by speaker
      for (const w of alt.words) {
        const speaker = w.speaker != null ? `Speaker ${w.speaker + 1}` : undefined
        const last = pieces[pieces.length - 1]
        const word = w.punctuated_word ?? w.word
        if (last && last.speaker === speaker) last.text += ' ' + word
        else pieces.push({ text: word, speaker })
      }
    } else {
      pieces.push({ text: alt.transcript })
    }
    this.cb.onTranscript(`dg:${data.start}`, pieces, !!data.is_final)
  }

  stop(report = true) {
    this.running = false
    clearInterval(this.keepAlive)
    if (this.recorder?.state === 'recording') this.recorder.stop()
    this.recorder = null
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'CloseStream' }))
      this.ws.close()
    }
    this.ws = null
    this.meter?.close()
    this.meter = null
    stopStream(this.stream)
    this.stream = null
    if (report) this.cb.onStatus('idle')
  }
}
