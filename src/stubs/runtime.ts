/** The seeded phone state, handed to the page by build.mjs. */
export interface Runtime {
  coords: { latitude: number; longitude: number; accuracy: number }
  locale: string
  storage: Record<string, string>
  secureStore: Record<string, string>
  tabBar: {
    /** 'capsule' (iOS native tabs) or 'bar' (React Navigation's JS tabs). */
    style?: 'capsule' | 'bar'
    tint?: string
    idle?: string
    background?: string
    items: { id: string; label: string; icon?: string }[]
  }
  apiUrl: string
}

declare global {
  interface Window {
    __SHOTS__: Runtime
  }
}

export const runtime = (): Runtime => window.__SHOTS__

/** Safe-area insets for the device being shot. Set by the generated entry. */
let insets = { top: 0, bottom: 0, left: 0, right: 0 }
export function setInsets(next: typeof insets) {
  insets = next
}
export const getInsets = () => insets

/**
 * How much room the tab bar takes.
 *
 * It is drawn `position: fixed`, floating over the content — but on a device the
 * real bar *takes layout space*, and the screen is inset above it. Without this,
 * anything anchored to the bottom (a floating action button, a paginator) lands
 * underneath the bar in the frame, and the only way to get a clean shot is to
 * delete the feature — which is a lie about the app.
 *
 * Defined once, in geometry.mjs, because the run needs the same number: it has
 * to know which rows of the PNG are the bar and not dead space.
 */
export { TAB_BAR_HEIGHT } from '../geometry.mjs'

/**
 * Where a list starts.
 *
 * A chat opens on its newest message (`end`); a list of clients opens at the top,
 * which is also where a screenshot of it should start. A number scrolls to that
 * offset, and a string scrolls to the element with that `testID` — either lets a
 * frame land on a specific section rather than on whichever end of the content
 * happens to be interesting.
 */
export type Scroll = 'top' | 'end' | number | string
let listScroll: Scroll = 'top'
export function setListScroll(v: Scroll) {
  listScroll = v
}
export const getListScroll = () => listScroll
