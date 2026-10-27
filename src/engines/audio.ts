/** Audio input helpers: device listing, opening streams, level metering. */

/** Special device id: capture a tab / screen's audio via getDisplayMedia. */
export const DISPLAY_AUDIO = '__display__'

export interface InputDevice {
  deviceId: string
  label: string
  /** Looks like a loopback / system-audio device. */
  isLoopback: boolean
}

const LOOPBACK_RE = /blackhole|loopback|stereo mix|what u hear|wave out|cable output|vb-audio|voicemeeter|soundflower|monitor of|aggregate|multi-output|zoomaudiodevice/i

export async function listInputs(): Promise<InputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || (d.deviceId === 'default' ? 'Default microphone' : `Microphone ${i + 1}`),
      isLoopback: LOOPBACK_RE.test(d.label),
    }))
}

export function hasDeviceLabels(devices: InputDevice[]) {
  return devices.some((d) => d.label && !/^Microphone \d+$|^Default microphone$/.test(d.label))
}

/** Ask for mic permission once so device labels become visible. */
export async function requestLabels() {
  const s = await navigator.mediaDevices.getUserMedia({ audio: true })
  s.getTracks().forEach((t) => t.stop())
}

/**
 * Open an input stream. Loopback devices get echo cancellation and noise
 * suppression turned OFF — otherwise the browser "cancels" the very
 * meeting audio we want to hear.
 */
export async function openInput(deviceId: string | undefined, devices: InputDevice[] = []): Promise<MediaStream> {
  if (deviceId === DISPLAY_AUDIO) {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      // Chrome: offer "share system audio" in the picker
      ...({ systemAudio: 'include', selfBrowserSurface: 'exclude' } as object),
    } as DisplayMediaStreamOptions)
    if (!stream.getAudioTracks().length) {
      stream.getTracks().forEach((t) => t.stop())
      throw new Error('No audio was shared. Tick "Share tab audio" / "Share system audio" in the picker.')
    }
    // We only want the sound; keep the video track alive but idle.
    stream.getVideoTracks().forEach((t) => (t.enabled = false))
    return stream
  }
  const loop = devices.find((d) => d.deviceId === deviceId)?.isLoopback ?? false
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId && deviceId !== 'default' ? { exact: deviceId } : undefined,
      echoCancellation: !loop,
      noiseSuppression: !loop,
      autoGainControl: !loop,
      channelCount: 1,
    },
  })
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop())
}

/** Polls an analyser and reports a 0..1 loudness level. */
export class LevelMeter {
  private ctx: AudioContext
  private analyser: AnalyserNode
  private timer = 0
  private buf: Float32Array<ArrayBuffer>

  constructor(stream: MediaStream, onLevel: (level: number) => void) {
    this.ctx = new AudioContext()
    const src = this.ctx.createMediaStreamSource(stream)
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 1024
    this.buf = new Float32Array(this.analyser.fftSize)
    src.connect(this.analyser)
    this.timer = window.setInterval(() => {
      this.analyser.getFloatTimeDomainData(this.buf)
      let sum = 0
      for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i]
      const rms = Math.sqrt(sum / this.buf.length)
      onLevel(Math.min(1, rms * 6))
    }, 80)
  }

  close() {
    clearInterval(this.timer)
    void this.ctx.close()
  }
}
