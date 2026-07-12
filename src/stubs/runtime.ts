/** The seeded phone state, handed to the page by build.mjs. */
export interface Runtime {
  coords: { latitude: number; longitude: number; accuracy: number }
  locale: string
  storage: Record<string, string>
  secureStore: Record<string, string>
  tabBar: { tint?: string; items: { id: string; label: string; icon?: string }[] }
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
