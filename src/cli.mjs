#!/usr/bin/env node
/**
 * expo-appstore-shots — App Store screenshots rendered from an Expo app's own code.
 *
 *   npx expo-appstore-shots init     scaffold shots.config.mjs + fixtures
 *   npx expo-appstore-shots          bundle → serve → shoot → frame
 *   npx expo-appstore-shots --raw    stop after shooting (no frames)
 */
import { chromium } from 'playwright'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bundle } from './build.mjs'
import { capture } from './capture.mjs'
import { compose } from './compose.mjs'
import { ConfigError, normalise } from './config.mjs'
import { resolveDevices } from './devices.mjs'
import { serve } from './server.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()
const args = process.argv.slice(2)

const step = (msg) => console.log(`→ ${msg}`)

function fail(msg) {
  console.error(`\n${msg}\n`)
  process.exit(1)
}

if (args[0] === 'init') await init()
else await shoot()

async function init() {
  const config = resolve(cwd, 'shots.config.mjs')
  if (existsSync(config)) fail('shots.config.mjs already exists')

  await copyFile(resolve(here, '../templates/shots.config.mjs'), config)
  await mkdir(resolve(cwd, 'shots'), { recursive: true })
  await copyFile(resolve(here, '../templates/fixtures.mjs'), resolve(cwd, 'shots/fixtures.mjs'))

  console.log(`created shots.config.mjs and shots/fixtures.mjs

Next:
  1. List your screens in shots.config.mjs (module path + route name).
  2. Seed shots/fixtures.mjs with what your API should answer.
  3. npx expo-appstore-shots`)
}

async function shoot() {
  const configPath = resolve(cwd, args.find((a) => a.endsWith('.mjs')) ?? 'shots.config.mjs')
  if (!existsSync(configPath)) fail('no shots.config.mjs here — run `npx expo-appstore-shots init` first')

  let config
  try {
    config = normalise((await import(pathToFileURL(configPath).href)).default, configPath)
  } catch (e) {
    if (e instanceof ConfigError) fail(e.message)
    throw e
  }
  const { chosen, rendered } = resolveDevices(config.devices)

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
    step(`shooting ${config.screens.length} screens × ${rendered.length} device(s)`)
    const problems = await capture({
      browser,
      config,
      devices: rendered,
      port: config.apiPort,
      rawDir: resolve(config.workDir, 'raw'),
    })

    for (const p of problems) console.warn(`  ! ${p}`)

    if (args.includes('--raw')) {
      console.log(`\nraw screens in ${resolve(config.workDir, 'raw')}`)
      reportUnseeded(server)
      return
    }

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
    reportUnseeded(server)
  } finally {
    await browser.close()
    server.close()
  }
}

/**
 * The API calls no fixture answered. An empty state in a screenshot is usually
 * one of these, so they are printed rather than swallowed.
 */
function reportUnseeded(server) {
  const unseeded = [...(server.unseeded ?? new Map())]
  if (!unseeded.length) return

  console.log(`\n${unseeded.length} API route(s) had no fixture and got the fallback:`)
  for (const [route, count] of unseeded.sort((a, b) => b[1] - a[1])) {
    console.log(`  ${route}${count > 1 ? `  (×${count})` : ''}`)
  }
  console.log(`\nSeed the ones a screen actually reads, in shots/fixtures.mjs.`)
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
