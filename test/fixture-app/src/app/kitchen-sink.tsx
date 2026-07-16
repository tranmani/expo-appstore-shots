/**
 * THE IMPORTS THAT USED TO END A RUN.
 *
 * Every name in this file is one a real app (FamMedley: React Navigation, Skia,
 * reanimated 4, lucide 0.563, offline-first) imported and this tool could not
 * answer. Each missing one was not a degraded screen — it was `No matching
 * export`, which fails the *whole bundle*, because every screen is bundled
 * together. One dev-only `DevSettings` import took down all twenty-four frames.
 *
 * So this screen exists to be compiled, and its value is almost entirely in the
 * import block above the component. If a stub loses an export, this file stops
 * building and `stubs.test.mjs` says which one — instead of a user finding out
 * fifteen patches into their own afternoon.
 *
 * It renders too (the e2e run shoots it), which catches the other half: a name
 * that exists but is `undefined` at runtime, like the `ScrollView` that
 * gesture-handler exported under a different name, or the badge call that threw
 * straight through its own `.catch`.
 */
import { useEffect, useRef } from 'react'
import { DevSettings, InteractionManager, Text, TurboModuleRegistry, View } from 'react-native'

// react-native internals, reached the way a native package reaches them: through
// a subpath of a module that is aliased to a *file*. This is the import shape
// that produced `…/stubs/react-native.tsx/Libraries/Image/AssetRegistry`.
import { registerAsset } from 'react-native/Libraries/Image/AssetRegistry'
import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands'
// The subpath the catch-all must NOT answer with a proxy: `Platform.OS` has to
// be a string an app can branch on, or it takes the branch it wrote for neither
// platform — silently, in a picture.
import RNPlatform from 'react-native/Libraries/Utilities/Platform'

// reanimated: the exiting half of the cross-product, and the newer APIs.
import Animated, {
  Extrapolation,
  interpolate,
  CurvedTransition,
  EntryExitTransition,
  FadeIn,
  FadeOutDown,
  FadeOutLeft,
  FadeOutRight,
  FadeOutUp,
  Keyframe,
  LayoutGrid,
  SequencedTransition,
  SlideInDown,
  SlideInUp,
  SlideOutDown,
  SlideOutUp,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'

// gesture-handler's scrollables, under the names apps actually import.
import { FlatList, ScrollView } from 'react-native-gesture-handler'

// The badge call that throws *before* its own .catch exists.
import * as Notifications from 'expo-notifications'

// The new expo-file-system object API, and the auth-session functions that run
// at module scope.
import { Directory, File, Paths } from 'expo-file-system'
import { dismissAuthSession, maybeCompleteAuthSession, openAuthSessionAsync } from 'expo-web-browser'
// The same functions, from the package apps ACTUALLY import them from. They
// lived in the stub already, but only expo-web-browser was pointed at it — so
// this import reached the app's real expo-auth-session, and its native side.
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session'

// The native packages with no stub at all.
import { Atlas, Canvas, Skia, useRSXformBuffer } from '@shopify/react-native-skia'
import { Confetti } from 'react-native-fast-confetti'
import { FlexWidget, OverlapWidget, requestWidgetUpdate, SvgWidget, TextWidget } from 'react-native-android-widget'
import MapView, { Marker } from 'react-native-maps'

// React Navigation: hooks that throw outside a navigator.
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useNavigationState,
  useRoute,
  useScrollToTop,
} from '@react-navigation/native'
import { useHeaderHeight } from '@react-navigation/elements'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'

// A local database, which no fixture can reach.
import { openDatabaseSync } from 'expo-sqlite'

// An asset in a format esbuild had no loader for.
import pixel from './pixel.webp'

maybeCompleteAuthSession()

export default function KitchenSink() {
  /**
   * The deadlock, reproduced deliberately.
   *
   * This is exactly what a real screen does: show a skeleton, defer the real
   * content to `runAfterInteractions`, swap it in when that runs. Under
   * react-native-web's own InteractionManager it schedules with
   * `requestIdleCallback` and no timeout — and an app with an animated skeleton
   * is never idle, so it never runs, and the screenshot is of the skeleton. The
   * shimmer starves the callback that would remove the shimmer.
   *
   * A `<Text>` that never changes would prove nothing; the assertion is that
   * this flips before the frame is taken.
   */
  // Refs, not state: the assertion runs from a timer that would otherwise close
  // over whatever these were at mount — which is exactly `false` — and report a
  // failure that had already been fixed a tick earlier.
  const interactionsRan = useRef(false)
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      interactionsRan.current = true
    })
    return () => handle.cancel()
  }, [])

  const navigation = useNavigation()
  const route = useRoute()
  const focused = useIsFocused()
  const headerHeight = useHeaderHeight()
  const tabBarHeight = useBottomTabBarHeight()
  const routeName = useNavigationState((state: { routes: { name: string }[] }) => state.routes[0]?.name)
  const progress = useSharedValue(1)
  // `accessibilityLabel` because it lands in the DOM as `aria-label`, where the
  // assertion below can see whether the wrapper actually passed it on.
  const animatedProps = useAnimatedProps(() => ({
    opacity: progress.value,
    accessibilityLabel: 'animated-props-arrived',
  }))
  const [authRequest] = useAuthRequest() as unknown[]
  void authRequest

  useScrollToTop({ current: null } as never)
  useFocusEffect(() => undefined)

  // `<Stack.Screen name="kitchen-sink" options={{ title: 'REGISTERED-TITLE' }} />`
  // in _layout.tsx has to reach the header. Read back from the DOM after paint,
  // because that is the only place the claim is either true or false — the
  // screen cannot see its own header any other way.
  //
  // It was false. Named-route options were written to a table in an effect that
  // nothing ever re-read, so every `<Stack.Screen name=…>` in every layout was
  // inert. The old fixture could not catch it: its header fell back to the same
  // string it registered.
  /**
   * A shared value written AFTER mount, the way `onLayout` writes a measured
   * width — the pattern that rendered every progress bar at `opacity: 0`.
   *
   * The proof is that the worklet RE-RUNS: it records what it computed each
   * time, so a `1` in here can only mean it was evaluated again after the
   * write. Reading `measured.value` back instead would prove nothing — the
   * write always landed; it just never reached the screen.
   */
  const measured = useSharedValue(0)
  /** The last value the worklet actually SAW. Not the last value written. */
  const lastSeen = useRef<number>(-1)
  useAnimatedStyle(() => {
    lastSeen.current = measured.value
    return { opacity: measured.value > 0 ? 1 : 0 }
  })

  useEffect(() => {
    // On a tick, not in this effect: the layout's `<Stack.Screen name=…>` is a
    // *child* of the Stack that draws the header, and child effects run before
    // the parent's — so at this instant the registration has only just been
    // written and the header has not been re-rendered from it yet. A screenshot
    // is taken long after; this waits the same way.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read at fire time, on purpose
    const id = setTimeout(() => {
      const page = document.body.textContent ?? ''
      if (!page.includes('REGISTERED-TITLE')) {
        throw new Error(`<Stack.Screen name> options never reached the header — it says "${page.slice(0, 40)}"`)
      }
      // Deferred work must have run by now. On a device this resolves in a
      // frame; here it used to wait for an idle the shimmer never allowed.
      if (!interactionsRan.current) {
        throw new Error('InteractionManager.runAfterInteractions never ran — a skeleton would be photographed')
      }

      // `animatedProps` must reach the element, not just be computed. The
      // wrapper used to `void` them: the worklet ran, produced the right
      // values, and they were dropped on the floor.
      if (!document.querySelector('[aria-label="animated-props-arrived"]')) {
        throw new Error('animatedProps never reached the element — the wrapper discarded them')
      }

      // Isolated on purpose. Writing at mount proves nothing: the Stack's own
      // post-mount re-render sweeps the whole tree and the worklet re-runs for
      // an unrelated reason, so the assertion passes with reactivity removed.
      // This writes LATE, once the tree is quiet, and nothing but the write can
      // account for the worklet seeing it.
      measured.value = 4242
      setTimeout(() => {
        if (lastSeen.current !== 4242) {
          throw new Error(
            `a shared-value write never re-ran useAnimatedStyle (worklet last saw ${lastSeen.current}) — ` +
              `every style computed from a measured value is stuck on its first render`,
          )
        }
      }, 0)
    }, 150)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    // The line that used to kill the screen: `undefined is not a function`
    // happens at the CALL, so the .catch never gets the chance to catch it.
    Notifications.setBadgeCountAsync(0).catch(() => undefined)
    void Notifications.getBadgeCountAsync()
    void requestWidgetUpdate({ widgetName: 'Shots' } as never)
    void openAuthSessionAsync('https://example.com', 'shots://')
    dismissAuthSession()
  }, [])

  // Each of these has to survive being *called*, not merely imported.
  const db = openDatabaseSync('shots.db')
  const rows = db.getAllSync('select 1')
  const path = Paths.join(Paths.document, 'shots.txt')
  const file = new File(path)
  const dir = new Directory(Paths.cache)
  const skPath = Skia.Path.Make().moveTo(0, 0).lineTo(1, 1)
  const commands = codegenNativeCommands({ supportedCommands: ['animateToRegion'] })
  const assetId = registerAsset({ name: 'pixel', type: 'webp' })
  const keyframe = new Keyframe({ 0: { opacity: 0 }, 100: { opacity: 1 } })

  // Named, not a bare list of booleans: when one of these goes false the run has
  // to say *which*, or it has told you only that something, somewhere, broke.
  const checks: Record<string, boolean> = {
    'react-native/DevSettings': typeof DevSettings.reload === 'function',
    'react-native/TurboModuleRegistry': TurboModuleRegistry.get('Nope') === null,
    'gesture-handler/ScrollView': typeof ScrollView !== 'undefined',
    'gesture-handler/FlatList': typeof FlatList !== 'undefined',
    'expo-sqlite/getAllSync': Array.isArray(rows) && rows.length === 0,
    'expo-file-system/File': file.exists === false,
    'expo-file-system/Directory': dir.exists === false,
    'skia/Skia.Path.Make().moveTo().lineTo()': Boolean(skPath),
    'rn-internal/codegenNativeCommands': typeof commands.animateToRegion === 'function',
    'rn-internal/registerAsset': assetId > 0,
    'reanimated/Keyframe': Boolean(keyframe),
    'loader/.webp': Boolean(pixel),
    'react-navigation/useIsFocused': focused,
    'react-navigation/useNavigationState': routeName === route.name,
    'react-navigation/useNavigation': typeof navigation.navigate === 'function',
    'react-navigation-elements/useHeaderHeight': headerHeight > 0,
    'react-navigation-bottom-tabs/useBottomTabBarHeight': tabBarHeight > 0,
    'expo-auth-session/makeRedirectUri': typeof makeRedirectUri() === 'string',
    'rn-internal/Platform.OS is a real platform': RNPlatform.OS === 'ios' || RNPlatform.OS === 'android',
    'rn-internal/Platform.select picks a branch': RNPlatform.select({ ios: 'yes', default: 'no' }) === 'yes',

    // THE ONE THAT MADE A WHOLE TAB BAR INVISIBLE. `interpolate` was `(x) => x`,
    // so a bar at rest asking "how opaque am I?" was told 0 instead of 1 — and
    // it rendered, correctly, fully transparent, in every frame.
    'reanimated/interpolate maps a range': interpolate(0, [0, 80], [1, 0], Extrapolation.CLAMP) === 1,
    'reanimated/interpolate at the far end': interpolate(80, [0, 80], [1, 0], Extrapolation.CLAMP) === 0,
    'reanimated/interpolate midpoint': interpolate(40, [0, 80], [1, 0]) === 0.5,
    'reanimated/interpolate clamps': interpolate(999, [0, 80], [1, 0], Extrapolation.CLAMP) === 0,

    // A write to a shared value has to reach the screen, or a style computed
    // from it keeps whatever it said on the first render. The subscription is
    // asserted below, in an effect; this only proves the write lands.
    'reanimated/shared value takes a write': (() => {
      progress.value = 0.25
      const ok = progress.value === 0.25
      progress.value = 1
      return ok
    })(),
    'reanimated/useAnimatedProps evaluates the worklet': animatedProps.opacity === 1,
    'react-native/TurboModuleRegistry.getEnforcing survives use':
      typeof TurboModuleRegistry.getEnforcing('Anything').addListener === 'function',
    // config.setup ran, and finished, BEFORE this render. Not "eventually".
    'config.setup ran before mount': window.__SHOTS_SETUP_RAN__ === true,
  }

  // Throwing is the assertion.
  //
  // A screen that renders "a stub did not answer" in small grey type is a screen
  // that quietly becomes a PNG and gets uploaded. This tool's own rule is that a
  // screen which throws must never become a file — so failing here is what makes
  // the e2e run *fail* rather than merely look wrong to someone who thinks to
  // look.
  const broken = Object.keys(checks).filter((k) => !checks[k])
  if (broken.length) throw new Error(`stubs did not answer: ${broken.join(', ')}`)

  return (
    <ScrollView style={{ flex: 1 }}>
      <Animated.View entering={FadeIn} exiting={FadeOutUp} layout={CurvedTransition} animatedProps={animatedProps}>
        <Text testID="kitchen-sink" style={{ fontSize: 17, padding: 16 }}>
          every stub answered
        </Text>
      </Animated.View>

      {/* Rendered, not just imported: a component that is `undefined` throws here. */}
      <Canvas style={{ width: 1, height: 1 }}>
        <Atlas image={null} sprites={useRSXformBuffer(0, () => undefined)} transforms={[]} />
      </Canvas>
      <Confetti count={1} />
      <MapView style={{ width: 1, height: 1 }}>
        <Marker coordinate={{ latitude: 0, longitude: 0 }} />
      </MapView>
      <FlexWidget>
        <TextWidget text="widget" />
        <OverlapWidget />
        <SvgWidget svg="" />
      </FlexWidget>
      <View style={{ height: 1 }} />
    </ScrollView>
  )
}

/** Declared, not rendered: the factory has to hand back a navigator that exists. */
export const Stack = createNativeStackNavigator()

/** Exported so the descriptors are not dead code esbuild can drop before checking them. */
export const descriptors = [
  FadeOutDown,
  FadeOutLeft,
  FadeOutRight,
  SlideInDown,
  SlideInUp,
  SlideOutDown,
  SlideOutUp,
  SequencedTransition,
  EntryExitTransition,
  LayoutGrid,
]
