/**
 * Themes: a ground is `{ bg, dot, ink, muted, accent }`, and a theme is a
 * coherent light+dark PAIR of them sharing one accent — because a slide picks
 * its ground (`slide.ground: 'light' | 'dark'`) and a deck mixes both for rhythm.
 *
 * `frame.grounds` stays the escape hatch: it overrides whatever theme is in play,
 * token by token, so an app can adopt a named theme and still nudge one colour.
 * With no `frame.theme` at all, the defaults below are used unchanged — which is
 * what keeps every existing deck byte-identical.
 */

/** The tool's original grounds. The zero-config look; do not repaint these. */
export const DEFAULT_GROUNDS = {
  light: { bg: '#F4F3F0', dot: '#D8D6CE', ink: '#181A17', muted: '#676F6D' },
  dark: { bg: '#17513F', dot: '#23614D', ink: '#F5F3EE', muted: '#9FC2B3' },
}

/**
 * Named themes.
 *
 * Each light/dark anchor is a real, chosen palette — five directions that cover
 * most apps without reaching for the AI-design defaults — and each gets a
 * companion in the other mode so a deck can run a dark hero against a light
 * feature wall. The accent is shared across the pair, and it is what a
 * mixed-emphasis word (`*like this*`) is painted with.
 */
export const THEMES = {
  'clean-light': {
    light: { bg: '#F6F1EA', dot: '#E4DCCF', ink: '#171717', muted: '#5C5C57', accent: '#5B7CFA' },
    dark: { bg: '#14161B', dot: '#242832', ink: '#F6F1EA', muted: '#A9ACB5', accent: '#8FA6FF' },
  },
  'dark-bold': {
    dark: { bg: '#0B1020', dot: '#1A2138', ink: '#F8FAFC', muted: '#9AA6C0', accent: '#8B5CF6' },
    light: { bg: '#EEF0F7', dot: '#D8DCEA', ink: '#0B1020', muted: '#565E78', accent: '#7C4DE0' },
  },
  'warm-editorial': {
    light: { bg: '#F7E8DA', dot: '#E9D3BE', ink: '#2B1D17', muted: '#6E574A', accent: '#C2410C' },
    dark: { bg: '#231712', dot: '#3A2820', ink: '#F7E8DA', muted: '#C2A491', accent: '#F59E42' },
  },
  'ocean-fresh': {
    light: { bg: '#E0F2FE', dot: '#C2E4F7', ink: '#0C4A6E', muted: '#3B6E88', accent: '#0284C7' },
    dark: { bg: '#07293B', dot: '#123B52', ink: '#E0F2FE', muted: '#8FBBD1', accent: '#38BDF8' },
  },
  'bloom-roast': {
    light: { bg: '#F2ECE2', dot: '#E0D6C6', ink: '#1D2420', muted: '#5E655E', accent: '#9A5A2E' },
    dark: { bg: '#181D19', dot: '#2A322B', ink: '#F2ECE2', muted: '#A9B1A6', accent: '#CE9067' },
  },
}

/**
 * The light+dark grounds a frame resolves to, in precedence order:
 *
 *   named theme  <  frame.grounds override  <  (accent falls back to frame.accent, then ink)
 *
 * With no theme and no override this is `DEFAULT_GROUNDS` with `accent = ink` —
 * so a headline with no emphasis, on a deck that set no accent, renders exactly
 * as it always has.
 */
export function resolveGrounds(frame = {}) {
  const base = (frame.theme && THEMES[frame.theme]) || DEFAULT_GROUNDS
  const ground = (mode) => {
    const g = { ...base[mode], ...(frame.grounds?.[mode] ?? {}) }
    if (g.accent == null) g.accent = frame.accent ?? g.ink
    return g
  }
  return { light: ground('light'), dark: ground('dark') }
}

/** Relative luminance of a #rrggbb colour, per WCAG. */
function luminance(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/**
 * WCAG contrast ratio between two colours, 1–21.
 *
 * The thumbnail test in one number: a headline reads at a glance only if its ink
 * stands off its ground, and 3:1 is the bar for large text. A ground where the
 * ink and the background are close produces a frame that looks fine at full size
 * and vanishes in the App Store's search results — the exact failure a person
 * scrolling past does not catch.
 */
export function contrastRatio(a, b) {
  const [x, y] = [luminance(a) + 0.05, luminance(b) + 0.05]
  return Math.max(x, y) / Math.min(x, y)
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/**
 * A headline, with one idea allowed to carry the accent.
 *
 * `A home for *every* coffee.` paints the starred word in the ground's accent —
 * their "mixed emphasis inside the headline" rule, which is what stops a wall of
 * one-weight type from reading flat. The text is escaped FIRST, so the markers
 * survive escaping and nothing a user types can inject markup; a headline with no
 * `*` comes back exactly escaped, byte-for-byte what it was before this existed.
 */
export function renderHeadline(text, accent) {
  return escapeHtml(text ?? '').replace(
    /\*([^*]+)\*/g,
    (_, word) => `<span class="em" style="color:${accent};font-style:italic">${word}</span>`,
  )
}

export { escapeHtml }
