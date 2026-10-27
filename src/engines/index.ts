import type { InputDevice } from './audio'
import { DeepgramEngine } from './deepgram'
import type { EngineCallbacks, EngineId, EngineOptions, SpeechEngine } from './types'
import { WebSpeechEngine } from './webSpeech'
import { WhisperEngine } from './whisper'

export function createEngine(id: EngineId, opts: EngineOptions, cb: EngineCallbacks, devices: InputDevice[]): SpeechEngine {
  switch (id) {
    case 'webspeech':
      return new WebSpeechEngine(cb)
    case 'deepgram':
      return new DeepgramEngine(opts, cb, devices)
    default:
      return new WhisperEngine(opts, cb, devices)
  }
}
