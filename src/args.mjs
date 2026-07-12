/**
 * The flags, parsed away from the CLI's side effects — so they can be tested
 * without running a build.
 */
import { ConfigError } from './config.mjs'

/** `--screen home --screen=chat` → ['home', 'chat']. Absent → []. */
export function flagValues(argv, flag) {
  const out = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag && argv[i + 1]) out.push(argv[++i])
    else if (argv[i].startsWith(`${flag}=`)) out.push(argv[i].slice(flag.length + 1))
  }
  return out
}

/**
 * Narrow the run to what you are actually iterating on.
 *
 * Re-shooting five screens across three device sizes to look at one tile is the
 * slowest thing about using this tool, and nobody adjusts a screen only once.
 */
export function applyFilters(config, argv) {
  const only = flagValues(argv, '--screen')
  const devices = flagValues(argv, '--device')

  // Remembered so the run knows it saw only part of the app — which decides
  // whether "no screen asked for this fixture" means anything.
  config.allScreens = config.screens.length

  if (only.length) {
    const have = config.screens.map((s) => s.id)
    const missing = only.filter((id) => !have.includes(id))
    if (missing.length) {
      throw new ConfigError(`--screen ${missing.join(', ')}: no such screen. Have: ${have.join(', ')}`)
    }
    config.screens = config.screens.filter((s) => only.includes(s.id))
    config.slides = config.slides.filter((s) => only.includes(s.screen))
  }

  if (devices.length) config.devices = devices
  return config
}
