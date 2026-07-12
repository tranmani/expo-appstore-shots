/**
 * The tab bar, redrawn.
 *
 * This is the one piece of chrome your app does not own: with expo-router's
 * native tabs, iOS renders a real UITabBar with SF Symbols in it, and a headless
 * Linux browser has neither. Leaving it out would misrepresent the app more than
 * approximating it does — so it is rebuilt from `config.tabBar`, in the iOS 26
 * floating-capsule shape.
 *
 * Everything above this bar is your app's own code. If your app draws its own JS
 * tab bar, set `tabBar.enabled: false` and this disappears.
 */
import { StyleSheet, View, Text } from 'react-native'
import { icons } from 'lucide-react-native'
import { runtime } from './stubs/runtime'

/** iOS's own selected tint, sampled from a device. Override in the config. */
const TINT = '#367CED'
const IDLE = '#0B0B0B'

export function TabBar({ active }: { active: string }) {
  const { tabBar } = runtime()
  if (!tabBar?.items?.length) return null

  const tint = tabBar.tint ?? TINT

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.bar}>
        {tabBar.items.map((item) => {
          const on = item.id === active
          const Glyph = item.icon ? (icons as Record<string, never>)[item.icon] : undefined
          return (
            <View key={item.id} style={[styles.item, on && styles.itemOn]}>
              {Glyph ? (
                <Glyph size={26} color={on ? tint : IDLE} strokeWidth={on ? 2.4 : 2} />
              ) : (
                <View style={[styles.dot, { backgroundColor: on ? tint : IDLE }]} />
              )}
              <Text style={[styles.label, { color: on ? tint : IDLE }]} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Fixed to the viewport, not to the screen's content: the real bar floats over
  // whatever is scrolling under it, while an `absolute` box would anchor to the
  // bottom of a long list, far below the fold.
  wrap: { position: 'fixed' as 'absolute', left: 0, right: 0, bottom: 26, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    paddingHorizontal: 6,
    borderRadius: 29,
    backgroundColor: 'rgba(253,253,253,0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  item: {
    minWidth: 88,
    height: 50,
    paddingHorizontal: 10,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  itemOn: { backgroundColor: '#E9E9EB' },
  dot: { width: 22, height: 22, borderRadius: 11 },
  label: { fontSize: 11, fontWeight: '500', lineHeight: 14 },
})
