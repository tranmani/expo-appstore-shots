/**
 * expo-router, reduced to what a screenshot needs: one screen, mounted, with the
 * app's own header drawn above it.
 *
 * The real router owns navigation state and native transitions, neither of which
 * exists in a still frame. What it also owns *does* show up in the frame — the
 * `Stack.Screen options` a screen declares, and the `header` renderer the root
 * layout installs — so those are honoured for real. The header in your
 * screenshots is your header, fed the same options object it gets on device.
 */
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { View } from 'react-native'

export interface Target {
  /** Route name as the root layout registers it, e.g. `station/[code]`. */
  route: string
  component: ComponentType<Record<string, unknown>>
  params?: Record<string, string>
  /** Pushed screens draw a back chevron. */
  back?: boolean
  tab?: string
}

let target: Target
export function setTarget(t: Target) {
  target = t
}

/** Options registered per route by the root layout's `<Stack.Screen name=…>`. */
const registered: Record<string, Record<string, unknown>> = {}
/** Options the mounted screen declares for itself. */
let declared: Record<string, unknown> = {}
const listeners = new Set<() => void>()

function publish(next: Record<string, unknown>) {
  declared = next
  listeners.forEach((l) => l())
}

function useDeclared() {
  const [, bump] = useState(0)
  useEffect(() => {
    const l = () => bump((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return declared
}

const navigation = {
  goBack: () => undefined,
  canGoBack: () => true,
  navigate: () => undefined,
  push: () => undefined,
  setOptions: (o: Record<string, unknown>) => publish({ ...declared, ...o }),
  addListener: () => () => undefined,
  isFocused: () => true,
}

export function Stack({
  screenOptions,
  children,
}: {
  screenOptions?: Record<string, unknown>
  children?: ReactNode
}) {
  const own = useDeclared()
  const options = { ...(registered[target.route] ?? {}), ...own }
  const header = screenOptions?.header as ((p: Record<string, unknown>) => ReactNode) | undefined
  const Screen = target.component

  return (
    <View style={{ flex: 1 }}>
      {children}
      {options.headerShown !== false && header
        ? header({
            navigation,
            options,
            back: target.back ? {} : undefined,
            route: { name: target.route, params: target.params ?? {} },
          })
        : null}
      <View style={{ flex: 1 }}>
        <Screen {...(target.params ?? {})} />
      </View>
    </View>
  )
}

/**
 * Two jobs, exactly as in the real router: with a `name` it registers a route's
 * options; without one it is a screen declaring its own.
 */
Stack.Screen = function StackScreen({
  name,
  options,
}: {
  name?: string
  options?: Record<string, unknown>
}) {
  useEffect(() => {
    if (name) {
      if (options) registered[name] = options
    } else if (options) {
      publish(options)
    }
  }, [name, options])
  return null
}

export const Tabs = Stack
export const Drawer = Stack

export const useLocalSearchParams = <T,>(): T => (target.params ?? {}) as T
export const useGlobalSearchParams = useLocalSearchParams
export const useSearchParams = useLocalSearchParams
export const useSegments = () => target.route.split('/')
export const usePathname = () => `/${target.route}`
export const useNavigation = () => navigation
export const useRootNavigationState = () => ({ key: 'root' })

export const useRouter = () => ({
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  navigate: () => undefined,
  dismiss: () => undefined,
  dismissAll: () => undefined,
  setParams: () => undefined,
  canGoBack: () => true,
})

export const router = useRouter()

/** Screens are mounted, never focused or blurred — run the effect once. */
export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(effect, [effect])
}

export function Link({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
Link.Trigger = ({ children }: { children?: ReactNode }) => <>{children}</>
Link.Preview = () => null
Link.Menu = () => null

export const Redirect = () => null
export const Slot = () => null
export const ErrorBoundary = ({ children }: { children?: ReactNode }) => <>{children}</>
export const SplashScreen = {
  preventAutoHideAsync: async () => undefined,
  hideAsync: async () => undefined,
  setOptions: () => undefined,
}
export const withLayoutContext = <T,>(x: T) => x
