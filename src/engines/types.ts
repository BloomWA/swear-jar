export type EngineId = 'whisper' | 'webspeech' | 'deepgram'

export type EngineStatus = 'idle' | 'loading' | 'listening' | 'error'

export interface TranscriptPiece {
  text: string
  /** Speaker label, if the engine supports diarisation. */
  speaker?: string
}

export interface EngineCallbacks {
  /**
   * A (possibly partial) transcript for one utterance. The same
   * `segmentId` may arrive many times as interim results are refined.
   */
  onTranscript(segmentId: string, pieces: TranscriptPiece[], isFinal: boolean): void
  onStatus(status: EngineStatus, message?: string, progress?: number): void
  onLevel?(level: number): void
}

export interface EngineOptions {
  deviceId?: string
  deepgramKey?: string
  whisperModel?: string
  diarize?: boolean
}

export interface SpeechEngine {
  start(): Promise<void>
  stop(): void
}

export interface EngineInfo {
  id: EngineId
  name: string
  emoji: string
  tagline: string
  privacy: string
  /** Whether audio leaves the machine. */
  cloud: boolean
  supportsDevicePicker: boolean
}

export const ENGINES: EngineInfo[] = [
  {
    id: 'whisper',
    name: 'Whisper (local)',
    emoji: '🔒',
    tagline: 'Private, uncensored, any input device. ~1–3s delay.',
    privacy: 'Runs in your browser. Audio never leaves your machine (model downloads once from Hugging Face).',
    cloud: false,
    supportsDevicePicker: true,
  },
  {
    id: 'webspeech',
    name: 'Chrome Web Speech',
    emoji: '⚡',
    tagline: 'Instant, zero setup. Mic only, Chrome/Edge.',
    privacy: 'Chrome sends audio to Google’s speech servers. Uses your OS default mic (device picker ignored).',
    cloud: true,
    supportsDevicePicker: false,
  },
  {
    id: 'deepgram',
    name: 'Deepgram (cloud)',
    emoji: '☁️',
    tagline: 'Fastest, knows who said it. Needs an API key.',
    privacy: 'Streams audio to Deepgram’s servers using your own API key.',
    cloud: true,
    supportsDevicePicker: true,
  },
]

export const WHISPER_MODELS = [
  { id: 'onnx-community/whisper-tiny', label: 'Tiny · ~40 MB · fastest' },
  { id: 'onnx-community/whisper-base', label: 'Base · ~80 MB · recommended' },
  { id: 'onnx-community/whisper-small', label: 'Small · ~250 MB · most accurate (needs WebGPU)' },
]
