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
import { THEMES, resolveGrounds, contrastRatio } from './theme.mjs'
import { DEVICES } from './devices.mjs'

export class ConfigError extends Error {}

/** The decorative element types compose.mjs knows how to draw. */
export const ELEMENT_TYPES = ['chip', 'badge', 'text', 'sparkle', 'squiggle', 'image']

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
    previewDir: at(config.previewDir ?? 'appstore/previews'),
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

  // App-preview videos, if any. Each names a screen (which must exist) and,
  // optionally, a device (which must be one we know) — caught here rather than
  // after a browser launch and an ffmpeg spawn.
  for (const p of out.previews ?? []) {
    if (!p.id) throw new ConfigError('every preview needs an id')
    if (!ids.has(p.screen)) {
      throw new ConfigError(`preview "${p.id}" references unknown screen "${p.screen}"`)
    }
    if (p.device && !DEVICES[p.device]) {
      throw new ConfigError(
        `preview "${p.id}" names unknown device "${p.device}" (have: ${Object.keys(DEVICES).join(', ')})`,
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

  // A/B variants: each is a named packaging of the same screens. The name becomes
  // an output folder, so it has to be present and unique; a mistyped theme fails
  // here, not after N browser launches.
  if (config.variants) {
    const names = new Set()
    for (const v of config.variants) {
      if (!v.name) throw new ConfigError('every variant needs a name')
      // The name is joined onto outDir as a folder, so it must be a single plain
      // path segment — no separators, no `..` — or a variant could write outside
      // the output tree and silently overwrite unrelated files.
      if (!/^[\w.-]+$/.test(v.name) || v.name === '.' || v.name === '..') {
        throw new ConfigError(`variant name "${v.name}" must be a plain folder name (letters, digits, . _ -)`)
      }
      if (names.has(v.name)) throw new ConfigError(`duplicate variant name "${v.name}"`)
      names.add(v.name)
      if (v.frame?.theme && !THEMES[v.frame.theme]) {
        throw new ConfigError(
          `variant "${v.name}" names unknown theme "${v.frame.theme}" (have: ${Object.keys(THEMES).join(', ')})`,
        )
      }
      // A variant's per-slide overrides face the same mid-compose failures a base
      // slide does, so they get the same up-front checks — a mistyped layout or
      // element type fails here, not after the browser is already up.
      for (const s of v.slides ?? []) {
        if (s?.layout && !LAYOUTS.includes(s.layout)) {
          throw new ConfigError(`variant "${v.name}" has unknown layout "${s.layout}" (have: ${LAYOUTS.join(', ')})`)
        }
        for (const el of s?.elements ?? []) {
          if (!ELEMENT_TYPES.includes(el?.type)) {
            throw new ConfigError(
              `variant "${v.name}" has an element of unknown type "${el?.type}" (have: ${ELEMENT_TYPES.join(', ')})`,
            )
          }
        }
      }
      // Overrides past the end of the deck merge onto nothing — a silent no-op
      // that reads like the variant adds slides. Say so.
      if ((v.slides?.length ?? 0) > out.slides.length) {
        out.warnings.push(
          `variant "${v.name}" has ${v.slides.length} slide overrides but the deck has ${out.slides.length} — ` +
            `the extra ${v.slides.length - out.slides.length} are ignored (variants repackage, they don't add slides).`,
        )
      }
    }
  }

  let prevLayout
  for (const [slideIndex, slide] of out.slides.entries()) {
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
    // Decorative elements: a mistyped `type` draws nothing, silently, so it is
    // caught here with the list of the ones that do draw.
    for (const el of slide.elements ?? []) {
      if (!ELEMENT_TYPES.includes(el?.type)) {
        throw new ConfigError(
          `slide "${slide.screen}" has an element of unknown type "${el?.type}" (have: ${ELEMENT_TYPES.join(', ')})`,
        )
      }
      // Elements are centered and clipped by the frame's overflow:hidden, so one
      // placed near an edge is silently truncated with no error. We cannot know a
      // text pill's rendered width, so we estimate a half-extent per type and warn
      // when the box would cross the frame. A warning, not a clamp — moving the
      // element would override author intent; telling them is the tool's job.
      const x = el.x ?? 0.5
      const y = el.y ?? 0.5
      const halfW =
        el.type === 'image' ? (el.w ?? 0.2) / 2 : el.type === 'sparkle' || el.type === 'squiggle' ? (el.size ?? 0.08) / 2 : 0.13
      const halfH = el.type === 'image' ? (el.w ?? 0.2) / 2 : 0.05
      if (x - halfW < 0 || x + halfW > 1 || y - halfH < 0 || y + halfH > 1) {
        out.warnings.push(
          `slide "${slide.screen}" has a ${el.type} element near the frame edge (x:${x}, y:${y}) — ` +
            `it may be clipped. Pull it toward the centre.`,
        )
      }
    }

    // Proof — a rating chip, an "Editors' Choice" badge — is credible on the hero
    // and reads as clutter when it repeats down the deck. Warn if it appears past
    // the first slide, their doctrine and ours: proof on the hero only.
    if (slideIndex > 0 && (slide.elements ?? []).some((el) => el?.type === 'chip' || el?.type === 'badge')) {
      out.warnings.push(
        `slide "${slide.screen}" (slide ${slideIndex + 1}) carries a proof chip/badge — ` +
          `proof reads as credible on the hero and as clutter when repeated. Keep it on the first slide.`,
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

  // Connected canvas: a bridge element crosses the seam between adjacent slides.
  // Three ways to get it wrong, each caught here rather than composed into a deck
  // where the bridge silently does nothing.
  const bridges = config.bridges ?? {}
  for (const [id, b] of Object.entries(bridges)) {
    for (const el of b.elements ?? []) {
      if (!ELEMENT_TYPES.includes(el?.type)) {
        throw new ConfigError(
          `bridge "${id}" has an element of unknown type "${el?.type}" (have: ${ELEMENT_TYPES.join(', ')})`,
        )
      }
    }
  }
  // The runs of consecutive slides that share a bridge id.
  const runs = []
  for (let s = 0; s < out.slides.length; ) {
    const id = out.slides[s].bridge
    if (!id) {
      s++
      continue
    }
    let e = s
    while (e + 1 < out.slides.length && out.slides[e + 1].bridge === id) e++
    runs.push({ id, n: e - s + 1 })
    s = e + 1
  }
  const longestRun = {}
  for (const r of runs) longestRun[r.id] = Math.max(longestRun[r.id] ?? 0, r.n)
  for (const [id, n] of Object.entries(longestRun)) {
    if (n < 2) {
      out.warnings.push(
        `bridge "${id}" is never on two ADJACENT slides — a bridge crosses the seam between neighbours, ` +
          `so the slides sharing it must sit next to each other.`,
      )
    }
  }
  for (const r of runs) {
    if (r.n >= 2 && !bridges[r.id]?.elements?.length) {
      out.warnings.push(
        `bridge "${r.id}" connects ${r.n} slides but config.bridges["${r.id}"] has no elements — nothing crosses the seam.`,
      )
    }
  }

  // The legibility gate — the thumbnail test as a number. A headline reads at a
  // glance only if its ink stands off its ground; below 3:1 it looks fine at full
  // size and disappears in the store's search results. Checked once per ground
  // the deck actually captions on, so a bad theme is flagged, not every slide.
  const grounds = resolveGrounds(config.frame ?? {})
  const captioned = new Set(out.slides.filter((s) => s.headline).map((s) => s.ground ?? 'light'))
  for (const mode of captioned) {
    const g = grounds[mode]
    const ratio = contrastRatio(g.ink, g.bg)
    if (ratio < 3) {
      out.warnings.push(
        `the ${mode} ground's headline (${g.ink} on ${g.bg}) is only ${ratio.toFixed(1)}:1 — under the 3:1 ` +
          `a headline needs to read at thumbnail size. Darken the ink or lighten the ground.`,
      )
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
