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
import { ScrollView, View } from 'react-native'
import { getInsets, runtime } from './runtime'

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
export const RectButton = View
export const BorderlessButton = View
export const TouchableOpacity = View
export const ScrollView_ = ScrollView

const chainable = (): Record<string, () => unknown> =>
  new Proxy({}, { get: () => () => chainable() }) as Record<string, () => unknown>

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
export const useSharedValue = <T,>(v: T) => ({ value: v })
export const useDerivedValue = <T,>(fn: () => T) => ({ value: fn() })
export const useAnimatedStyle = (fn: () => Record<string, unknown>) => {
  try {
    return fn()
  } catch {
    return {}
  }
}
export const useAnimatedRef = () => useRef(null)
export const useAnimatedScrollHandler = () => () => undefined
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
export const interpolate = (x: number) => x
export const interpolateColor = (_x: number, _i: number[], out: string[]) => out[0]
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
    { get: (_t, prop) => (prop === 'build' ? () => () => ({}) : () => descriptor()) },
  )

export const FadeIn = descriptor()
export const FadeOut = descriptor()
export const FadeInDown = descriptor()
export const FadeInUp = descriptor()
export const FadeInLeft = descriptor()
export const FadeInRight = descriptor()
export const SlideInRight = descriptor()
export const SlideInLeft = descriptor()
export const SlideOutRight = descriptor()
export const SlideOutLeft = descriptor()
export const ZoomIn = descriptor()
export const ZoomOut = descriptor()
export const LinearTransition = descriptor()
export const Layout = descriptor()
export const CurvedTransition = descriptor()

/** Strip the animation-only props; render the plain view underneath. */
function animated<P extends Record<string, unknown>>(Base: React.ComponentType<P>) {
  return function AnimatedView(props: P) {
    const { entering, exiting, layout, sharedTransitionTag, animatedProps, ...rest } =
      props as Record<string, unknown>
    void entering
    void exiting
    void layout
    void sharedTransitionTag
    void animatedProps
    return <Base {...(rest as P)} />
  }
}

export const Reanimated = {
  View: animated(View),
  ScrollView: animated(ScrollView),
  Text: animated(View),
  Image: animated(View),
  createAnimatedComponent: animated,
}

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
 * has no scrolling, so every row is rendered — which is also what puts the whole
 * conversation in one screenshot. It lands scrolled to the end, the way a chat
 * screen opens on its newest message.
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
