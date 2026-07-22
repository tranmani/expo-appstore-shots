/**
 * expo-audio (the SDK 52+ API that replaced expo-av).
 *
 * A still frame is silent, so nothing here plays — but the objects have to
 * survive being built and driven. An app creates a player at module scope
 * (`createAudioPlayer(require('./tap.wav'))`) or through a hook, keeps it, and
 * calls `.play()` from a tap handler that never fires here. A missing method is
 * a crash on a screen that only wanted a sound effect it will not make.
 */
import { anything } from './anything'

const player = () =>
  new Proxy(
    {
      playing: false,
      paused: true,
      muted: false,
      loop: false,
      volume: 1,
      currentTime: 0,
      duration: 0,
      isLoaded: true,
      isBuffering: false,
      play: () => undefined,
      pause: () => undefined,
      seekTo: async () => undefined,
      replace: () => undefined,
      remove: () => undefined,
      setPlaybackRate: () => undefined,
      addListener: () => ({ remove: () => undefined }),
      removeAllListeners: () => undefined,
    },
    // Anything not named above still has to answer — expo-audio's player surface
    // grows between SDKs. `then` stays undefined so `await player` cannot hang.
    { get: (t, p) => (p in t ? (t as Record<string | symbol, unknown>)[p] : p === 'then' ? undefined : () => undefined) },
  )

export const createAudioPlayer = () => player()
export const useAudioPlayer = () => player()
export const useAudioPlayerStatus = () => ({
  isLoaded: true,
  playing: false,
  didJustFinish: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  isBuffering: false,
})
export const useAudioSampleListener = () => undefined
export const setAudioModeAsync = async () => undefined
export const setIsAudioActiveAsync = async () => undefined
export const requestRecordingPermissionsAsync = async () => ({ status: 'granted', granted: true, canAskAgain: false })
export const getRecordingPermissionsAsync = async () => ({ status: 'granted', granted: true, canAskAgain: false })

export const useAudioRecorder = () => anything()
export const useAudioRecorderState = () => ({ isRecording: false, durationMillis: 0, mediaServicesDidReset: false })
export const AudioModule = anything()
export const RecordingPresets = { HIGH_QUALITY: {}, LOW_QUALITY: {} }
export const AudioQuality = { MIN: 0, LOW: 0x20, MEDIUM: 0x40, HIGH: 0x60, MAX: 0x7f }
export const IOSOutputFormat = { MPEG4AAC: 'aac ', LINEARPCM: 'lpcm' }
export const InterruptionMode = { MIX_WITH_OTHERS: 'mixWithOthers', DO_NOT_MIX: 'doNotMix', DUCK_OTHERS: 'duckOthers' }
