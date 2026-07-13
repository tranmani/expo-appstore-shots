/**
 * Config normalisation: fill in every default, then refuse the configs that
 * cannot possibly work — a missing root layout, a slide pointing at a screen
 * that was never declared. Failing here costs a second; failing later costs a
 * browser launch and a blank PNG nobody notices until the store rejects it.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export class ConfigError extends Error {}

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
    devices: config.devices ?? ['iphone-6.9', 'iphone-6.5'],
    api: { fixtures: at(config.api?.fixtures ?? 'shots/fixtures.mjs') },
    slides: config.slides ?? [],
  }

  out.graphics = normaliseGraphics(config, at, out.projectRoot)

  if (!out.rootLayout) throw new ConfigError('config.rootLayout is required (e.g. "src/app/_layout.tsx")')
  if (!out.screens?.length) throw new ConfigError('config.screens is empty')

  out.warnings = []

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

  for (const slide of out.slides) {
    if (!ids.has(slide.screen)) {
      throw new ConfigError(`slide references unknown screen "${slide.screen}"`)
    }
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
