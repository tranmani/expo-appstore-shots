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
