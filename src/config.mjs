/**
 * Config normalisation: fill in every default, then refuse the configs that
 * cannot possibly work — a missing root layout, a slide pointing at a screen
 * that was never declared. Failing here costs a second; failing later costs a
 * browser launch and a blank PNG nobody notices until the store rejects it.
 */
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

  if (!out.rootLayout) throw new ConfigError('config.rootLayout is required (e.g. "src/app/_layout.tsx")')
  if (!out.screens?.length) throw new ConfigError('config.screens is empty')

  const ids = new Set()
  for (const screen of out.screens) {
    if (!screen.id) throw new ConfigError('every screen needs an id')
    if (!screen.module) throw new ConfigError(`screen "${screen.id}" has no module`)
    if (ids.has(screen.id)) throw new ConfigError(`duplicate screen id "${screen.id}"`)
    ids.add(screen.id)
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

/** The default file name for a slide: `01-home.png`. */
export const slideFile = (slide, i) =>
  slide.file ?? `${String(i + 1).padStart(2, '0')}-${slide.screen}.png`
