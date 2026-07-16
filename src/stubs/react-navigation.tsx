/**
 * @react-navigation/native — for the apps that are not expo-router apps.
 *
 * This tool grew up around expo-router: a root layout that renders `<Stack/>`,
 * and a router stub that mounts one screen inside it. A React Navigation app has
 * neither. Its screens are perfectly ordinary components, but they call
 * `useNavigation()` / `useRoute()` / `useFocusEffect()`, and those *throw*
 * outside a navigator — "Couldn't find a navigation object" — so every screen in
 * the app fails to render for a reason that has nothing to do with the screen.
 *
 * So the hooks are answered from the same place expo-router's are: the target
 * the run is photographing. `useRoute()` gives the screen the params the config
 * declared, `useNavigation()` gives it a navigator that goes nowhere (there is
 * nowhere to go in a still frame), and `useFocusEffect` runs once, because a
 * mounted screen here is a focused screen forever.
 *
 * The navigator factories are the other half. `createNativeStackNavigator()`
 * hands back the *tool's own* `Stack` as its `Navigator`, which means an app can
 * point `config.rootLayout` at its real `App.tsx` — providers, theme, query
 * client and all — and the tree renders for real right up to the navigator,
 * where this quietly swaps in the one screen being shot. That is also what makes
 * an app's root-level bootstrap actually run.
 */
import { useEffect, type ReactNode } from 'react'
import { getTarget, navigation, Stack } from './expo-router'

/* --------------------------------------------------------------- context --- */

export const NavigationContainer = ({ children }: { children?: ReactNode }) => <>{children}</>
export const NavigationIndependentTree = ({ children }: { children?: ReactNode }) => <>{children}</>
export const BaseNavigationContainer = NavigationContainer
export const NavigationContext = { Provider: ({ children }: { children?: ReactNode }) => <>{children}</> }
export const NavigationRouteContext = NavigationContext

/* ----------------------------------------------------------------- hooks --- */

export const useNavigation = () => navigation
export const useRoute = () => {
  const target = getTarget()
  return { key: `${target.route}-shots`, name: target.route, params: target.params ?? {} }
}

/** Mounted is focused: there is no other screen to lose focus to. */
export const useIsFocused = () => true
export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(effect, [effect])
}

/**
 * `useNavigationState(selector)` — the selector is app code and it runs for
 * real, against the only state this harness has: one route, index 0. A selector
 * that reaches past that (`state.routes[1]`) would throw on a device too, but
 * only here would it cost the screenshot, so it is caught.
 */
export const useNavigationState = <T,>(selector: (state: unknown) => T): T | undefined => {
  const target = getTarget()
  const state = {
    key: 'stack-shots',
    index: 0,
    type: 'stack',
    stale: false as const,
    routeNames: [target.route],
    routes: [{ key: `${target.route}-shots`, name: target.route, params: target.params ?? {} }],
  }
  try {
    return selector(state)
  } catch {
    return undefined
  }
}

export const useNavigationContainerRef = () => ({ current: navigation, ...navigation })
export const createNavigationContainerRef = () => ({ current: navigation, ...navigation, isReady: () => true })

/**
 * For an app that builds its own navigator with `createNavigatorFactory`.
 *
 * The state has to be a real navigation state, not `{}`. A custom navigator's
 * whole job is `state.routes.map(…)`, so an empty object is not a neutral
 * placeholder — it is a TypeError on the first line of the app's own code.
 */
export const useNavigationBuilder = () => {
  const target = getTarget()
  const key = `${target.route}-shots`
  const route = { key, name: target.route, params: target.params ?? {} }
  return {
    state: {
      key: 'stack-shots',
      index: 0,
      type: 'stack',
      stale: false as const,
      routeNames: [target.route],
      routes: [route],
      history: [{ type: 'route', key }],
    },
    descriptors: {
      [key]: {
        options: {},
        route,
        navigation,
        render: () => <target.component {...(target.params ?? {})} />,
      },
    },
    navigation,
    NavigationContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
  }
}

/** Scroll position is the run's business (`config.screens[].scroll`), not the app's. */
export const useScrollToTop = () => undefined
export const usePreventRemove = () => undefined
export const useLinkTo = () => () => undefined
export const useLinkProps = () => ({ onPress: () => undefined, href: '#' })
export const useLinkBuilder = () => () => '#'

/* ----------------------------------------------------------------- theme --- */

export const DefaultTheme = {
  dark: false,
  colors: {
    primary: 'rgb(0, 122, 255)',
    background: 'rgb(242, 242, 242)',
    card: 'rgb(255, 255, 255)',
    text: 'rgb(28, 28, 30)',
    border: 'rgb(216, 216, 216)',
    notification: 'rgb(255, 59, 48)',
  },
  fonts: fontSet('System'),
}

export const DarkTheme = {
  dark: true,
  colors: {
    primary: 'rgb(10, 132, 255)',
    background: 'rgb(1, 1, 1)',
    card: 'rgb(18, 18, 18)',
    text: 'rgb(229, 229, 231)',
    border: 'rgb(39, 39, 41)',
    notification: 'rgb(255, 69, 58)',
  },
  fonts: fontSet('System'),
}

function fontSet(family: string) {
  return {
    regular: { fontFamily: family, fontWeight: '400' as const },
    medium: { fontFamily: family, fontWeight: '500' as const },
    bold: { fontFamily: family, fontWeight: '600' as const },
    heavy: { fontFamily: family, fontWeight: '700' as const },
  }
}

export const useTheme = () => DefaultTheme
export const ThemeProvider = ({ children }: { children?: ReactNode }) => <>{children}</>
export const ThemeContext = { Provider: ThemeProvider }

/* --------------------------------------------------------------- actions --- */

const action = (type: string) => (payload?: unknown) => ({ type, payload })

export const CommonActions = {
  navigate: action('NAVIGATE'),
  reset: action('RESET'),
  goBack: action('GO_BACK'),
  setParams: action('SET_PARAMS'),
  preload: action('PRELOAD'),
}
export const StackActions = {
  push: action('PUSH'),
  pop: action('POP'),
  popTo: action('POP_TO'),
  popToTop: action('POP_TO_TOP'),
  replace: action('REPLACE'),
}
export const TabActions = { jumpTo: action('JUMP_TO') }
export const DrawerActions = {
  openDrawer: action('OPEN_DRAWER'),
  closeDrawer: action('CLOSE_DRAWER'),
  toggleDrawer: action('TOGGLE_DRAWER'),
  jumpTo: action('JUMP_TO'),
}

/* -------------------------------------------------------------- the rest --- */

export const Link = ({ children }: { children?: ReactNode }) => <>{children}</>
export const useNavigationIndependentTree = () => false
export const getStateFromPath = () => undefined
export const getPathFromState = () => '/'
export const getActionFromState = () => undefined
export const getFocusedRouteNameFromRoute = () => getTarget().route
export const validatePathConfig = () => undefined
export const findFocusedRoute = (state: { routes?: unknown[] }) => state.routes?.[0]
export const StackRouter = () => ({})
export const TabRouter = () => ({})
export const DrawerRouter = () => ({})
export const createNavigatorFactory =
  <T,>(Navigator: T) =>
  () => ({ Navigator, Screen: Stack.Screen, Group: passthrough })

export const passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>
export const Screen = Stack.Screen
export const Group = passthrough
export const CurrentRenderContext = { Provider: passthrough }
export const UNSTABLE_usePreventRemove = usePreventRemove
