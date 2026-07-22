/**
 * The native modules, stubbed.
 *
 * Each one stands in for hardware or an OS service a headless browser does not
 * have — GPS, the keychain, the Taptic Engine, StoreKit. They report the state
 * of a phone that is located, permitted and online, so a location- or
 * permission-gated screen renders its granted path instead of its "turn this on"
 * empty state.
 *
 * Nothing here fakes *app* logic. Your geofence check, your presence rules and
 * your write gates all still run — against a real fix that happens to be seeded.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FlatList, ScrollView, TextInput, View } from 'react-native'
import { getInsets, getListScroll, runtime } from './runtime'

/* -------------------------------------------------------- expo-location --- */

const position = () => ({
  coords: {
    latitude: runtime().coords.latitude,
    longitude: runtime().coords.longitude,
    accuracy: runtime().coords.accuracy,
    altitude: 2,
    heading: 0,
    speed: 0,
    altitudeAccuracy: 3,
  },
  timestamp: Date.now(),
})

export const PermissionStatus = { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' }
export const Accuracy = { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 }
export const LocationAccuracy = Accuracy
export const ActivityType = { Other: 1, Fitness: 2 }
export const GeofencingEventType = { Enter: 1, Exit: 2 }

const granted = async () => ({ status: 'granted', granted: true, canAskAgain: false })
export const requestForegroundPermissionsAsync = granted
export const getForegroundPermissionsAsync = granted
export const requestBackgroundPermissionsAsync = granted
export const getBackgroundPermissionsAsync = granted
export const getCurrentPositionAsync = async () => position()
export const getLastKnownPositionAsync = async () => position()
export const reverseGeocodeAsync = async () => [{ isoCountryCode: 'NL', country: 'Netherlands', city: 'Amsterdam' }]
export const geocodeAsync = async () => [runtime().coords]
export const hasServicesEnabledAsync = async () => true
export const hasStartedLocationUpdatesAsync = async () => false
export const startLocationUpdatesAsync = async () => undefined
export const stopLocationUpdatesAsync = async () => undefined
export const startGeofencingAsync = async () => undefined
export const stopGeofencingAsync = async () => undefined
export const hasStartedGeofencingAsync = async () => false

export async function watchPositionAsync(_o: unknown, cb: (p: ReturnType<typeof position>) => void) {
  cb(position())
  return { remove: () => undefined }
}

/**
 * The compass. A radar or a heading-up map reads it, and on a phone that is
 * facing north the reading is 0 — a fixed frame has a fixed bearing, and 0 is as
 * honest as any. `watchHeadingAsync` fires once and then holds, the same way
 * `watchPositionAsync` does: a still frame does not turn.
 */
const heading = () => ({ trueHeading: 0, magHeading: 0, accuracy: 3 })
export const getHeadingAsync = async () => heading()
export async function watchHeadingAsync(cb: (h: ReturnType<typeof heading>) => void) {
  cb(heading())
  return { remove: () => undefined }
}
export const enableNetworkProviderAsync = async () => undefined
export const isBackgroundLocationAvailableAsync = async () => false
export const getProviderStatusAsync = async () => ({ locationServicesEnabled: true, gpsAvailable: true, networkAvailable: true })
export const installWebGeolocationPolyfill = () => undefined

/* ------------------------------------------------------ expo-secure-store --- */

let vault: Map<string, string> | null = null
const secure = () => (vault ??= new Map(Object.entries(runtime().secureStore ?? {})))

export const getItemAsync = async (k: string) => secure().get(k) ?? null
export const setItemAsync = async (k: string, v: string) => void secure().set(k, v)
export const deleteItemAsync = async (k: string) => void secure().delete(k)
export const isAvailableAsync = async () => true
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'whenUnlockedThisDeviceOnly'
export const AFTER_FIRST_UNLOCK = 'afterFirstUnlock'

/* ------------------------------------------------------------ expo-haptics --- */

export const impactAsync = async () => undefined
export const notificationAsync = async () => undefined
export const selectionAsync = async () => undefined
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft', Rigid: 'rigid' }
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' }

/* ---------------------------------------------------------- expo-clipboard --- */

export const setStringAsync = async () => true
export const getStringAsync = async () => ''

/* ------------------------------------------------------------ expo-crypto --- */

export const randomUUID = () => '00000000-0000-4000-8000-000000000000'
export const digestStringAsync = async () => 'digest'
export const getRandomBytes = (n: number) => new Uint8Array(n)
export const getRandomBytesAsync = async (n: number) => new Uint8Array(n)
export const CryptoDigestAlgorithm = { SHA256: 'SHA-256', SHA512: 'SHA-512' }
export const CryptoEncoding = { HEX: 'hex', BASE64: 'base64' }

/* ------------------------------------------------ expo-device / localization --- */

export const isDevice = true
export const modelName = 'iPhone 16 Pro'
export const osName = 'iOS'
export const osVersion = '26.0'
export const brand = 'Apple'
/** A phone, not a tablet — `Device.deviceType === Device.DeviceType.TABLET` is a real branch. */
export const DeviceType = { UNKNOWN: 0, PHONE: 1, TABLET: 2, DESKTOP: 3, TV: 4 }
export const deviceType = DeviceType.PHONE
export const getDeviceTypeAsync = async () => DeviceType.PHONE
export const deviceName = 'iPhone'
export const manufacturer = 'Apple'
export const isRootedExperimentalAsync = async () => false
export const getLocales = () => {
  const tag = runtime().locale
  return [{ languageCode: tag.split('-')[0], languageTag: tag, regionCode: tag.split('-')[1] ?? null }]
}
export const getCalendars = () => [{ timeZone: 'Europe/Amsterdam' }]

/* ------------------------------------------------------ expo-notifications --- */

const subscription = { remove: () => undefined }
export const getPermissionsAsync = granted
export const requestPermissionsAsync = granted
export const getExpoPushTokenAsync = async () => ({ data: 'ExponentPushToken[shots]' })
export const getDevicePushTokenAsync = async () => ({ data: 'shots' })
export const setNotificationHandler = () => undefined
export const addNotificationReceivedListener = () => subscription
export const addNotificationResponseReceivedListener = () => subscription
export const setNotificationChannelAsync = async () => undefined
export const scheduleNotificationAsync = async () => 'id'
export const getLastNotificationResponseAsync = async () => null
export const AndroidImportance = { DEFAULT: 3, HIGH: 4, MAX: 5 }

/**
 * The badge, which an app clears on launch.
 *
 * Missing, this is worse than a missing export: `setBadgeCountAsync(0).catch(…)`
 * reads like it is guarded, and it is not — the call happens *before* `.catch`
 * exists to catch anything, so `undefined is not a function` throws straight
 * through the guard and takes the screen with it. The defensive-looking line is
 * the one that kills the frame.
 */
export const setBadgeCountAsync = async () => true
export const getBadgeCountAsync = async () => 0
export const dismissAllNotificationsAsync = async () => undefined
export const dismissNotificationAsync = async () => undefined
export const cancelScheduledNotificationAsync = async () => undefined
export const cancelAllScheduledNotificationsAsync = async () => undefined
export const getAllScheduledNotificationsAsync = async () => []
export const getPresentedNotificationsAsync = async () => []
export const removeNotificationSubscription = () => undefined
export const useLastNotificationResponse = () => null

/* ------------------------------------------------------ expo-task-manager --- */

export const defineTask = () => undefined
export const isTaskRegisteredAsync = async () => false
export const unregisterTaskAsync = async () => undefined

/* --------------------------------------------------------- expo-status-bar --- */

export const StatusBar = () => null
export const setStatusBarStyle = () => undefined

/* ---------------------------------------------------------- expo-constants --- */

export const executionEnvironment = 'standalone'
export const appOwnership = null
export const ExecutionEnvironment = { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' }
export const Constants = {
  expoConfig: { version: '1.0.0', extra: {} },
  executionEnvironment,
  appOwnership,
  platform: { ios: {} },
}

/* ------------------------------------------------------- react-native-iap --- */

export const initConnection = async () => true
export const endConnection = async () => undefined
export const getSubscriptions = async () => []
export const getProducts = async () => []
export const requestSubscription = async () => undefined
export const requestPurchase = async () => undefined
export const getAvailablePurchases = async () => []
export const finishTransaction = async () => undefined
export const purchaseUpdatedListener = () => subscription
export const purchaseErrorListener = () => subscription
export const flushFailedPurchasesCachedAsPendingAndroid = async () => undefined

/* ------------------------------------------ @react-native-async-storage --- */

let disk: Map<string, string> | null = null
/** Seeded from `runtime.storage`: the phone of someone who has used the app. */
const store = () => (disk ??= new Map(Object.entries(runtime().storage ?? {})))

export const AsyncStorage = {
  getItem: async (k: string) => store().get(k) ?? null,
  setItem: async (k: string, v: string) => void store().set(k, v),
  removeItem: async (k: string) => void store().delete(k),
  mergeItem: async () => undefined,
  multiGet: async (ks: string[]) => ks.map((k) => [k, store().get(k) ?? null]),
  multiSet: async (pairs: [string, string][]) => pairs.forEach(([k, v]) => store().set(k, v)),
  multiRemove: async (ks: string[]) => ks.forEach((k) => store().delete(k)),
  getAllKeys: async () => [...store().keys()],
  clear: async () => store().clear(),
}

/* ------------------------------------------------ react-native-safe-area --- */

export const useSafeAreaInsets = () => getInsets()
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 0, height: 0 })
export const SafeAreaProvider = ({ children }: { children?: ReactNode }) => <>{children}</>
export const SafeAreaView = View
export const SafeAreaInsetsContext = { Consumer: ({ children }: never) => children }
export const initialWindowMetrics = { frame: { x: 0, y: 0, width: 0, height: 0 }, insets: getInsets() }

/* ------------------------------------------- react-native-gesture-handler --- */

export const GestureHandlerRootView = View
export const GestureDetector = ({ children }: { children?: ReactNode }) => <>{children}</>
export const Swipeable = View
export const ReanimatedSwipeable = View
export const RectButton = View
export const BorderlessButton = View
export const BaseButton = View
export const TouchableOpacity = View
export const TouchableHighlight = View
export const TouchableWithoutFeedback = View
export const TouchableNativeFeedback = View
export const PanGestureHandler = View
export const TapGestureHandler = View
export const LongPressGestureHandler = View
export const FlingGestureHandler = View
export const PinchGestureHandler = View
export const RotationGestureHandler = View
export const NativeViewGestureHandler = View
export const State = { UNDETERMINED: 0, FAILED: 1, BEGAN: 2, CANCELLED: 3, ACTIVE: 4, END: 5 }

/**
 * gesture-handler re-exports the RN scrollables under its own names, and an app
 * that does `import { ScrollView } from 'react-native-gesture-handler'` means
 * the ordinary one. The trailing underscore is only here because this module
 * already imported those names from `react-native` and cannot redeclare them;
 * `gesture-handler.ts` hands them back out under the names apps actually write.
 */
export const ScrollView_ = ScrollView
export const FlatList_ = FlatList
export const TextInput_ = TextInput

/**
 * `then` is excluded on purpose — see stubs/anything.ts. A proxy that answers
 * `then` with a function is a thenable, so `await` on one hangs the render
 * forever: a blank frame, no error, nothing to read.
 */
const chainable = (): Record<string, () => unknown> =>
  new Proxy(
    {},
    { get: (_t, prop) => (prop === 'then' ? undefined : () => chainable()) },
  ) as Record<string, () => unknown>

export const Gesture = {
  Tap: chainable,
  LongPress: chainable,
  Pan: chainable,
  Pinch: chainable,
  Fling: chainable,
  Native: chainable,
  Simultaneous: chainable,
  Race: chainable,
  Exclusive: chainable,
}
export const Directions = { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 }

/* ------------------------------------------------ react-native-reanimated --- */

/**
 * Animations collapse to their end state. A screenshot is a still frame: what
 * matters is that a row which fades in is *there*, at full opacity — not that it
 * took 200ms to arrive. Worklets need a Babel plugin esbuild does not run, so
 * they are replaced by plain functions.
 */
/**
 * A shared value.
 *
 * `{ value }` is most of what a screen touches, and for a long time that was all
 * this was. It is not all a *library* touches: a shared value also has
 * `.modify()`, `.get()`, `.set()` and listeners, and @gorhom/bottom-sheet builds
 * its whole layout out of them (`containerLayoutState.modify(…)`). A missing
 * method there is not a missing animation — it is a TypeError inside a provider
 * wrapped around the entire app, so *every* screen fails to render, and the app
 * never called the thing that broke.
 */
/**
 * A WRITE HAS TO REACH THE SCREEN.
 *
 * On a device a shared value is watched: write `progress.value = 1` and every
 * `useAnimatedStyle` that read it re-runs on the UI thread. Here the write went
 * into a plain object and nothing ever looked again — so a style computed from
 * it kept whatever it happened to say on the first render, forever.
 *
 * That reads as a subtle timing detail and is not. The pattern that breaks is
 * ordinary: measure in `onLayout`, store the width in a shared value, and set
 * `opacity: width > 0 ? 1 : 0` so the bar does not flash before it knows its own
 * size. First render has no layout, so opacity is 0; the write lands; nothing
 * re-renders; the element is invisible in every frame. Every progress bar in the
 * app, empty, with the correct width sitting in the DOM behind `opacity: 0`.
 *
 * So writes notify, and the hooks below subscribe. Coalesced on a microtask
 * (one re-render per burst, not one per write) and only when the value actually
 * changed, which is what keeps write → render → write from spinning.
 */
const watchers = new Set<() => void>()
let pending = false

function notify() {
  if (pending) return
  pending = true
  queueMicrotask(() => {
    pending = false
    watchers.forEach((w) => w())
  })
}

/** Re-render this component when any shared value changes. */
function useWatchValues() {
  const [, bump] = useState(0)
  useEffect(() => {
    const w = () => bump((n) => n + 1)
    watchers.add(w)
    return () => {
      watchers.delete(w)
    }
  }, [])
}

function mutable<T>(initial: T) {
  let current = initial
  const m = {
    get value() {
      return current
    },
    set value(next: T) {
      if (Object.is(current, next)) return
      current = next
      notify()
    },
    get: () => current,
    set: (next: T | ((prev: T) => T)) => {
      m.value = typeof next === 'function' ? (next as (p: T) => T)(current) : next
    },
    /** Reanimated's in-place update. Returns the value, and must not throw. */
    modify: (fn?: (prev: T) => T) => {
      if (fn) m.value = fn(current)
      return current
    },
    addListener: () => undefined,
    removeListener: () => undefined,
  }
  return m
}

/**
 * STABLE ACROSS RENDERS, which the one-liner it replaced was not.
 *
 * A real shared value is the same object for the life of the component. Minting
 * a new one every render is invisible until something depends on its identity —
 * `useEffect(…, [progress])` then fires forever, and a render loop is not an
 * error, it is a capture that never settles and a frame that never arrives.
 */
export const useSharedValue = <T,>(v: T) => {
  const ref = useRef<ReturnType<typeof mutable<T>> | null>(null)
  if (!ref.current) ref.current = mutable(v)
  return ref.current
}

export const useDerivedValue = <T,>(fn: () => T) => {
  try {
    return mutable(fn())
  } catch {
    return mutable(undefined as T)
  }
}

/** `useSharedValue` without the hook — a shared value made outside a component. */
export const makeMutable = <T,>(v: T) => mutable(v)
export const makeShareable = <T,>(v: T) => v
export const makeShareableCloneRecursive = <T,>(v: T) => v
export const isSharedValue = (v: unknown) => Boolean(v && typeof v === 'object' && 'value' in v)

/** Motion the OS has been asked to reduce. A still frame has no motion to reduce. */
export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' }
export const useReducedMotion = () => false
export const getReduceMotionFromConfig = () => false
export const useAnimatedStyle = (fn: () => Record<string, unknown>) => {
  useWatchValues()
  try {
    return fn()
  } catch {
    return {}
  }
}
/**
 * The props half of `useAnimatedStyle`, and it fails the same way: the worklet
 * reads shared values that are already at their end state, so calling it once
 * gives the props the frame should show. A throwing worklet yields `{}` rather
 * than taking the screen down with it.
 */
export const useAnimatedProps = (fn: () => Record<string, unknown>) => {
  useWatchValues()
  try {
    return fn()
  } catch {
    return {}
  }
}
export const useAnimatedRef = () => useRef(null)
export const useAnimatedScrollHandler = () => () => undefined
export const useAnimatedReaction = () => undefined
export const useFrameCallback = () => ({ setActive: () => undefined, isActive: false })
export const useScrollViewOffset = () => ({ value: 0 })
export const useScrollOffset = () => ({ value: 0 })
export const withTiming = <T,>(v: T) => v
export const withSpring = <T,>(v: T) => v
export const withDecay = <T,>(v: T) => v
export const withDelay = <T,>(_ms: number, v: T) => v
export const withSequence = <T,>(...vs: T[]) => vs[vs.length - 1]
export const withRepeat = <T,>(v: T) => v
export const cancelAnimation = () => undefined
export const measure = () => null
export const scrollTo = () => undefined
export const runOnJS =
  <A extends unknown[]>(fn: (...a: A) => unknown) =>
  (...a: A) =>
    fn(...a)
export const runOnUI = runOnJS
/**
 * INTERPOLATE FOR REAL. It used to be `(x) => x`, and that is not a simplification
 * — it is a different number.
 *
 * `opacity: interpolate(translateY.value, [0, 80], [1, 0], CLAMP)` is how a bar
 * hides itself when it slides away. At rest `translateY` is 0, so the real answer
 * is 1 — visible — and the identity function answered **0**. The component was
 * correct, the shared value was correct, and the element rendered fully
 * transparent. Nothing threw, nothing warned; a floating tab bar was simply
 * absent from every frame of a run that reported success.
 *
 * That is the whole argument for doing this properly. A still frame does not need
 * the animation, but it very much needs the *value the animation would rest at*,
 * and there is no reason to guess it when the maths is eight lines.
 */
export function interpolate(
  x: number,
  input?: readonly number[],
  output?: readonly number[],
  extrapolate: string | { extrapolateLeft?: string; extrapolateRight?: string } = 'extend',
): number {
  if (!input || !output || input.length < 2 || output.length < 2) return x

  const mode = typeof extrapolate === 'string' ? extrapolate : 'extend'
  const left = typeof extrapolate === 'string' ? mode : (extrapolate.extrapolateLeft ?? 'extend')
  const right = typeof extrapolate === 'string' ? mode : (extrapolate.extrapolateRight ?? 'extend')

  // Find the segment x falls in; the ranges are ordered, so a scan is enough.
  let i = 0
  while (i < input.length - 2 && x > input[i + 1]) i++

  const [x0, x1] = [input[i], input[i + 1]]
  const [y0, y1] = [output[i], output[i + 1]]

  if (x < input[0]) {
    if (left === 'clamp') return output[0]
    if (left === 'identity') return x
  }
  if (x > input[input.length - 1]) {
    if (right === 'clamp') return output[output.length - 1]
    if (right === 'identity') return x
  }

  if (x1 === x0) return y0
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
}

/** The colour version, at the ends. A still frame lands on one or the other. */
export const interpolateColor = (x: number, input: readonly number[], out: readonly string[]) => {
  if (!input?.length || !out?.length) return out?.[0]
  if (x <= input[0]) return out[0]
  if (x >= input[input.length - 1]) return out[out.length - 1]
  // Nearest stop: a blend would need a colour parser, and a still frame at rest
  // is almost always sitting on a stop rather than between two.
  let nearest = 0
  for (let i = 1; i < input.length; i++) {
    if (Math.abs(input[i] - x) < Math.abs(input[nearest] - x)) nearest = i
  }
  return out[Math.min(nearest, out.length - 1)]
}
export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' }
export const Extrapolate = Extrapolation
export const Easing = {
  bezier: () => ({ factory: () => (t: number) => t }),
  bezierFn: () => (t: number) => t,
  linear: (t: number) => t,
  ease: (t: number) => t,
  in: (f: unknown) => f,
  out: (f: unknown) => f,
  inOut: (f: unknown) => f,
  cubic: (t: number) => t,
  quad: (t: number) => t,
  exp: (t: number) => t,
  sin: (t: number) => t,
  circle: (t: number) => t,
  back: () => (t: number) => t,
  elastic: () => (t: number) => t,
  bounce: (t: number) => t,
}

/** `entering` / `exiting` / `layout` descriptors: chainable, and inert. */
const descriptor = (): unknown =>
  new Proxy(
    {},
    {
      get: (_t, prop) => {
        // Not a thenable: `await` on one of these would never resolve, and a
        // render that never finishes is a blank frame with no error at all.
        if (prop === 'then') return undefined
        return prop === 'build' ? () => () => ({}) : () => descriptor()
      },
    },
  )

/**
 * Every preset, not the ones that happened to come up.
 *
 * This list used to hold the *entering* half — FadeIn*, SlideInRight/Left — on
 * the reasonable theory that a still frame only ever shows something arriving.
 * But an app does not import a descriptor in order to animate; it imports it
 * because a line of its source says `exiting={FadeOutUp}`, and a name this file
 * does not export is `No matching export`, which fails the bundle for every
 * screen at once. A row that fades *out* still has to compile.
 *
 * So: the symmetric cross-product, written out. They are all inert — a
 * screenshot is a still frame, and what matters is that the row is *there*, at
 * its end state, not how it got there or how it would leave.
 */
export const FadeIn = descriptor()
export const FadeInDown = descriptor()
export const FadeInUp = descriptor()
export const FadeInLeft = descriptor()
export const FadeInRight = descriptor()
export const FadeOut = descriptor()
export const FadeOutDown = descriptor()
export const FadeOutUp = descriptor()
export const FadeOutLeft = descriptor()
export const FadeOutRight = descriptor()

export const SlideInRight = descriptor()
export const SlideInLeft = descriptor()
export const SlideInUp = descriptor()
export const SlideInDown = descriptor()
export const SlideOutRight = descriptor()
export const SlideOutLeft = descriptor()
export const SlideOutUp = descriptor()
export const SlideOutDown = descriptor()

export const ZoomIn = descriptor()
export const ZoomInRotate = descriptor()
export const ZoomInLeft = descriptor()
export const ZoomInRight = descriptor()
export const ZoomInUp = descriptor()
export const ZoomInDown = descriptor()
export const ZoomInEasyUp = descriptor()
export const ZoomInEasyDown = descriptor()
export const ZoomOut = descriptor()
export const ZoomOutRotate = descriptor()
export const ZoomOutLeft = descriptor()
export const ZoomOutRight = descriptor()
export const ZoomOutUp = descriptor()
export const ZoomOutDown = descriptor()
export const ZoomOutEasyUp = descriptor()
export const ZoomOutEasyDown = descriptor()

export const BounceIn = descriptor()
export const BounceInDown = descriptor()
export const BounceInUp = descriptor()
export const BounceInLeft = descriptor()
export const BounceInRight = descriptor()
export const BounceOut = descriptor()
export const BounceOutDown = descriptor()
export const BounceOutUp = descriptor()
export const BounceOutLeft = descriptor()
export const BounceOutRight = descriptor()

export const FlipInXUp = descriptor()
export const FlipInXDown = descriptor()
export const FlipInYLeft = descriptor()
export const FlipInYRight = descriptor()
export const FlipInEasyX = descriptor()
export const FlipInEasyY = descriptor()
export const FlipOutXUp = descriptor()
export const FlipOutXDown = descriptor()
export const FlipOutYLeft = descriptor()
export const FlipOutYRight = descriptor()
export const FlipOutEasyX = descriptor()
export const FlipOutEasyY = descriptor()

export const RotateInDownLeft = descriptor()
export const RotateInDownRight = descriptor()
export const RotateInUpLeft = descriptor()
export const RotateInUpRight = descriptor()
export const RotateOutDownLeft = descriptor()
export const RotateOutDownRight = descriptor()
export const RotateOutUpLeft = descriptor()
export const RotateOutUpRight = descriptor()

export const RollInLeft = descriptor()
export const RollInRight = descriptor()
export const RollOutLeft = descriptor()
export const RollOutRight = descriptor()

export const LightSpeedInLeft = descriptor()
export const LightSpeedInRight = descriptor()
export const LightSpeedOutLeft = descriptor()
export const LightSpeedOutRight = descriptor()

export const StretchInX = descriptor()
export const StretchInY = descriptor()
export const StretchOutX = descriptor()
export const StretchOutY = descriptor()

export const PinwheelIn = descriptor()
export const PinwheelOut = descriptor()

/** Layout transitions: same idea, same inertness. */
export const Layout = descriptor()
export const LinearTransition = descriptor()
export const CurvedTransition = descriptor()
export const FadingTransition = descriptor()
export const SequencedTransition = descriptor()
export const JumpingTransition = descriptor()
export const EntryExitTransition = descriptor()
export const LayoutGrid = descriptor()

/**
 * `new Keyframe({...}).duration(300)` — a class in the real library, so `new`
 * has to work. The constructor returns the same chainable descriptor, which is
 * legal: a constructor that returns an object hands back that object.
 */
export class Keyframe {
  constructor(_definition?: unknown) {
    void _definition
    return descriptor() as Keyframe
  }
}
export const LayoutAnimationConfig = ({ children }: { children?: ReactNode }) => <>{children}</>

/**
 * Strip the animation-only props; render the plain view underneath — but keep
 * `animatedProps`, which are not animation-only. They are props.
 *
 * This used to `void animatedProps` next to the others, and the effect was
 * quietly absurd: `useAnimatedProps` evaluated the worklet, worked out the right
 * values, handed them over — and the wrapper threw them in the bin. The whole
 * point of that prop is to compute something a style cannot (a circle's
 * `strokeDashoffset`, a slider's `value`, an input's `text`), so discarding it
 * meant every one of those rendered at its initial value and nothing said why.
 *
 * `text` is remapped because it is the RN trick for driving a TextInput without
 * a re-render; on web the same idea is spelled `value`.
 */
function animated<P extends Record<string, unknown>>(Base: React.ComponentType<P>) {
  return function AnimatedView(props: P) {
    const { entering, exiting, layout, sharedTransitionTag, animatedProps, ...rest } =
      props as Record<string, unknown>
    void entering
    void exiting
    void layout
    void sharedTransitionTag

    const extra = { ...((animatedProps as Record<string, unknown>) ?? {}) }
    if ('text' in extra) {
      extra.value = extra.text
      delete extra.text
    }

    return <Base {...(rest as P)} {...(extra as P)} />
  }
}

/**
 * The default export, which is a namespace as well as a component factory.
 *
 * `Animated.View` is what an app writes, so that is what this mostly is — but
 * the *registration* functions are what a library writes, at module scope, and
 * they are not optional. `Animated.addWhitelistedUIProps({…})` is how a package
 * teaches reanimated about a prop it wants to animate; react-native-calendars
 * and friends call it on import, long before anything renders, and a missing one
 * is not a missing animation. It is `addWhitelistedUIProps is not a function`,
 * thrown while the module is still loading, which takes every screen in the run
 * with it — from a package the app never called directly.
 */
export const Reanimated = {
  View: animated(View),
  ScrollView: animated(ScrollView),
  Text: animated(View),
  Image: animated(View),
  FlatList: animated(FlatList),
  createAnimatedComponent: animated,
  addWhitelistedUIProps: () => undefined,
  addWhitelistedNativeProps: () => undefined,
  createAnimatedPropAdapter: <T,>(fn: T) => fn,
}

export const addWhitelistedUIProps = Reanimated.addWhitelistedUIProps
export const addWhitelistedNativeProps = Reanimated.addWhitelistedNativeProps
export const createAnimatedPropAdapter = Reanimated.createAnimatedPropAdapter
export const createAnimatedComponent = animated

/* ---------------------------------------------------- @shopify/flash-list --- */

interface FlashListProps<T> {
  data?: readonly T[]
  renderItem?: (info: { item: T; index: number }) => ReactNode
  keyExtractor?: (item: T, index: number) => string
  ListHeaderComponent?: ReactNode | (() => ReactNode)
  ListFooterComponent?: ReactNode | (() => ReactNode)
  ListEmptyComponent?: ReactNode | (() => ReactNode)
  ItemSeparatorComponent?: () => ReactNode
  contentContainerStyle?: unknown
  style?: unknown
  inverted?: boolean
  extraData?: unknown
}

const node = (x: ReactNode | (() => ReactNode)): ReactNode =>
  typeof x === 'function' ? (x as () => ReactNode)() : x

/**
 * A list is a list. Recycling is a scroll-performance concern and a still frame
 * has no scrolling, so every row is rendered — which is also what puts a whole
 * conversation in one screenshot.
 *
 * It starts at the top, unless the screen is configured `scroll: 'end'` — a chat
 * opens on its newest message, and a screenshot of it should too.
 */
export function FlashList<T>({
  data = [],
  renderItem,
  keyExtractor,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  ItemSeparatorComponent,
  contentContainerStyle,
  style,
}: FlashListProps<T>) {
  const list = useRef<ScrollView>(null)
  useEffect(() => {
    if (getListScroll() !== 'end') return
    const id = setTimeout(() => list.current?.scrollToEnd({ animated: false }), 400)
    return () => clearTimeout(id)
  }, [data.length])

  return (
    // `flex: 1` matters: without it the list grows to fit every row and pushes
    // anything below it (a chat composer) off the bottom of the screen.
    <ScrollView
      ref={list}
      style={[{ flex: 1 }, style] as never}
      contentContainerStyle={contentContainerStyle as never}
    >
      {node(ListHeaderComponent)}
      {data.length === 0
        ? node(ListEmptyComponent)
        : data.map((item, index) => (
            <View key={keyExtractor?.(item, index) ?? String(index)}>
              {index > 0 && ItemSeparatorComponent ? <ItemSeparatorComponent /> : null}
              {renderItem?.({ item, index })}
            </View>
          ))}
      {node(ListFooterComponent)}
    </ScrollView>
  )
}

export const MasonryFlashList = FlashList

/* ------------------------------------------------------------------ misc --- */

/** A do-nothing default for modules that only have side effects. */
const noop = new Proxy(() => undefined, {
  get: () => noop,
  apply: () => undefined,
}) as unknown as Record<string, unknown>

export { noop, useState }
