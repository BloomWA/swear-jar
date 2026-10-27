/// <reference lib="webworker" />
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

env.allowLocalModels = false

// The library's overloads are too deep for tsc; narrow it to the one we use.
const makeAsr = pipeline as unknown as (task: 'automatic-speech-recognition', model: string, opts: object) => Promise<AutomaticSpeechRecognitionPipeline>

let asr: AutomaticSpeechRecognitionPipeline | null = null
let multilingual = true

type InMsg = { type: 'load'; model: string } | { type: 'transcribe'; id: number; audio: Float32Array }

const post = (m: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m)

async function hasWebGPU() {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    return !!(gpu && (await gpu.requestAdapter()))
  } catch {
    return false
  }
}

async function load(model: string) {
  const webgpu = await hasWebGPU()
  const device = webgpu ? 'webgpu' : 'wasm'
  multilingual = !model.endsWith('.en')
  const progress_callback = (p: { status: string; file?: string; progress?: number }) => {
    if (p.status === 'progress') post({ type: 'progress', file: p.file, progress: p.progress })
  }
  // Preferred quantisation per backend, then fall back to the library default.
  const attempts: Array<Record<string, unknown>> = webgpu
    ? [{ dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' } }, {}]
    : [{ dtype: 'q8' }, {}]
  let lastErr: unknown
  for (const extra of attempts) {
    try {
      asr = await makeAsr('automatic-speech-recognition', model, { device, progress_callback, ...extra })
      break
    } catch (e) {
      lastErr = e
    }
  }
  if (!asr) throw lastErr
  // Warm up so the first real chunk isn't slow.
  await asr(new Float32Array(16000), multilingual ? { language: 'english', task: 'transcribe' } : {})
  post({ type: 'ready', device })
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data
  try {
    if (msg.type === 'load') {
      await load(msg.model)
    } else if (msg.type === 'transcribe') {
      if (!asr) throw new Error('Model not loaded')
      const out = await asr(msg.audio, multilingual ? { language: 'english', task: 'transcribe' } : {})
      const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text
      post({ type: 'result', id: msg.id, text })
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
