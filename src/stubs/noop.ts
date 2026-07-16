/**
 * The modules a screenshot never needs to actually do anything: the file system,
 * the browser sheet, the link opener, the image picker.
 *
 * A still frame has no filesystem to write to and no sheet to present, so every
 * call here is inert. What is *not* optional is that the calls exist: an app
 * reaches for `Paths.document` or `maybeCompleteAuthSession()` at module scope,
 * long before anything is rendered, and a missing export is not a missing
 * feature — it is `No matching export`, which fails the bundle for every screen
 * at once.
 */
import { noop } from './native'
export * from './native'
export default noop

/* ------------------------------------------------------- expo-file-system --- */

/**
 * The new (SDK 52+) object API. It replaced the flat `readAsStringAsync` calls
 * below, and both are live in the wild — an app on a recent SDK imports `File`,
 * an app that has not migrated imports `documentDirectory`, and plenty import
 * both through different dependencies.
 *
 * The file is always absent rather than empty: `exists: false` is the state a
 * fresh install is in, and it is the branch an app is written to survive.
 * Claiming a file exists and then handing back `''` sends it down the parse
 * path, which is the branch nobody tests.
 */
export class File {
  uri: string
  name: string
  exists = false
  size = 0
  md5: string | null = null
  constructor(...path: unknown[]) {
    this.uri = path.map(String).join('/')
    this.name = this.uri.split('/').pop() ?? ''
  }
  text = async () => ''
  textSync = () => ''
  base64 = async () => ''
  base64Sync = () => ''
  bytes = async () => new Uint8Array()
  bytesSync = () => new Uint8Array()
  arrayBuffer = async () => new ArrayBuffer(0)
  write = () => undefined
  create = () => undefined
  delete = () => undefined
  copy = () => undefined
  move = () => undefined
  info = () => ({ exists: false, uri: this.uri })
  open = () => ({ readBytes: () => new Uint8Array(), writeBytes: () => undefined, close: () => undefined })
  static downloadFileAsync = async (_url: string, to: unknown) => to
}

export class Directory {
  uri: string
  name: string
  exists = false
  constructor(...path: unknown[]) {
    this.uri = path.map(String).join('/')
    this.name = this.uri.split('/').pop() ?? ''
  }
  list = () => []
  listAsync = async () => []
  create = () => undefined
  delete = () => undefined
  copy = () => undefined
  move = () => undefined
  info = () => ({ exists: false, uri: this.uri })
}

export const Paths = {
  document: 'file:///shots/document/',
  cache: 'file:///shots/cache/',
  appleSharedContainers: {},
  join: (...parts: unknown[]) => parts.map(String).join('/'),
  isAbsolute: () => true,
  parse: (p: string) => ({ path: p }),
  basename: (p: string) => String(p).split('/').pop() ?? '',
  dirname: (p: string) => String(p).split('/').slice(0, -1).join('/'),
  extname: (p: string) => {
    const base = String(p).split('/').pop() ?? ''
    const dot = base.lastIndexOf('.')
    return dot > 0 ? base.slice(dot) : ''
  },
}

/** The flat API the object API replaced. Still everywhere. */
export const documentDirectory = Paths.document
export const cacheDirectory = Paths.cache
export const bundleDirectory = 'file:///shots/bundle/'
export const getInfoAsync = async (uri: string) => ({ exists: false, isDirectory: false, uri })
export const readAsStringAsync = async () => ''
export const writeAsStringAsync = async () => undefined
export const deleteAsync = async () => undefined
export const moveAsync = async () => undefined
export const copyAsync = async () => undefined
export const makeDirectoryAsync = async () => undefined
export const readDirectoryAsync = async () => []
export const downloadAsync = async (uri: string, fileUri: string) => ({ uri: fileUri, status: 200, headers: {} })
export const uploadAsync = async () => ({ status: 200, body: '', headers: {} })
export const createDownloadResumable = () => ({
  downloadAsync: async () => ({ uri: '', status: 200, headers: {} }),
  pauseAsync: async () => undefined,
  resumeAsync: async () => undefined,
  savable: () => ({}),
})
export const getContentUriAsync = async (uri: string) => ({ uri })
export const getFreeDiskStorageAsync = async () => 1_000_000_000
export const getTotalDiskCapacityAsync = async () => 8_000_000_000
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' }
export const FileSystemUploadType = { BINARY_CONTENT: 0, MULTIPART: 1 }
export const FileSystemSessionType = { BACKGROUND: 0, FOREGROUND: 1 }

/* ------------------------------------- expo-web-browser / expo-auth-session --- */

/**
 * `maybeCompleteAuthSession()` runs at module scope in every app that has ever
 * had an OAuth button — it is the first line of the file, not something a screen
 * opts into. It has to exist, and it has to be a no-op: there is no redirect to
 * complete in a screenshot.
 */
export const maybeCompleteAuthSession = () => ({ type: 'failed', message: 'Not supported on web' })
export const openAuthSessionAsync = async () => ({ type: 'dismiss' })
export const dismissAuthSession = () => undefined
export const openBrowserAsync = async () => ({ type: 'dismiss' })
export const dismissBrowser = () => ({ type: 'dismiss' })
export const warmUpAsync = async () => ({})
export const coolDownAsync = async () => ({})
export const mayInitWithUrlAsync = async () => ({})
export const getCustomTabsSupportingBrowsersAsync = async () => ({ browserPackages: [] })
export const WebBrowserResultType = { CANCEL: 'cancel', DISMISS: 'dismiss', OPENED: 'opened', LOCKED: 'locked' }
export const WebBrowserPresentationStyle = {
  FULL_SCREEN: 'fullScreen',
  PAGE_SHEET: 'pageSheet',
  FORM_SHEET: 'formSheet',
  AUTOMATIC: 'automatic',
  OVER_FULL_SCREEN: 'overFullScreen',
  POPOVER: 'popover',
}

/* ------------------------------------------------------------ expo-linking --- */

export const createURL = (path = '') => `https://shots.local/${String(path).replace(/^\//, '')}`
export const openURL = async () => true
export const canOpenURL = async () => true
export const getInitialURL = async () => null
export const useURL = () => null
export const parse = (url: string) => ({ path: url, queryParams: {}, hostname: 'shots.local', scheme: 'https' })
export const parseInitialURLAsync = async () => ({ path: null, queryParams: {} })
export const addEventListener = () => ({ remove: () => undefined })
export const openSettings = async () => undefined
export const sendIntent = async () => undefined

/* ------------------------------------------------------ react-native-screens --- */

export const enableScreens = () => undefined
export const enableFreeze = () => undefined
