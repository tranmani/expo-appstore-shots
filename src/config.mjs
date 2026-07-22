/**
 * Config normalisation: fill in every default, then refuse the configs that
 * cannot possibly work — a missing root layout, a slide pointing at a screen
 * that was never declared. Failing here costs a second; failing later costs a
 * browser launch and a blank PNG nobody notices until the store rejects it.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAYOUTS } from './layouts.mjs'
import { THEMES } from './theme.mjs'

export class ConfigError extends Error {}

const here = dirname(fileURLToPath(import.meta.url))

/** The root layout for an app that has none — a React Navigation app. See stubs/root-layout.tsx. */
export const BUILTIN_ROOT_LAYOUT = resolve(here, 'stubs', 'root-layout.tsx')

export function normalise(config, configPath) {
  // Every path in the config is relative to the config file itself — one rule,
  // and the same answer whether the config sits in the app or beside it.
  const from = dirname(configPath)
  const at = (p) => resolve(from, p)

  const out = {
    ...config,
    projectRoot: at(config.projectRoot ?? '.'),
    outDir: at(config.outDir ?? 'appstore'),
    workDir: at(config.workDir ?? '.shots'),
    apiPort: config.apiPort ?? 8788,
    // Whether the port was *chosen* or merely defaulted. A default may move out
    // of the way of a stale run; a number someone typed may not. See freePort().
    apiPortExplicit: config.apiPort !== undefined,
    devices: config.devices ?? ['iphone-6.9', 'iphone-6.5'],
    api: { fixtures: at(config.api?.fixtures ?? 'shots/fixtures.mjs') },
    slides: config.slides ?? [],
  }

  out.graphics = normaliseGraphics(config, at, out.projectRoot)

  if (!out.screens?.length) throw new ConfigError('config.screens is empty')

  out.warnings = []

  /**
   * No root layout is a legitimate answer now, and it used to be a hard error.
   *
   * It was written when every app this tool had met was an expo-router app,
   * where `app/_layout.tsx` always exists and pointing at it is free. A React
   * Navigation app has no such file — its root is an `App.tsx` that builds a
   * `NavigationContainer` — so the tool's first question was one that kind of
   * app could not answer, and the whole class of them stopped there.
   *
   * The built-in layout renders the tool's own `Stack`, which is the same
   * machinery the expo-router path uses. It is the minimum, and the note says
   * so: nothing of the app sits above the screen, so an app that needs its
   * providers should point `rootLayout` at a file that mounts them (`App.tsx`
   * itself usually works — the navigator factories resolve to that same Stack).
   */
  if (!out.rootLayout) {
    out.rootLayout = BUILTIN_ROOT_LAYOUT
    out.warnings.push(
      `no config.rootLayout: using the built-in one, which renders your screen and a header and ` +
        `nothing else.\n      That is right for a React Navigation app with no root providers. If ` +
        `this is an expo-router app, point rootLayout at "app/_layout.tsx"; if your screens need ` +
        `providers (a theme, a query client, a store), point it at the file that mounts them.`,
    )
  }


  const ids = new Set()
  for (const screen of out.screens) {
    if (!screen.id) throw new ConfigError('every screen needs an id')
    if (!screen.module) throw new ConfigError(`screen "${screen.id}" has no module`)
    if (ids.has(screen.id)) throw new ConfigError(`duplicate screen id "${screen.id}"`)
    ids.add(screen.id)

    // The trap that costs the most time. A tab screen's header is declared in
    // `(tabs)/_layout.tsx` — a navigator this tool never mounts — so unless the
    // screen asks for one here, it renders at y=0 with the status bar printed
    // over its first row of content, and nothing about that looks like an error.
    if (screen.tab && screen.header === undefined && !screen.title) {
      out.warnings.push(
        `screen "${screen.id}" is a tab screen with no title/header: its header lives in ` +
          `(tabs)/_layout.tsx, which is not mounted here, so it will render under the status ` +
          `bar. Add title: "…" (or header: false if the screen draws its own).`,
      )
    }
  }

  // No slides: shoot every screen with no caption. Useful on the first run, when
  // you want to see what the screens look like before writing any copy.
  if (!out.slides.length) out.slides = out.screens.map((s) => ({ screen: s.id }))

  // A named theme has to exist; a mistyped one would otherwise fall silently back
  // to the default grounds and the whole deck would be off-brand with no warning.
  if (config.frame?.theme && !THEMES[config.frame.theme]) {
    throw new ConfigError(
      `unknown frame.theme "${config.frame.theme}" (have: ${Object.keys(THEMES).join(', ')})`,
    )
  }

  let prevLayout
  for (const slide of out.slides) {
    if (!ids.has(slide.screen)) {
      throw new ConfigError(`slide references unknown screen "${slide.screen}"`)
    }
    // A mistyped layout should fail here with the list, not throw mid-compose
    // after a browser launch.
    if (slide.layout && !LAYOUTS.includes(slide.layout)) {
      throw new ConfigError(
        `slide "${slide.screen}" has unknown layout "${slide.layout}" (have: ${LAYOUTS.join(', ')})`,
      )
    }
    // The back phone of a two-devices slide must be one of the deck's own
    // screens, so its raw exists to compose.
    if (slide.screenSecondary && !ids.has(slide.screenSecondary)) {
      throw new ConfigError(
        `slide "${slide.screen}" has screenSecondary "${slide.screenSecondary}", which is not a declared screen`,
      )
    }
    // `two-devices` needs a second screen; without one it quietly renders a
    // single phone, which is not what the layout was chosen for.
    if (slide.layout === 'two-devices' && !slide.screenSecondary) {
      out.warnings.push(
        `slide "${slide.screen}" uses the two-devices layout but sets no screenSecondary — ` +
          `it will render one phone. Add screenSecondary: "<another screen id>".`,
      )
    }
    // Their rule, and ours: never the same composition twice in a row. Only
    // *explicit* repeats are warned — a deck that never set a layout has not
    // opted into this and should not be nagged; two slides that both chose
    // `hero` have, and reading them side by side is one long slide.
    if (slide.layout && slide.layout === prevLayout) {
      out.warnings.push(
        `slides "${slide.screen}" and the one before it both use layout "${slide.layout}" — ` +
          `adjacent slides should vary (try device-top, device-bottom, hero, no-device) so the deck has rhythm.`,
      )
    }
    prevLayout = slide.layout
  }

  return out
}

/**
 * The store graphics inherit the frames' brand, and that is the entire point of them
 * living in this config rather than in a design file: the listing icon, the feature
 * graphic and the screenshots are the three things a person sees side by side on the
 * store page, and they are the three things most likely to be a slightly different
 * green. Here they cannot be — the ground, the dots and the typeface are read from
 * `frame`, and only what is genuinely particular to a listing is stated again.
 */
function normaliseGraphics(config, at, projectRoot) {
  const g = config.graphics ?? {}
  const frame = config.frame ?? {}
  const ground = frame.grounds?.light ?? {}

  // The icon is a file *in the app*, so it is named the way rootLayout and every screen
  // module are named — from the project root. `outDir` is an output, so it is named from
  // the config, like every other output. Two rules, but they are the two that already
  // exist, and the alternative is an `icon: '../../apps/mobile/assets/icon.png'` in a
  // config that already says where the app is.
  const inApp = (p) => resolve(projectRoot, p)

  return {
    ...g,
    outDir: at(g.outDir ?? 'appstore/graphics'),
    icon: g.icon ? inApp(g.icon) : defaultIcon(inApp),
    // A tile and a mark are not the same picture, and using one where the other belongs
    // is the mistake this option exists to prevent. `icon` is the finished tile — art
    // plus its own ground, square, full-bleed — and it is what the stores want. The
    // feature graphic wants the mark alone, on the feature graphic's ground: paste the
    // tile there instead and you get a hard-edged square of a slightly-wrong white
    // floating in the middle of the brand surface. If the app has no bare mark, the tile
    // is used and rounded, so that at least it reads as an app icon on purpose.
    mark: g.mark ? inApp(g.mark) : defaultMark(inApp),
    targets: g.targets ?? ['play-icon', 'play-feature'],

    background: g.background ?? ground.bg ?? '#F4F3F0',
    // The icon sits on its own ground: an app whose screenshots are shot on a tinted
    // brand surface still, almost always, has a white or near-white icon tile.
    iconBackground: g.iconBackground ?? g.background ?? ground.bg ?? '#FFFFFF',
    dot: g.dot ?? ground.dot ?? '#D8D6CE',
    ink: g.ink ?? ground.ink ?? '#181A17',
    muted: g.muted ?? ground.muted ?? '#676F6D',
    accent: g.accent ?? ground.ink ?? '#181A17',

    fontFamily: g.fontFamily ?? frame.fontFamily,
    headlineWeight: g.headlineWeight ?? frame.headlineWeight,
    dots: g.dots ?? frame.dots,
    promoVideo: g.promoVideo ?? false,
  }
}

/** Where Expo keeps the icon. Guessed, so that the common app needs no config at all. */
function defaultIcon(inApp) {
  return firstThatExists(inApp, ['assets/icon.png', 'assets/images/icon.png', 'src/assets/icon.png'])
}

/**
 * A bare mark, if the app happens to keep one.
 *
 * `adaptive-icon.png` is deliberately not in this list even though it is transparent and
 * every Expo app has one. Android requires two thirds of that image to be a safe zone,
 * so the art inside it is padded to about 66% — drop it into a lockup and the mark comes
 * out noticeably smaller than everything around it, for a reason nobody looking at the
 * result would ever guess. Better to fall back to the tile, which is at least visibly a
 * tile.
 */
function defaultMark(inApp) {
  return firstThatExists(inApp, [
    'assets/logo-mark.png',
    'assets/logo-mark.svg',
    'assets/mark.png',
    'assets/images/logo-mark.png',
  ])
}

function firstThatExists(inApp, candidates) {
  for (const p of candidates) {
    const full = inApp(p)
    if (existsSync(full)) return full
  }
  return null
}

/** The default file name for a slide: `01-home.png`. */
export const slideFile = (slide, i) =>
  slide.file ?? `${String(i + 1).padStart(2, '0')}-${slide.screen}.png`
