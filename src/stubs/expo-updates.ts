/**
 * expo-updates.
 *
 * OTA updates do not happen to a screenshot. What DOES reach the frame is what
 * an app reads off this module at startup — `Updates.channel`, `runtimeVersion`,
 * a build string in a Settings row — so those are answered with plausible
 * constants rather than `undefined`, which would render as an empty row.
 *
 * `reloadAsync` is a no-op: reloading the page mid-capture is the last thing a
 * run wants.
 */
export const channel = 'production'
export const runtimeVersion = '1.0.0'
export const updateId = null
export const createdAt = null
export const isEmbeddedLaunch = true
export const isEmergencyLaunch = false
export const emergencyLaunchReason = null
export const launchDuration = 0
export const manifest = {}
export const isEnabled = false
export const isUsingEmbeddedAssets = true

export const checkForUpdateAsync = async () => ({ isAvailable: false, manifest: null, reason: 'disabled' })
export const fetchUpdateAsync = async () => ({ isNew: false, manifest: null })
export const reloadAsync = async () => undefined
export const readLogEntriesAsync = async () => []
export const clearLogEntriesAsync = async () => undefined
export const getExtraParamsAsync = async () => ({})
export const setExtraParamAsync = async () => undefined

/** The hooks API. Nothing is ever pending in a still frame. */
export const useUpdates = () => ({
  currentlyRunning: {
    updateId: null,
    channel,
    runtimeVersion,
    createdAt: null,
    isEmbeddedLaunch,
    isEmergencyLaunch,
    manifest: {},
  },
  availableUpdate: undefined,
  downloadedUpdate: undefined,
  isChecking: false,
  isDownloading: false,
  isUpdateAvailable: false,
  isUpdatePending: false,
  lastCheckForUpdateTimeSinceRestart: null,
  checkError: undefined,
  downloadError: undefined,
})

export const UpdatesLogEntryLevel = { TRACE: 'trace', DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error', FATAL: 'fatal' }
export const UpdatesLogEntryCode = { NONE: 'None', NO_UPDATES_AVAILABLE: 'NoUpdatesAvailable' }
export const UpdateCheckResultNotAvailableReason = { NO_UPDATE_AVAILABLE: 'noUpdateAvailable' }
export const addListener = () => ({ remove: () => undefined })
