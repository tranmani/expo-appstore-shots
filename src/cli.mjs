#!/usr/bin/env node
/**
 * expo-appstore-shots — App Store screenshots rendered from an Expo app's own code.
 *
 *   npx expo-appstore-shots init          scaffold shots.config.mjs + fixtures
 *   npx expo-appstore-shots init --scan   …and pre-fill them by reading the app
 *   npx expo-appstore-shots               bundle → serve → shoot → frame
 *   npx expo-appstore-shots --raw         stop after shooting (no frames)
 *   npx expo-appstore-shots --screen home --device iphone-6.9
 *                                         shoot a subset, for iterating
 *   npx expo-appstore-shots graphics      the Play icon, feature graphic and
 *                                         marketing icon — the listing art that
 *                                         is not a screenshot
 *
 * Every run ends with what is wrong with the pictures: clipped text, dead space,
 * content under the chrome, fixtures nobody asked for. A clean run is not a
 * correct frame, and this is the only thing in the room that can tell you so.
 */
import { chromium } from 'playwright'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bundle } from './build.mjs'
import { capture } from './capture.mjs'
import { compose } from './compose.mjs'
import { applyFilters } from './args.mjs'
import { ConfigError, normalise } from './config.mjs'
import { resolveDevices } from './devices.mjs'
import { renderGraphics } from './graphics.mjs'
import { suggest } from './icons.mjs'
import { scan } from './scan.mjs'
import { serve } from './server.mjs'
import { iconReport, report, unusedFixtures } from './verify.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()
const args = process.argv.slice(2)

const step = (msg) => console.log(`→ ${msg}`)

function fail(msg) {
  console.error(`\n${msg}\n`)
  process.exit(1)
}

if (args[0] === 'init') await init()
else if (args[0] === 'graphics') await graphics()
else await shoot()

/**
 * The listing artwork that is not a screenshot: the Play icon, the feature graphic, the
 * App Store marketing icon.
 *
 * No bundle and no mock backend — nothing here renders the app, it renders the app's
 * brand — so this is a browser launch and about a second, and it can be re-run every
 * time the tagline changes.
 */
async function graphics() {
  const config = await loadConfig()

  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  )
  try {
    step(`drawing ${config.graphics.targets.length} store graphic(s)`)
    const { written, problems } = await renderGraphics({
      browser,
      config,
      fontCss: await fontCss(config),
    })

    if (written.length) console.log(`\n${written.length} graphic(s) in ${config.graphics.outDir}/`)
    for (const w of written) {
      const [W, H] = w.spec.size
      console.log(`  ${basename(w.file)}  ${W}×${H}  ${(w.bytes / 1024).toFixed(0)} KB  — ${w.spec.label}`)
      if (w.spec.mask) console.log(`      ${w.spec.mask}`)
    }

    if (problems.length) {
      console.log(`\n${problems.length} thing(s) worth looking at before you upload these:`)
      for (const p of problems) console.log(`  ! ${p}`)
    }
    console.log(`\nOpen them. A clean run is not a correct graphic.`)
  } finally {
    await browser.close()
  }
}

async function init() {
  const config = resolve(cwd, 'shots.config.mjs')
  if (existsSync(config)) fail('shots.config.mjs already exists')

  await mkdir(resolve(cwd, 'shots'), { recursive: true })

  const found = args.includes('--scan') ? await scan(cwd) : null

  if (found?.screens?.length) {
    await writeFile(config, draftConfig(found))
    await writeFile(resolve(cwd, 'shots/fixtures.mjs'), draftFixtures(found))

    console.log(`scanned the app and drafted shots.config.mjs + shots/fixtures.mjs

  ${found.screens.length} route(s), ${found.tabBar?.items.length ?? 0} tab(s), ${found.endpoints.length} endpoint(s)

This is a first draft, not an answer. It cannot know which screens sell the app.
Next:
  1. Cut shots.config.mjs down to the 5–6 screens worth showing, in order.
  2. Put real data in shots/fixtures.mjs — the empty stubs will photograph empty.
  3. npx expo-appstore-shots`)
    return
  }

  if (args.includes('--scan')) {
    console.warn('  ! found no expo-router app dir (src/app or app) — writing the blank template\n')
  }

  await copyFile(resolve(here, '../templates/shots.config.mjs'), config)
  await copyFile(resolve(here, '../templates/fixtures.mjs'), resolve(cwd, 'shots/fixtures.mjs'))

  console.log(`created shots.config.mjs and shots/fixtures.mjs

Next:
  1. List your screens in shots.config.mjs (module path + route name).
  2. Seed shots/fixtures.mjs with what your API should answer.
  3. npx expo-appstore-shots`)
}

/** The scan, as a config someone can edit. Comments say what is a guess. */
function draftConfig(found) {
  const screens = found.screens
    .map((s) => `    ${JSON.stringify(s).replace(/","/g, '", "')},`)
    .join('\n')

  const tabs = found.tabBar
    ? `\n  tabBar: {\n    items: [\n${found.tabBar.items
        .map((t) => `      { id: ${JSON.stringify(t.id)}, label: ${JSON.stringify(t.label)}, icon: 'Circle' },`)
        .join('\n')}\n    ],\n  },\n`
    : ''

  return `/**
 * Drafted by \`expo-appstore-shots init --scan\`. Every screen the router has is
 * listed below — which is not what you want. Keep the five or six that sell the
 * app, in the order a reviewer should meet them, and delete the rest.
 *
 * The icons are placeholders: they are lucide names, and a wrong one is reported
 * on the next run with a near match.
 */
export default {
  rootLayout: ${JSON.stringify(found.rootLayout)},
${tabs}
  screens: [
${screens}
  ],

  // A caption per slide. Omit and the frames are shot bare.
  slides: [],
}
`
}

/** One stub per endpoint the app was seen to call. Empty on purpose. */
function draftFixtures(found) {
  const routes = found.endpoints
    .map((e) => `    ${JSON.stringify(`GET ${e}`)}: {},`)
    .join('\n')

  return `/**
 * Drafted by \`expo-appstore-shots init --scan\` from the API paths in your
 * source. Each one answers \`{}\` — which will photograph as an empty screen.
 * Put real data in the ones a screen actually reads.
 *
 * Anything the app calls that is missing here is printed after every run.
 */
export default {
  routes: {
${routes}
  },

  fallback: {},
}
`
}

async function loadConfig() {
  const configPath = resolve(cwd, args.find((a) => a.endsWith('.mjs')) ?? 'shots.config.mjs')
  if (!existsSync(configPath)) fail('no shots.config.mjs here — run `npx expo-appstore-shots init` first')
  try {
    return normalise((await import(pathToFileURL(configPath).href)).default, configPath)
  } catch (e) {
    if (e instanceof ConfigError) fail(e.message)
    throw e
  }
}

async function shoot() {
  let config = await loadConfig()
  let chosen
  let rendered
  try {
    config = applyFilters(config, args)
    ;({ chosen, rendered } = resolveDevices(config.devices))
  } catch (e) {
    if (e instanceof ConfigError) fail(e.message)
    throw e
  }

  for (const w of config.warnings ?? []) console.warn(`  ! ${w}`)

  const fixtures = await import(pathToFileURL(config.api.fixtures).href)

  step('bundling the app for the browser')
  await bundle(config)

  step(`serving the mock backend on :${config.apiPort}`)
  const server = await serve({
    port: config.apiPort,
    dist: config.workDir,
    fixtures: fixtures.default ?? fixtures,
  })

  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  )

  try {
    // 6.9" and 6.5" share a viewport and differ only in output size, so the
    // number of things photographed and the number of folders written are not
    // the same number. Saying "2 devices" and then writing three folders reads
    // like a bug.
    step(
      `shooting ${config.screens.length} screen(s) × ${rendered.length} viewport(s) ` +
        `→ ${chosen.length} device size(s)`,
    )
    const { problems, findings } = await capture({
      browser,
      config,
      devices: rendered,
      port: config.apiPort,
      rawDir: resolve(config.workDir, 'raw'),
    })

    // A thrown error and a bad-looking frame are different problems: one means
    // the screen did not render, the other means it rendered wrong. Marked
    // differently so neither hides in the other's noise.
    for (const p of problems) console.warn(`  ✗ ${p}`)

    // A SCREEN THAT THREW MUST NOT BECOME A FILE.
    //
    // This is the failure that matters most in a tool whose output goes straight onto a storefront.
    // A React version mismatch made every screen throw; the run printed twenty-four ✗ lines, went on
    // to compose twenty-four store frames out of blank white rectangles, wrote them over the good
    // ones, and exited 0. Everything about that run said "success" except the pictures, and nobody
    // reads pictures they have just been told are finished.
    //
    // A screenshot tool has exactly one duty: never hand back a frame that is not a screenshot.
    // Composing is skipped, the existing frames on disk are left alone, and the exit code says no.
    if (problems.length > 0) {
      console.error(
        `\n${problems.length} screen(s) did not render.\n\n` +
          `No frames were written — the ones already in ${config.outDir}/ are untouched.\n` +
          `A blank frame that ships is worse than a run that fails, so this fails.\n`,
      )
      await browser.close()
      process.exit(1)
    }

    if (!args.includes('--raw')) {
      step('composing store frames')
      const written = await compose({
        browser,
        config,
        devices: chosen,
        fontCss: await fontCss(config),
        rawDir: resolve(config.workDir, 'raw'),
        outDir: config.outDir,
      })

      console.log(`\n${written.length} frames in ${config.outDir}/`)
      for (const f of written) console.log(`  ${f}`)
    } else {
      console.log(`\nraw screens in ${resolve(config.workDir, 'raw')}`)
    }

    reportFidelity(findings)
    // A filtered run only visits some screens, so "nobody asked for this
    // fixture" would be true of every fixture the other screens read — and the
    // report would be accusing correct fixtures of being typos.
    reportFixtures(server, { partial: config.screens.length !== config.allScreens })
  } finally {
    await browser.close()
    server.close()
  }
}

/**
 * What is wrong with the pictures.
 *
 * This is the report that matters, and it is printed last because it is the one
 * to act on: everything above it says the run succeeded, and a run can succeed
 * and still hand you a frame with the headline number cut in half.
 */
function reportFidelity(findings) {
  const lines = [...iconReport(findings, suggest), ...report(findings)]
  if (!lines.length) return

  console.log(`\n${lines.length} thing(s) worth looking at before you ship these:`)
  for (const l of lines) console.log(`  ! ${l}`)
  console.log(`\nOpen the frames and check. A clean run is not a correct frame.`)
}

/**
 * The fixtures, from both ends.
 *
 * A route with no fixture is an empty state in a screenshot. A fixture no route
 * asked for is usually a *typo'd path* — which fails the same way, as an empty
 * screen, but with nothing at all to explain it. Reporting only the first half
 * means a mistyped fixture is invisible; reporting both makes it obvious.
 */
function reportFixtures(server, { partial } = {}) {
  const unseeded = [...(server.unseeded ?? new Map())]
  if (unseeded.length) {
    console.log(`\n${unseeded.length} API route(s) had no fixture and got the fallback:`)
    for (const [route, count] of unseeded.sort((a, b) => b[1] - a[1])) {
      console.log(`  ${route}${count > 1 ? `  (×${count})` : ''}`)
    }
    console.log(`\nSeed the ones a screen actually reads, in shots/fixtures.mjs.`)
  }

  // Only meaningful when every screen ran: on a --screen run the fixtures the
  // other screens read are untouched by definition, and calling them typos
  // would be wrong every single time.
  if (partial) return

  const unused = unusedFixtures(server.routes ?? [], server.hits ?? new Set())
  if (unused.length) {
    console.log(`\n${unused.length} fixture(s) were never requested:`)
    for (const key of unused) console.log(`  ${key}`)
    console.log(`\nIf a screen looks empty, one of these is probably a typo.`)
  }
}

async function fontCss(config) {
  const path = config.frame?.fontFile
    ? resolve(config.projectRoot, config.frame.fontFile)
    : createRequire(import.meta.url).resolve('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')

  const data = await readFile(path)
  const format = path.endsWith('.woff2') ? 'woff2' : path.endsWith('.woff') ? 'woff' : 'truetype'
  return `  @font-face {
    font-family: '${config.frame?.fontFamily ?? 'Inter'}';
    font-weight: 100 900;
    font-display: block;
    src: url(data:font/${format};base64,${data.toString('base64')}) format('${format}');
  }`
}
