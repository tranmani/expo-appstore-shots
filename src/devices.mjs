/**
 * Device presets.
 *
 * `width`/`height` are logical points — the viewport the app is laid out in.
 * `scale` turns that into the pixel size App Store Connect demands, so the raw
 * screenshot is already the exact resolution of the slot it will fill.
 *
 * `insets` are the safe-area values the app reads via react-native-safe-area-
 * context. Get them wrong and headers sit under the notch.
 */
export const DEVICES = {
  /** The required iPhone slot (16 Pro Max / 15 Pro Max). */
  'iphone-6.9': {
    label: 'iPhone 6.9"',
    out: '6.9',
    width: 430,
    height: 932,
    scale: 3,
    insets: { top: 62, bottom: 34 },
    size: [1290, 2796],
    kind: 'phone',
  },
  /** The older iPhone family. Same frame, downscaled. */
  'iphone-6.5': {
    label: 'iPhone 6.5"',
    out: '6.5',
    width: 430,
    height: 932,
    scale: 3,
    insets: { top: 62, bottom: 34 },
    size: [1284, 2778],
    renderWith: 'iphone-6.9',
    kind: 'phone',
  },
  /**
   * The 6.3" slot — iPhone 16/17 Pro, a current App Store Connect display size
   * (it accepts 1179×2556 or 1206×2622; this is the 16 Pro native). Every iPhone
   * is ~0.46 tall-to-wide, so it composes from the 6.9 render and resizes, the
   * same way 6.5 does — no extra shot.
   */
  'iphone-6.3': {
    label: 'iPhone 6.3"',
    out: '6.3',
    width: 430,
    height: 932,
    scale: 3,
    insets: { top: 62, bottom: 34 },
    size: [1206, 2622],
    renderWith: 'iphone-6.9',
    kind: 'phone',
  },
  /**
   * Google Play phone. 1080×2160 is 2:1 — the tallest Play accepts (it rejects
   * anything over 2:1), and a sensible modern height. Rendered at its OWN
   * viewport (360×720 @3), not resized from the iPhone, so the app lays out for
   * an Android-shaped screen rather than an iPhone one stretched into a taller box.
   *
   * CAVEAT worth stating: the bundle is shared, and it is built with
   * `Platform.OS === 'ios'`, so an app that branches its *layout* on the platform
   * renders its iOS branch here. For the many RN apps whose two layouts are the
   * same JS, this is the real screen at the real Android size; for the few that
   * differ, a per-platform bundle is future work.
   */
  'android-phone': {
    label: 'Android phone',
    out: 'android-phone',
    width: 360,
    height: 720,
    scale: 3,
    insets: { top: 28, bottom: 24 },
    size: [1080, 2160],
    kind: 'android-phone',
  },
  /**
   * Google Play tablets, 7" and 10". Both 1.6:1 (well inside Play's 2:1 limit)
   * and the sizes their tooling ships, rendered natively at their own viewport.
   * `kind` carries BOTH facts: `android` (so the gesture pill draws) and `tablet`
   * (so the layout uses the tablet proportions) — the compositor reads each with
   * a substring test rather than an exact kind.
   */
  'android-tablet-7': {
    label: 'Android 7" tablet',
    out: 'android-tablet-7',
    width: 600,
    height: 960,
    scale: 2,
    insets: { top: 28, bottom: 24 },
    size: [1200, 1920],
    kind: 'android-tablet',
  },
  'android-tablet-10': {
    label: 'Android 10" tablet',
    out: 'android-tablet-10',
    width: 800,
    height: 1280,
    scale: 2,
    insets: { top: 28, bottom: 24 },
    size: [1600, 2560],
    kind: 'android-tablet',
  },
  'ipad-13': {
    label: 'iPad 13"',
    out: 'ipad-13',
    width: 1032,
    height: 1376,
    scale: 2,
    insets: { top: 24, bottom: 20 },
    size: [2064, 2752],
    kind: 'tablet',
  },
  'ipad-12.9': {
    label: 'iPad 12.9"',
    out: 'ipad-12.9',
    width: 1024,
    height: 1366,
    scale: 2,
    insets: { top: 24, bottom: 20 },
    size: [2048, 2732],
    renderWith: 'ipad-13',
    kind: 'tablet',
  },
}

/** Presets that are shot for real; the rest are resized from `renderWith`. */
export function resolveDevices(names) {
  const chosen = names.map((n) => {
    const d = DEVICES[n]
    if (!d) throw new Error(`unknown device "${n}" (have: ${Object.keys(DEVICES).join(', ')})`)
    return { id: n, ...d }
  })

  const rendered = new Map()
  for (const d of chosen) {
    const base = d.renderWith ? { id: d.renderWith, ...DEVICES[d.renderWith] } : d
    rendered.set(base.id, base)
  }
  return { chosen, rendered: [...rendered.values()] }
}
