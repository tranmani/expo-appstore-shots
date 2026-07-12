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
import { StyleSheet, Text, View } from 'react-native'
import { getInsets } from './runtime'

export interface Target {
  /** Route name as the root layout registers it, e.g. `station/[code]`. */
  route: string
  component: ComponentType<Record<string, unknown>>
  params?: Record<string, string>
  /** Pushed screens draw a back chevron. */
  back?: boolean
  tab?: string
  /** Header title, when the screen's own layout (not the root one) sets it. */
  title?: string
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

/**
 * The header React Navigation draws when an app does not replace it: a title,
 * a back chevron, and whatever `headerRight` renders. Most apps never customise
 * this, and a screenshot without it looks like a different product.
 */
function DefaultHeader({
  options,
  back,
}: {
  options: Record<string, unknown>
  back?: unknown
}) {
  const insets = getInsets()
  const style = (options.headerStyle ?? {}) as { backgroundColor?: string }
  const tint = (options.headerTintColor as string) ?? '#111111'
  const right = (options.headerRight as ((p: unknown) => ReactNode) | undefined)?.({ tintColor: tint })
  const left = (options.headerLeft as ((p: unknown) => ReactNode) | undefined)?.({ tintColor: tint })

  return (
    <View
      style={[
        header.wrap,
        { paddingTop: insets.top, backgroundColor: style.backgroundColor ?? '#FFFFFF' },
      ]}
    >
      <View style={header.bar}>
        <View style={header.side}>
          {left ?? (back ? <Text style={[header.chevron, { color: tint }]}>‹</Text> : null)}
        </View>
        <Text style={[header.title, { color: tint }]} numberOfLines={1}>
          {(options.title as string) ?? ''}
        </Text>
        <View style={[header.side, header.right]}>{right}</View>
      </View>
    </View>
  )
}

const header = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.12)' },
  bar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  side: { minWidth: 64, flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end' },
  chevron: { fontSize: 30, lineHeight: 34, fontWeight: '400' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
})

export function Stack({
  screenOptions,
  children,
}: {
  screenOptions?: Record<string, unknown>
  children?: ReactNode
}) {
  const own = useDeclared()
  const options = {
    ...(screenOptions ?? {}),
    ...(registered[target.route] ?? {}),
    ...(target.title ? { title: target.title } : {}),
    ...own,
  }
  const custom = screenOptions?.header as ((p: Record<string, unknown>) => ReactNode) | undefined
  const Screen = target.component

  const props = {
    navigation,
    options,
    back: target.back ? {} : undefined,
    route: { name: target.route, params: target.params ?? {} },
  }

  return (
    <View style={{ flex: 1 }}>
      {children}
      {options.headerShown === false ? null : custom ? (
        custom(props)
      ) : (
        <DefaultHeader options={options} back={props.back} />
      )}
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
