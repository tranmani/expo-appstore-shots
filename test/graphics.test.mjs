/**
 * The store graphics, and the four ways they get rejected.
 *
 * Two of these the store tells you about (wrong size, too many bytes) and two it does
 * not: an alpha channel that App Store Connect refuses without saying which asset, and a
 * lockup that survives 1024×500 and gets cut in half in every placement Play crops it
 * to. The last one is the reason `inspect` measures the laid-out boxes rather than
 * trusting the layout — so it is tested against a real browser, with real text, at a
 * real size.
 *
 * Needs Chromium (`npx playwright install chromium`); the rendering tests skip without
 * it, the pure ones do not.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'

import { TARGETS, renderGraphics } from '../src/graphics.mjs'
import { normalise } from '../src/config.mjs'

const CONFIG_PATH = '/app/shots.config.mjs'
const base = {
  rootLayout: 'src/app/_layout.tsx',
  screens: [{ id: 'home', module: 'src/app/index.tsx' }],
}

const haveChromium = (() => {
  try {
    return existsSync(chromium.executablePath())
  } catch {
    return Boolean(process.env.CHROME_PATH)
  }
})()

// ── the specs the stores publish ───────────────────────────────────────────────

test('graphics: the target sizes are the ones the stores actually require', () => {
  assert.deepEqual(TARGETS['play-icon'].size, [512, 512])
  assert.deepEqual(TARGETS['play-feature'].size, [1024, 500])
  assert.deepEqual(TARGETS['ios-marketing'].size, [1024, 1024])
  // Play's icon ceiling is 1 MB and it is genuinely reachable at 512×512.
  assert.equal(TARGETS['play-icon'].maxBytes, 1024 * 1024)
})

// ── config ────────────────────────────────────────────────────────────────────

test('graphics: the brand comes from the frames, so the listing cannot drift', () => {
  const c = normalise(
    {
      ...base,
      frame: {
        grounds: { light: { bg: '#F4F3F0', dot: '#D8D6CE', ink: '#181A17', muted: '#676F6D' } },
        fontFamily: 'Satoshi',
      },
    },
    CONFIG_PATH,
  )
  assert.equal(c.graphics.background, '#F4F3F0')
  assert.equal(c.graphics.dot, '#D8D6CE')
  assert.equal(c.graphics.ink, '#181A17')
  assert.equal(c.graphics.muted, '#676F6D')
  // The whole reason this is not a separate design file: one typeface, one green.
  assert.equal(c.graphics.fontFamily, 'Satoshi')
})

test('graphics: what the listing states for itself wins over what it inherits', () => {
  const c = normalise(
    {
      ...base,
      frame: { grounds: { light: { bg: '#F4F3F0' } } },
      graphics: { background: '#000000', accent: '#1C6B4F' },
    },
    CONFIG_PATH,
  )
  assert.equal(c.graphics.background, '#000000')
  assert.equal(c.graphics.accent, '#1C6B4F')
})

test('graphics: the icon is named from the app, the output from the config', () => {
  // rootLayout and every screen module are project-root-relative; outDir and workDir are
  // config-relative. The icon is a file in the app, so it follows the app's rule — get
  // this backwards and an `icon: 'assets/icon.png'` silently resolves to nothing.
  const c = normalise(
    { ...base, projectRoot: 'apps/mobile', graphics: { icon: 'assets/icon.png', outDir: 'art' } },
    CONFIG_PATH,
  )
  assert.equal(c.graphics.icon, '/app/apps/mobile/assets/icon.png')
  assert.equal(c.graphics.outDir, '/app/art')
})

test('graphics: an app with no icon anywhere does not crash the config', () => {
  const c = normalise(base, CONFIG_PATH)
  assert.equal(c.graphics.icon, null)
  assert.equal(c.graphics.mark, null)
  assert.deepEqual(c.graphics.targets, ['play-icon', 'play-feature'])
})

// ── rendering ─────────────────────────────────────────────────────────────────

/** A 512×512 tile: opaque, with a smaller shape on it. Stands in for icon.png. */
function tilePng() {
  const png = new PNG({ width: 512, height: 512 })
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (512 * y + x) << 2
      const inner = x > 120 && x < 392 && y > 120 && y < 392
      png.data[i] = inner ? 28 : 253
      png.data[i + 1] = inner ? 107 : 251
      png.data[i + 2] = inner ? 79 : 248
      png.data[i + 3] = 255
    }
  }
  return PNG.sync.write(png)
}

/** The bare mark: transparent ground, shape only. Stands in for logo-mark.png. */
function markPng() {
  const png = new PNG({ width: 512, height: 512 })
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (512 * y + x) << 2
      const inner = x > 60 && x < 452 && y > 60 && y < 452
      png.data[i] = 28
      png.data[i + 1] = 107
      png.data[i + 2] = 79
      png.data[i + 3] = inner ? 255 : 0
    }
  }
  return PNG.sync.write(png)
}

async function render(graphics, { icon = true, mark = false } = {}) {
  const dir = await mkdtemp(resolve(tmpdir(), 'shots-graphics-'))
  const { writeFile } = await import('node:fs/promises')
  if (icon) await writeFile(resolve(dir, 'icon.png'), tilePng())
  if (mark) await writeFile(resolve(dir, 'logo-mark.png'), markPng())

  const config = normalise(
    {
      ...base,
      projectRoot: dir,
      graphics: {
        icon: icon ? 'icon.png' : undefined,
        mark: mark ? 'logo-mark.png' : undefined,
        outDir: 'out',
        ...graphics,
      },
    },
    resolve(dir, 'shots.config.mjs'),
  )

  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  )
  try {
    const res = await renderGraphics({ browser, config, fontCss: '' })
    return { ...res, dir, config }
  } finally {
    await browser.close()
  }
}

test(
  'graphics: every asset comes out at the exact size, opaque, under the ceiling',
  { skip: !haveChromium && 'no chromium', timeout: 120_000 },
  async () => {
    const { written, problems, dir } = await render(
      {
        targets: ['play-icon', 'play-feature', 'ios-marketing'],
        wordmark: 'Perron',
        tagline: 'Chat with the platform you are standing on.',
      },
      { mark: true },
    )

    assert.equal(written.length, 3)
    assert.deepEqual(problems, [], 'a well-formed listing should have nothing to report')

    for (const w of written) {
      const png = PNG.sync.read(await readFile(w.file))
      assert.deepEqual([png.width, png.height], w.spec.size, `${w.id} is the wrong size`)
      // App Store Connect refuses an alpha channel and will not say which asset it was.
      assert.equal(png.data.length, png.width * png.height * 4)
      for (let i = 3; i < png.data.length; i += 4) {
        if (png.data[i] !== 255) assert.fail(`${w.id} has transparent pixels`)
      }
      assert.ok(w.bytes < w.spec.maxBytes, `${w.id} is over the store's byte ceiling`)
    }

    await rm(dir, { recursive: true, force: true })
  },
)

test(
  'graphics: a long app name runs into the crop, and is caught',
  { skip: !haveChromium && 'no chromium', timeout: 120_000 },
  async () => {
    // The failure the store never reports: this uploads fine, looks fine at 1024×500,
    // and loses its ends in every placement Play crops it to. The tagline cannot cause
    // it — that has a max-width and simply wraps — but the wordmark has none, because a
    // wrapped wordmark is not a wordmark. So the name is the thing that runs off, and
    // only the laid-out box knows: the config looks entirely reasonable.
    const { problems, dir } = await render(
      {
        targets: ['play-feature'],
        wordmark: 'Perron — Station Platform Chat',
        tagline: 'Chat with the platform you are standing on.',
      },
      { mark: true },
    )

    assert.ok(
      problems.some((p) => p.includes('within 6% of an edge')),
      `expected an edge-safety warning, got: ${JSON.stringify(problems)}`,
    )
    await rm(dir, { recursive: true, force: true })
  },
)

test(
  'graphics: with a promo video, the lockup clears the play button',
  { skip: !haveChromium && 'no chromium', timeout: 120_000 },
  async () => {
    // Centring the lockup is the obvious thing to do and it is exactly wrong here: Play
    // stamps a play button through the middle and lands it on the wordmark. Nudging the
    // horizontal lockup leftwards does NOT fix that — at ~70% of the canvas wide, it has
    // no middle it can avoid — which is why the promo layout stacks instead. This test
    // is what proved the nudge was theatre.
    const { problems, dir } = await render(
      {
        targets: ['play-feature'],
        wordmark: 'Perron',
        tagline: 'Chat with the platform you are standing on.',
        promoVideo: true,
      },
      { mark: true },
    )

    assert.ok(
      !problems.some((p) => p.includes('play button')),
      `the lockup should clear the play button, got: ${JSON.stringify(problems)}`,
    )
    await rm(dir, { recursive: true, force: true })
  },
)

test(
  'graphics: with no bare mark, the tile is used — and it says so',
  { skip: !haveChromium && 'no chromium', timeout: 120_000 },
  async () => {
    // Not a failure: plenty of apps only ever have icon.png. But pasting a tile into the
    // lockup is a visible compromise, and a silent compromise is how a listing ends up
    // with a white square floating on the brand ground.
    const { problems, written, dir } = await render({
      targets: ['play-feature'],
      wordmark: 'Perron',
      tagline: 'Chat with the platform you are standing on.',
    })

    assert.equal(written.length, 1)
    assert.ok(
      problems.some((p) => p.includes('no graphics.mark')),
      `expected the tile fallback to be reported, got: ${JSON.stringify(problems)}`,
    )
    await rm(dir, { recursive: true, force: true })
  },
)

test(
  'graphics: an icon target with no icon is skipped, loudly, not written blank',
  { skip: !haveChromium && 'no chromium', timeout: 120_000 },
  async () => {
    const { written, problems, dir } = await render(
      { targets: ['play-icon'], wordmark: 'Perron' },
      { icon: false },
    )
    assert.equal(written.length, 0, 'a blank 512×512 tile is worse than no file at all')
    assert.ok(problems.some((p) => p.includes('needs graphics.icon')))
    await rm(dir, { recursive: true, force: true })
  },
)
