/**
 * The React Navigation navigator packages: native-stack, stack, bottom-tabs,
 * drawer, material-top-tabs. One module stands in for all of them, because from
 * a screenshot's point of view they are the same object: a factory that returns
 * `{ Navigator, Screen, Group }`.
 *
 * `Navigator` is the tool's own `Stack` — the same one expo-router's stub uses.
 * That is the whole trick, and it is what lets a React Navigation app point
 * `config.rootLayout` at its real `App.tsx`: every provider above the navigator
 * mounts and runs for real, and at the navigator itself the tree stops
 * pretending to navigate and renders the one screen being photographed, with
 * the `options` that screen declared.
 *
 * `Screen` is expo-router's `Stack.Screen`, which registers options by route
 * name — so `<Stack.Screen name="Home" options={{ title: 'Home' }} />` puts a
 * real title in the header of the screen configured as `route: 'Home'`.
 */
import type { ReactNode } from 'react'
import { Stack } from './expo-router'
import { getInsets, TAB_BAR_HEIGHT } from './runtime'

const Group = ({ children }: { children?: ReactNode }) => <>{children}</>

const factory = () => ({ Navigator: Stack, Screen: Stack.Screen, Group })

export const createNativeStackNavigator = factory
export const createStackNavigator = factory
export const createBottomTabNavigator = factory
export const createDrawerNavigator = factory
export const createMaterialTopTabNavigator = factory
export const createMaterialBottomTabNavigator = factory

/**
 * The tab bar's height, which is this tool's number rather than the app's: the
 * bar in the frame is redrawn from `config.tabBar` (see TabBar.tsx), so a screen
 * that insets itself by this value lines up with the bar that is actually in the
 * picture.
 */
export const useBottomTabBarHeight = () => TAB_BAR_HEIGHT
export const BottomTabBarHeightContext = {
  Provider: Group,
  Consumer: ({ children }: { children?: (h: number) => ReactNode }) => <>{children?.(TAB_BAR_HEIGHT)}</>,
}
export const BottomTabBarHeightCallbackContext = { Provider: Group }
export const useCardAnimation = () => ({ current: { progress: { value: 1 } }, closing: { value: 0 } })
export const useGestureHandlerRef = () => ({ current: null })
export const useAnimatedHeaderHeight = () => headerHeight()
export const TransitionPresets = {
  SlideFromRightIOS: {},
  ModalSlideFromBottomIOS: {},
  ModalPresentationIOS: {},
  FadeFromBottomAndroid: {},
  RevealFromBottomAndroid: {},
  ScaleFromCenterAndroid: {},
  DefaultTransition: {},
  ModalTransition: {},
}
export const TransitionSpecs = { TransitionIOSSpec: {}, FadeInFromBottomAndroidSpec: {}, FadeOutToBottomAndroidSpec: {} }
export const CardStyleInterpolators = {
  forHorizontalIOS: () => ({}),
  forVerticalIOS: () => ({}),
  forModalPresentationIOS: () => ({}),
  forFadeFromBottomAndroid: () => ({}),
  forRevealFromBottomAndroid: () => ({}),
  forScaleFromCenterAndroid: () => ({}),
  forNoAnimation: () => ({}),
}
export const HeaderStyleInterpolators = {
  forUIKit: () => ({}),
  forFade: () => ({}),
  forStatic: () => ({}),
  forNoAnimation: () => ({}),
}

/** iOS's own: 44pt of bar, plus whatever the notch takes. */
function headerHeight() {
  return 44 + getInsets().top
}
