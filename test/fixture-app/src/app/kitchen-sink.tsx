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
import { useEffect } from 'react'
import { DevSettings, Text, TurboModuleRegistry, View } from 'react-native'

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
  const navigation = useNavigation()
  const route = useRoute()
  const focused = useIsFocused()
  const headerHeight = useHeaderHeight()
  const tabBarHeight = useBottomTabBarHeight()
  const routeName = useNavigationState((state: { routes: { name: string }[] }) => state.routes[0]?.name)
  const progress = useSharedValue(1)
  const animatedProps = useAnimatedProps(() => ({ opacity: progress.value }))
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
  useEffect(() => {
    // On a tick, not in this effect: the layout's `<Stack.Screen name=…>` is a
    // *child* of the Stack that draws the header, and child effects run before
    // the parent's — so at this instant the registration has only just been
    // written and the header has not been re-rendered from it yet. A screenshot
    // is taken long after; this waits the same way.
    const id = setTimeout(() => {
      const page = document.body.textContent ?? ''
      if (!page.includes('REGISTERED-TITLE')) {
        throw new Error(`<Stack.Screen name> options never reached the header — it says "${page.slice(0, 40)}"`)
      }
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
