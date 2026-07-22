/**
 * Phase 0: the layout engine, themes, and mixed-emphasis headlines.
 *
 * These are pure functions — no browser — so they run everywhere and are the
 * ones that will actually be run when someone touches a layout or a theme. The
 * e2e test proves a real render still works; these prove the composition logic.
 *
 * The load-bearing test is the FIRST one: the default path must stay
 * byte-identical, or every existing deck silently shifts.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { frameHtml } from '../src/compose.mjs'
import { layoutPlan, LAYOUTS } from '../src/layouts.mjs'
import { resolveGrounds, renderHeadline, THEMES, DEFAULT_GROUNDS } from '../src/theme.mjs'
import { normalise, ConfigError } from '../src/config.mjs'

const DEVICE = { size: [1290, 2796], width: 430, height: 932, scale: 3, insets: { top: 62, bottom: 34 }, kind: 'phone' }
const raw = Buffer.from('x')
const html = (slide, frame = {}) => frameHtml({ slide, device: DEVICE, raw, frame, fontCss: '' })
const GOLDEN = resolve(dirname(fileURLToPath(import.meta.url)), 'golden/standard.html')

test('the default layout is BYTE-identical — frozen against a golden', () => {
  // This is the load-bearing test, and it is a real one: the golden was captured
  // from the pre-engine `frameHtml` (verified byte-for-byte across phone/tablet
  // and light/dark before it was frozen). A whitespace change, a stray CSS rule,
  // a moved anchor — anything at all in the default `standard` output — fails
  // here, which is what a claim of "byte-identical" has to mean. The earlier
  // version of this test asserted a few substrings and a stray line slipped past
  // it; a golden cannot be fooled that way.
  const goldenRaw = Buffer.from('GOLDEN-RAW-PLACEHOLDER')
  const slide = {
    screen: 'home',
    headline: 'Every station has a room.',
    sub: 'Departures, delays, and the people standing right next to you.',
    ground: 'dark',
  }
  const frame = {
    grounds: {
      light: { bg: '#F4F3F0', dot: '#D8D6CE', ink: '#181A17', muted: '#676F6D' },
      dark: { bg: '#17513F', dot: '#23614D', ink: '#F5F3EE', muted: '#9FC2B3' },
    },
    bezel: '#111517',
    statusBar: { time: '9:41', tint: '#181A17' },
  }
  const out = frameHtml({ slide, device: DEVICE, raw: goldenRaw, frame, fontCss: '  @font-face { font-family: Golden; }' })
  assert.equal(out, readFileSync(GOLDEN, 'utf8'), 'the default composition drifted from its golden')
})

test('a plain headline emits no emphasis span; the standard plan is unmoved', () => {
  const plan = layoutPlan('standard', DEVICE)
  assert.equal(plan.captionAnchor, 'top')
  assert.equal(plan.deviceShown, true)
  const out = html({ screen: 'home', headline: 'Plain headline', sub: 'A line.', ground: 'light' })
  assert.match(out, /class="device"/)
  assert.ok(!out.includes('class="em"'), 'a plain headline must not emit an emphasis span')
})

test('layoutPlan covers every declared layout, and rejects the unknown', () => {
  for (const name of LAYOUTS) assert.ok(layoutPlan(name, DEVICE), `${name} has no plan`)
  assert.throws(() => layoutPlan('nope', DEVICE), /unknown layout/)
})

test('no-device drops the device; device-top moves the caption to the bottom', () => {
  const noDevice = html({ screen: 'home', headline: 'Just words', layout: 'no-device' })
  assert.ok(!noDevice.includes('class="device"'), 'no-device still drew a device')
  assert.match(noDevice, /text-align: center/)

  const deviceTop = html({ screen: 'home', headline: 'Up top', layout: 'device-top' })
  assert.match(deviceTop, /class="device"/)
  assert.match(deviceTop, /bottom: \d+px;/, 'device-top must anchor the caption to the bottom')
  assert.ok(!/\.caption \{[^}]*top: \d+px;/.test(deviceTop), 'device-top must not also pin the caption to the top')
})

test('a bottom-anchored caption with no captionBottom never emits undefinedpx', () => {
  // Only reachable via a frame.layout override that sets the anchor without the
  // value — an adversarial-review find. It must fall to a real default, not
  // `bottom: undefinedpx`, which the browser would drop and silently mis-place.
  const out = html(
    { screen: 'home', headline: 'x' },
    { layout: { phone: { captionAnchor: 'bottom' } } },
  )
  assert.ok(!out.includes('undefinedpx'), 'a bottom anchor with no value emitted undefinedpx')
  assert.match(out, /bottom: \d+px;/)
})

test('a named theme paints the ground; a grounds override still wins on top', () => {
  const themed = html({ screen: 'home', headline: 'x', ground: 'dark' }, { theme: 'dark-bold' })
  assert.match(themed, new RegExp(`background: ${THEMES['dark-bold'].dark.bg}`))

  const overridden = resolveGrounds({ theme: 'dark-bold', grounds: { dark: { bg: '#010203' } } })
  assert.equal(overridden.dark.bg, '#010203', 'frame.grounds must override the theme')
  assert.equal(overridden.dark.ink, THEMES['dark-bold'].dark.ink, 'unoverridden tokens keep the theme value')
})

test('no theme resolves to the original grounds (plus an accent), unchanged', () => {
  const g = resolveGrounds({})
  assert.equal(g.light.bg, DEFAULT_GROUNDS.light.bg)
  assert.equal(g.dark.bg, DEFAULT_GROUNDS.dark.bg)
  assert.equal(g.light.accent, g.light.ink, 'with no accent set, emphasis falls back to ink (a no-op)')
})

test('mixed-emphasis paints the starred word in the accent — and only when asked', () => {
  assert.equal(renderHeadline('no stars here', '#ff0000'), 'no stars here')
  const em = renderHeadline('A home for *every* coffee.', '#ff0000')
  assert.match(em, /<span class="em" style="color:#ff0000;font-style:italic">every<\/span>/)
  // Escaped first, so a user cannot inject markup through the headline.
  assert.match(renderHeadline('<script> & "x"', '#000'), /&lt;script&gt; &amp; &quot;x&quot;/)

  // End to end: the accent comes from the ground, so the same headline pops in
  // the theme's accent without the slide naming a colour.
  const out = html({ screen: 'home', headline: 'A *bold* claim', ground: 'light' }, { theme: 'ocean-fresh' })
  assert.match(out, new RegExp(`color:${THEMES['ocean-fresh'].light.accent}`))
})

test('every theme accent is legible on its own ground (WCAG large-text 3:1)', () => {
  // Emphasis paints a word in the accent, so an accent that doesn't read on its
  // ground is a headline you can't read — which the adversarial review caught on
  // warm-editorial light (2.66:1). Headlines are large text, so 3:1 is the AA
  // bar; this keeps every accent above it, in both modes.
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const ratio = (a, b) => {
    const [x, y] = [lum(a) + 0.05, lum(b) + 0.05]
    return Math.max(x, y) / Math.min(x, y)
  }
  for (const [name, t] of Object.entries(THEMES)) {
    for (const mode of ['light', 'dark']) {
      const r = ratio(t[mode].accent, t[mode].bg)
      assert.ok(r >= 3, `${name} ${mode}: accent ${t[mode].accent} on ${t[mode].bg} is ${r.toFixed(2)}:1 (< 3)`)
    }
  }
})

/* ------------------------------------------------------------- config gate --- */

const CONFIG = '/app/shots.config.mjs'
const baseConfig = {
  rootLayout: 'src/app/_layout.tsx',
  screens: [{ id: 'a', module: 'a.tsx' }, { id: 'b', module: 'b.tsx' }],
}

test('an unknown theme or layout fails at config time, with the list', () => {
  assert.throws(() => normalise({ ...baseConfig, frame: { theme: 'nope' } }, CONFIG), ConfigError)
  assert.throws(
    () => normalise({ ...baseConfig, slides: [{ screen: 'a', layout: 'nope' }] }, CONFIG),
    /unknown layout/,
  )
})

test('adjacent EXPLICIT layout repeats warn; a legacy all-default deck does not', () => {
  // The nag must not fire on decks that never opted in — every existing deck is
  // all-`standard` and must stay silent.
  const legacy = normalise(
    { ...baseConfig, slides: [{ screen: 'a' }, { screen: 'b' }, { screen: 'a' }] },
    CONFIG,
  )
  assert.deepEqual(
    legacy.warnings.filter((w) => /vary/.test(w)),
    [],
    'an all-default deck was nagged about layout variety',
  )

  const repeated = normalise(
    { ...baseConfig, slides: [{ screen: 'a', layout: 'hero' }, { screen: 'b', layout: 'hero' }] },
    CONFIG,
  )
  assert.equal(repeated.warnings.filter((w) => /both use layout "hero"/.test(w)).length, 1)
})
