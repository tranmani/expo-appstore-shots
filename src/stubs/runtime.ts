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
 * Where a list starts. A chat opens on its newest message (`end`); a list of
 * clients opens at the top, which is also where a screenshot of it should start.
 */
let listScroll: 'top' | 'end' = 'top'
export function setListScroll(v: 'top' | 'end') {
  listScroll = v
}
export const getListScroll = () => listScroll
