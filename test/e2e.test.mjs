/**
 * The whole pipeline, end to end, against a fixture app that has no
 * node_modules of its own: bundle → serve → shoot → frame.
 *
 * The fixture screen asks for a location permission, reads AsyncStorage and
 * fetches from the API, so a frame that comes out non-blank and correctly sized
 * proves the stubs, the mock backend and the compositor all work together.
 *
 * Needs Chromium (`npx playwright install chromium`); skipped without it.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const app = resolve(here, 'fixture-app')
const cli = resolve(here, '../src/cli.mjs')
const out = resolve(app, 'out/6.9/01-home.png')

const haveChromium = (() => {
  try {
    return existsSync(chromium.executablePath())
  } catch {
    return Boolean(process.env.CHROME_PATH)
  }
})()

let stdout = ''

before(async () => {
  if (!haveChromium) return
  await rm(resolve(app, 'out'), { recursive: true, force: true })
  await rm(resolve(app, '.shots'), { recursive: true, force: true })
  const res = await run(process.execPath, [cli, 'shots.config.mjs'], { cwd: app, timeout: 300_000 })
  stdout = res.stdout
}, { timeout: 300_000 })

after(async () => {
  await rm(resolve(app, '.shots'), { recursive: true, force: true })
})

test('the app renders with no runtime errors', { skip: skip() }, () => {
  // capture.mjs prints "! device/screen: …" for anything the page threw.
  assert.ok(!stdout.includes('!'), `page errors:\n${stdout}`)
  assert.match(stdout, /1 frames in out\//)
})

test('the frame is exactly the size App Store Connect asks for', { skip: skip() }, async () => {
  const png = PNG.sync.read(await readFile(out))
  assert.equal(png.width, 1290)
  assert.equal(png.height, 2796)
})

test('the frame carries no alpha channel', { skip: skip() }, async () => {
  // colorType 2 = truecolour, no alpha. Apple rejects 6 (truecolour + alpha).
  const buf = await readFile(out)
  assert.equal(buf.readUInt8(25), 2, 'PNG colour type in the IHDR chunk')
})

test('the frame is the app, not an empty canvas', { skip: skip() }, async () => {
  const png = PNG.sync.read(await readFile(out))
  const colours = new Set()
  for (let i = 0; i < png.data.length; i += 4) {
    colours.add((png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2])
  }
  // A blank ground would be a handful of colours; a rendered screen with type,
  // a bezel and a shadow is thousands.
  assert.ok(colours.size > 500, `only ${colours.size} distinct colours — the screen looks blank`)

  // The caption's ground is the configured dark green.
  const [r, g, b] = [png.data[0], png.data[1], png.data[2]]
  assert.deepEqual([r, g, b], [23, 81, 63])
})

function skip() {
  return haveChromium ? false : 'no Chromium — run: npx playwright install chromium'
}
