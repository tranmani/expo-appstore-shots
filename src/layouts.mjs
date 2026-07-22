/**
 * Layouts: how the caption and the device sit on the ground.
 *
 * One composition used to be hard-coded — caption at the top, device below it.
 * That is still here, named `standard`, and it is still the default, so a deck
 * that names no layout composes exactly as it did before. The others are the
 * variety their decks get from never repeating a composition twice in a row: the
 * device on top, a smaller device centred, a headline with no device at all.
 *
 * A layout is a pure function of the device: given the slot's pixel size and
 * whether it is a phone or a tablet, it returns where everything goes. The
 * compositor in compose.mjs consumes the plan and draws it — the layout never
 * touches HTML, so a new one is a few numbers, not a new template.
 */

export const LAYOUTS = ['standard', 'hero', 'device-top', 'device-bottom', 'no-device', 'two-devices']

/** A tablet-shaped device — iPad or Android tablet — gets the roomier proportions. */
export const isTablet = (device) => /tablet/.test(device.kind)
/** An Android device — phone or tablet — gets Android chrome (the gesture pill). */
export const isAndroid = (device) => /^android/.test(device.kind)

/** The proportional anchors the `standard` layout has always used. */
function base(device) {
  const [W, H] = device.size
  const tablet = isTablet(device)
  return {
    W,
    H,
    tablet,
    margin: Math.round(W * 0.065),
    captionTop: Math.round(H * 0.052),
    headline: Math.round(W * (tablet ? 0.057 : 0.065)),
    sub: Math.round(W * (tablet ? 0.028 : 0.031)),
    deviceTop: Math.round(H * (tablet ? 0.255 : 0.222)),
    deviceWidth: Math.round(W * (tablet ? 0.68 : 0.76)),
    radius: Math.round(W * (tablet ? 0.021 : 0.043)),
    bezel: Math.round(W * 0.01),
  }
}

/**
 * The full plan for one slide: the `standard` fields above, plus where the
 * caption anchors, whether the device shows, and any tilt.
 *
 * `standard` returns the base untouched — the values are identical to the old
 * `defaults(device)`, which is the whole reason existing frames do not move.
 */
export function layoutPlan(name, device) {
  const b = base(device)
  const { W, H, tablet } = b
  const common = {
    ...b,
    captionAnchor: 'top', // 'top' | 'bottom' | 'middle'
    captionAlign: 'left',
    deviceShown: true,
    tilt: 0,
  }

  switch (name) {
    case 'standard':
      return common

    // A bigger headline up top and a larger device dropped lower, so it fills the
    // slot and bleeds toward the fold — the loud opener a hero slide wants.
    case 'hero':
      return {
        ...common,
        headline: Math.round(b.headline * 1.14),
        deviceTop: Math.round(H * (tablet ? 0.3 : 0.28)),
        deviceWidth: Math.round(b.deviceWidth * (tablet ? 1.04 : 1.06)),
      }

    // Device on top, caption beneath it — good contrast against a busy screen,
    // and the composition that reads most differently from `standard` next to it.
    case 'device-top':
      return {
        ...common,
        deviceTop: Math.round(H * (tablet ? 0.055 : 0.045)),
        captionAnchor: 'bottom',
        captionBottom: Math.round(H * (tablet ? 0.06 : 0.055)),
      }

    // A smaller headline and a centred device — a quieter beat between two loud ones.
    case 'device-bottom':
      return {
        ...common,
        headline: Math.round(b.headline * 0.9),
        deviceTop: Math.round(H * (tablet ? 0.3 : 0.31)),
        deviceWidth: Math.round(b.deviceWidth * 0.94),
      }

    // Two phones layered — a front screen and a second behind it, tilted the
    // other way. The slide names the second with `screenSecondary`. Both anchor
    // by their top-left (not centred), because they overlap on purpose.
    case 'two-devices': {
      const width = Math.round(b.deviceWidth * 0.72)
      return {
        ...common,
        headline: Math.round(b.headline * 0.92),
        deviceWidth: width,
        deviceTop: Math.round(H * (tablet ? 0.34 : 0.33)),
        deviceLeft: Math.round(W * 0.4), // front, right of centre
        tilt: 4,
        // The back phone: a touch smaller, shifted up and left, tilted away,
        // behind. `screenSecondary` supplies its screenshot.
        secondary: {
          width: Math.round(width * 0.94),
          top: Math.round(H * (tablet ? 0.29 : 0.27)),
          left: Math.round(W * 0.05),
          tilt: -7,
        },
      }
    }

    // No device at all: a big statement, centred, for the one slide that is the
    // idea and not the screen. Use sparingly — their rule, and ours.
    case 'no-device':
      return {
        ...common,
        deviceShown: false,
        captionAnchor: 'middle',
        captionAlign: 'center',
        headline: Math.round(b.headline * (tablet ? 1.35 : 1.5)),
        sub: Math.round(b.sub * 1.15),
      }

    default:
      throw new Error(`unknown layout "${name}" (have: ${LAYOUTS.join(', ')})`)
  }
}
