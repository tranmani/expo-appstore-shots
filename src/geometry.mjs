/**
 * The numbers the page and the run both have to agree on.
 */

/**
 * How much room the tab bar takes.
 *
 * It is drawn `position: fixed` in the page, but on a device the real bar takes
 * layout space — so the screen is inset above it. Without that, anything
 * anchored to the bottom (a floating action button, a paginator) lands
 * underneath the bar in the frame, and the only way to get a clean shot is to
 * delete the feature, which is a lie about the app.
 *
 * The capsule floats 26pt up and stands 58pt tall; the flat bar is 84pt tall
 * including the home indicator. Both come to 84, which is a coincidence, but a
 * convenient one.
 */
export const TAB_BAR_HEIGHT = 84

/**
 * The band of the *frame* the bar occupies: the bar, plus the shadow it casts
 * upward. The shadow is a soft gradient, and to anything measuring pixels a
 * gradient is content — so a dead-space check that skips only the bar starts
 * measuring inside the shadow, finds it busy, and reports a half-empty screen as
 * full. That is the failure this constant exists to prevent.
 *
 * It is deliberately *not* the layout inset. Insetting the screen by the shadow
 * as well would shove the app's content up 20pt for no reason, and the frame
 * would stop matching the device.
 */
export const TAB_BAR_BAND = TAB_BAR_HEIGHT + 20
