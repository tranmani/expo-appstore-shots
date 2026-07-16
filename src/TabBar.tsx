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
/**
 * A NAMESPACE IMPORT, AND IT HAS TO STAY ONE.
 *
 * This was `import { icons } from 'lucide-react-native'`, which read better and
 * worked for years — lucide exported an `icons` object keyed by name. It stopped
 * doing that: since 0.544 the icons are individual PascalCase named exports and
 * there is no `icons` object at all, so `icons` came back `undefined` and every
 * glyph in the bar turned into a grey dot. No error — the code that reads it
 * (`item.icon in icons`) fails just as quietly.
 *
 * The namespace is the same lookup table in both worlds: old lucide puts `icons`
 * *and* the individual names in it, new lucide puts only the names. Reading it
 * this way is version-proof in a way the destructure never was.
 */
import * as icons from 'lucide-react-native'
import { runtime } from './stubs/runtime'

/** iOS's own selected tint, sampled from a device. Override in the config. */
const TINT = '#367CED'
const IDLE = '#0B0B0B'

/**
 * An icon name lucide does not have renders as nothing, and a hole in a tab bar
 * is easy to miss. lucide only exists in the page (it is a react-native package,
 * so Node cannot import it), so the names are checked here and handed out for
 * the run to report — with a near-match, since this is nearly always a rename:
 * `BarChart3` became `ChartColumn`.
 */
function reportIcons(items: { id: string; icon?: string }[]) {
  const w = window as unknown as Record<string, unknown>
  const names = Object.keys(icons)

  // Read off the key list, NOT as `icons.__shotsLucideMissing`.
  //
  // A static member access on a namespace is something esbuild checks, and when
  // the real lucide is bundled that name is not in it — so the sentinel check
  // *itself* raised "Import __shotsLucideMissing will always be undefined" on
  // every app that has lucide installed. A diagnostic that fires on the healthy
  // case is worse than no diagnostic: it is the thing that teaches people to
  // ignore the warnings.
  const absent = names.includes('__shotsLucideMissing')

  // No lucide at all: every name is "missing", which is true and useless. The
  // one fact worth saying is said once, at bundle time, by build.mjs — saying it
  // again here per icon would bury the findings that are about this app.
  if (absent) {
    w.__SHOTS_ICON_NAMES__ = []
    w.__SHOTS_ICONS_MISSING__ = []
    return
  }

  w.__SHOTS_ICON_NAMES__ = names
  w.__SHOTS_ICONS_MISSING__ = items
    .filter((i) => i.icon && !names.includes(i.icon))
    .map((i) => ({ tab: i.id, icon: i.icon }))
}

export function TabBar({ active }: { active: string }) {
  const { tabBar } = runtime()
  if (!tabBar?.items?.length) return null

  reportIcons(tabBar.items)

  const tint = tabBar.tint ?? TINT
  const idle = tabBar.idle ?? IDLE
  // 'capsule' is the iOS 26 floating bar that expo-router's *native* tabs draw.
  // 'bar' is the flat, full-width bar React Navigation's JS tabs draw. Pick the
  // one your app actually ships, or the screenshot shows a different app.
  const flat = tabBar.style === 'bar'

  return (
    <View
      style={[styles.wrap, flat && styles.wrapFlat]}
      pointerEvents="none"
      // Marks this subtree as the tool's chrome, so the verify pass does not
      // report the tab bar's own labels as app content hidden under the tab bar.
      dataSet={{ shotsChrome: 'true' }}
    >
      <View style={[styles.bar, flat && { ...styles.barFlat, backgroundColor: tabBar.background ?? '#FFFFFF' }]}>
        {tabBar.items.map((item) => {
          const on = item.id === active
          const Glyph = item.icon ? (icons as Record<string, never>)[item.icon] : undefined
          return (
            <View key={item.id} style={[styles.item, !flat && on && styles.itemOn, flat && styles.itemFlat]}>
              {Glyph ? (
                <Glyph size={flat ? 24 : 26} color={on ? tint : idle} strokeWidth={on ? 2.2 : 2} />
              ) : (
                <View style={[styles.dot, { backgroundColor: on ? tint : idle }]} />
              )}
              <Text style={[styles.label, { color: on ? tint : idle }]} numberOfLines={1}>
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
  // The flat bar spans the screen and sits on the home indicator, as React
  // Navigation's does; the capsule floats above it.
  wrapFlat: { bottom: 0 },
  barFlat: {
    height: 84,
    paddingBottom: 22,
    borderRadius: 0,
    width: '100%',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    shadowOpacity: 0,
  },
  itemFlat: { flex: 1, minWidth: 0, borderRadius: 0, gap: 3 },
  dot: { width: 22, height: 22, borderRadius: 11 },
  label: { fontSize: 11, fontWeight: '500', lineHeight: 14 },
})
