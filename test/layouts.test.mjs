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
import { frameHtml, elementsHtml, bridgeContexts, applyVariant } from '../src/compose.mjs'
import { layoutPlan, LAYOUTS, isTablet, isAndroid } from '../src/layouts.mjs'
import { resolveGrounds, renderHeadline, contrastRatio, THEMES, DEFAULT_GROUNDS } from '../src/theme.mjs'
import { normalise, ConfigError } from '../src/config.mjs'
import { DEVICES } from '../src/devices.mjs'

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

test('two-devices layers a back + front phone, and needs a second screenshot', () => {
  const plan = layoutPlan('two-devices', DEVICE)
  assert.ok(plan.secondary, 'two-devices must define a secondary placement')
  assert.ok(plan.secondary.width < plan.deviceWidth, 'the back phone should be smaller')

  const rawBack = Buffer.from('BACK')
  const rawFront = Buffer.from('FRONT')
  const out = frameHtml({
    slide: { screen: 'front', screenSecondary: 'back', headline: 'Two', layout: 'two-devices' },
    device: DEVICE,
    raw: rawFront,
    rawSecondary: rawBack,
    frame: {},
    fontCss: '',
  })
  // Two phones, both present, and NOT the single centred `.device` block.
  assert.match(out, new RegExp(rawBack.toString('base64')))
  assert.match(out, new RegExp(rawFront.toString('base64')))
  assert.ok(!out.includes('class="device"'), 'two-devices must not use the single-device block')
  assert.match(out, /z-index:1;/) // back
  assert.match(out, /z-index:2;/) // front
  // The back phone is drawn FIRST (earlier in the DOM and lower z), so the front
  // paints over it. If this order flips, the wrong screen is on top.
  assert.ok(
    out.indexOf(rawBack.toString('base64')) < out.indexOf(rawFront.toString('base64')),
    'the back phone must be composed before the front',
  )

  // Missing the second screenshot: falls back to a single phone rather than nothing.
  const fallback = frameHtml({
    slide: { screen: 'front', headline: 'Two', layout: 'two-devices' },
    device: DEVICE,
    raw: rawFront,
    rawSecondary: null,
    frame: {},
    fontCss: '',
  })
  assert.match(fallback, /class="device"/, 'a two-devices slide with no secondary should still show one phone')
})

test('android is a Play-safe size, rendered natively, with a gesture pill', () => {
  // 1080×2160 is exactly 2:1 — the tallest Play accepts. And no renderWith: the
  // app lays out for an Android-shaped viewport, not an iPhone one stretched.
  assert.deepEqual(DEVICES['android-phone'].size, [1080, 2160])
  assert.equal(DEVICES['android-phone'].renderWith, undefined, 'android must render at its own viewport')
  assert.ok(2160 / 1080 <= 2, 'aspect ratio must not exceed Play’s 2:1 limit')

  const android = { size: [1080, 2160], width: 360, height: 720, scale: 3, insets: { top: 28, bottom: 24 }, kind: 'android-phone' }
  const out = frameHtml({ slide: { screen: 'x', headline: 'A' }, device: android, raw, frame: {}, fontCss: '' })
  assert.match(out, /class="nav"/, 'android must draw the gesture pill')
  assert.match(out, /\.nav \{/, 'android must define the pill CSS')
  // The iOS phone frame has neither — which is what keeps the golden clean.
  const ios = html({ screen: 'x', headline: 'A' })
  assert.ok(!ios.includes('class="nav"') && !ios.includes('.nav {'), 'the iOS phone frame must carry no android chrome')
})

test('Android tablets round out Play: 7"/10", tablet proportions AND the pill', () => {
  assert.deepEqual(DEVICES['android-tablet-7'].size, [1200, 1920])
  assert.deepEqual(DEVICES['android-tablet-10'].size, [1600, 2560])
  for (const id of ['android-tablet-7', 'android-tablet-10']) {
    assert.equal(DEVICES[id].renderWith, undefined, `${id} must render natively`)
    const [w, h] = DEVICES[id].size
    assert.ok(h / w <= 2, `${id} exceeds Play’s 2:1`)
  }
  // The kind carries both facts, read by substring, not exact match.
  assert.ok(isTablet({ kind: 'android-tablet' }) && isAndroid({ kind: 'android-tablet' }), 'an android tablet is both')
  assert.ok(isTablet({ kind: 'tablet' }) && !isAndroid({ kind: 'tablet' }), 'an iPad is a tablet, not android')
  assert.ok(isAndroid({ kind: 'android-phone' }) && !isTablet({ kind: 'android-phone' }), 'an android phone is not a tablet')

  // An android tablet frame draws the pill AND uses the tablet headline size.
  const tab = { size: [1200, 1920], width: 600, height: 960, scale: 2, insets: { top: 28, bottom: 24 }, kind: 'android-tablet' }
  const out = frameHtml({ slide: { screen: 'x', headline: 'A' }, device: tab, raw, frame: {}, fontCss: '' })
  assert.match(out, /class="nav"/, 'an android tablet still draws the pill')
  assert.match(out, new RegExp(`font-size: ${layoutPlan('standard', tab).headline}px`), 'tablet proportions apply')
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

test('elements composite over the ground — chip, accents, text, image', () => {
  const g = { bg: '#fff', dot: '#eee', ink: '#111', muted: '#666', accent: '#0a7' }
  const els = elementsHtml(
    [
      { type: 'chip', text: '4.9 ★', x: 0.5, y: 0.1 },
      { type: 'sparkle', x: 0.2, y: 0.2 },
      { type: 'squiggle', x: 0.5, y: 0.3, color: '#f00' },
      { type: 'text', text: 'Hi', x: 0.8, y: 0.4, rotation: -6 },
      { type: 'image', src: 'data:image/png;base64,AAAA', x: 0.5, y: 0.5, w: 0.3 },
    ],
    { W: 1290, H: 2796, ground: g },
  )
  assert.match(els, /4\.9 ★/)
  assert.match(els, new RegExp(`background:${g.accent}`), 'a chip defaults to the accent')
  assert.match(els, /<svg[^>]*><path d="M12 0/, 'the built-in sparkle')
  assert.match(els, /stroke="#f00"/, 'a squiggle honours an explicit colour')
  assert.match(els, /rotate\(-6deg\)/, 'rotation applies')
  assert.match(els, /data:image\/png;base64,AAAA/, 'an image element')
  // Positions are fractions of the frame — a chip at y:0.1 sits near the top.
  assert.match(els, /top:280px;/) // round(0.1 * 2796) = 280
  assert.equal(elementsHtml([], { W: 1290, H: 2796, ground: g }), '', 'no elements → nothing')
})

test('bridgeContexts groups only ADJACENT slides sharing an id', () => {
  const c = bridgeContexts([{ bridge: 'g' }, { bridge: 'g' }, {}, { bridge: 'x' }, { bridge: 'g' }])
  assert.deepEqual(c[0], { id: 'g', n: 2, i: 0 })
  assert.deepEqual(c[1], { id: 'g', n: 2, i: 1 })
  assert.equal(c[2], null, 'a slide with no bridge is not in a group')
  assert.deepEqual(c[3], { id: 'x', n: 1, i: 0 }, 'a lone bridge is n:1 (it cannot bridge)')
  assert.deepEqual(c[4], { id: 'g', n: 1, i: 0 }, 'the same id, but not adjacent, is a separate group')
})

test('a bridge element crosses the seam — same element, offset per column', () => {
  const els = [{ type: 'sparkle', x: 0.5, y: 0.3 }] // the seam of a 2-wide group
  const a = frameHtml({ slide: { screen: 'a', headline: 'A' }, device: DEVICE, raw, frame: {}, fontCss: '', bridge: { n: 2, i: 0, elements: els } })
  const b = frameHtml({ slide: { screen: 'b', headline: 'B' }, device: DEVICE, raw, frame: {}, fontCss: '', bridge: { n: 2, i: 1, elements: els } })
  // Column 0: the seam sits at the RIGHT edge (x = W). Column 1: at the LEFT edge (x = 0).
  assert.match(a, /left:1290px;/, 'in the first slide the seam element is at the right edge')
  assert.match(b, /left:0px;/, 'in the second slide the same element is at the left edge')
  // A slide not in a group draws no bridge element.
  const solo = html({ screen: 'a', headline: 'A' })
  assert.ok(!solo.includes('M12 0'), 'no bridge, no sparkle')
})

test('an eyebrow rides above the headline, in the accent, opt-in', () => {
  const out = html({ screen: 'x', headline: 'Big', eyebrow: 'new in 2.0', ground: 'light' })
  assert.match(out, /class="eyebrow">new in 2\.0</)
  assert.match(out, /\.eyebrow \{[^}]*text-transform: uppercase/)
  // A slide with no eyebrow emits neither the div nor the rule (byte-identity).
  assert.ok(!html({ screen: 'x', headline: 'Big' }).includes('eyebrow'))
})

test('a variant repackages the deck — theme over the whole, copy per slide', () => {
  const base = {
    frame: { theme: 'clean-light', bezel: '#111' },
    slides: [{ screen: 'a', headline: 'One' }, { screen: 'b', headline: 'Two' }],
  }
  const v = applyVariant(base, { name: 'bold', frame: { theme: 'dark-bold' }, slides: [{ headline: 'ONE!' }] })
  assert.equal(v.frame.theme, 'dark-bold', 'the variant theme wins')
  assert.equal(v.frame.bezel, '#111', 'unoverridden frame keys are kept')
  assert.equal(v.slides[0].headline, 'ONE!', 'slide 0 copy is overridden by index')
  assert.equal(v.slides[0].screen, 'a', 'the screen (and everything unset) is kept')
  assert.equal(v.slides[1].headline, 'Two', 'a slide the variant did not touch is unchanged')
  // The base is not mutated.
  assert.equal(base.slides[0].headline, 'One')
  assert.equal(base.frame.theme, 'clean-light')
})

test('variants are validated — named, unique, real theme', () => {
  assert.throws(() => normalise({ ...baseConfig, variants: [{ frame: {} }] }, CONFIG), /needs a name/)
  assert.throws(
    () => normalise({ ...baseConfig, variants: [{ name: 'x' }, { name: 'x' }] }, CONFIG),
    /duplicate variant/,
  )
  assert.throws(
    () => normalise({ ...baseConfig, variants: [{ name: 'x', frame: { theme: 'nope' } }] }, CONFIG),
    /unknown theme/,
  )
  const ok = normalise({ ...baseConfig, variants: [{ name: 'warm', frame: { theme: 'warm-editorial' } }] }, CONFIG)
  assert.equal(ok.variants.length, 1)
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

test('the legibility gate warns a washed-out ground, and never a good one', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21)
  assert.equal(contrastRatio('#123456', '#123456'), 1)

  // A custom ground whose ink barely differs from its background — fine at full
  // size, gone at 160px — is warned exactly once, per ground, not per slide.
  const bad = normalise(
    {
      ...baseConfig,
      frame: { grounds: { light: { bg: '#EEEEEE', dot: '#DDD', ink: '#C8C8C8', muted: '#BBB' } } },
      slides: [{ screen: 'a', headline: 'Hi' }, { screen: 'b', headline: 'Yo' }],
    },
    CONFIG,
  )
  assert.equal(bad.warnings.filter((w) => /read at thumbnail size/.test(w)).length, 1)

  // The zero-config grounds are high-contrast, so a normal deck is never nagged.
  const ok = normalise({ ...baseConfig, slides: [{ screen: 'a', headline: 'Hi' }] }, CONFIG)
  assert.deepEqual(ok.warnings.filter((w) => /thumbnail size/.test(w)), [])
  // And a slide with NO headline is not a legibility concern.
  const noHead = normalise({ ...baseConfig, slides: [{ screen: 'a' }] }, CONFIG)
  assert.deepEqual(noHead.warnings.filter((w) => /thumbnail size/.test(w)), [])
})

test('an element of unknown type fails at config time', () => {
  assert.throws(
    () => normalise({ ...baseConfig, slides: [{ screen: 'a', elements: [{ type: 'nope' }] }] }, CONFIG),
    /unknown type/,
  )
})

test('a bridge is warned when it cannot bridge — non-adjacent, or empty', () => {
  // Adjacent + elements: no warning.
  const good = normalise(
    {
      ...baseConfig,
      slides: [{ screen: 'a', bridge: 'g' }, { screen: 'b', bridge: 'g' }],
      bridges: { g: { elements: [{ type: 'sparkle', x: 0.5 }] } },
    },
    CONFIG,
  )
  assert.deepEqual(good.warnings.filter((w) => /bridge/.test(w)), [])

  // Non-adjacent (a screen between them): can't cross a seam that isn't there.
  const apart = normalise(
    { ...baseConfig, slides: [{ screen: 'a', bridge: 'g' }, { screen: 'b' }, { screen: 'a', bridge: 'g' }] },
    CONFIG,
  )
  assert.equal(apart.warnings.filter((w) => /never on two ADJACENT/.test(w)).length, 1)

  // Adjacent but no elements defined: nothing to cross.
  const empty = normalise(
    { ...baseConfig, slides: [{ screen: 'a', bridge: 'g' }, { screen: 'b', bridge: 'g' }] },
    CONFIG,
  )
  assert.equal(empty.warnings.filter((w) => /nothing crosses the seam/.test(w)).length, 1)

  // A mistyped bridge element type fails hard.
  assert.throws(
    () =>
      normalise(
        { ...baseConfig, slides: [{ screen: 'a', bridge: 'g' }], bridges: { g: { elements: [{ type: 'x' }] } } },
        CONFIG,
      ),
    /unknown type/,
  )
})

test('screenSecondary must be a real screen; two-devices without one warns', () => {
  assert.throws(
    () => normalise({ ...baseConfig, slides: [{ screen: 'a', screenSecondary: 'ghost' }] }, CONFIG),
    /not a declared screen/,
  )
  const warned = normalise({ ...baseConfig, slides: [{ screen: 'a', layout: 'two-devices' }] }, CONFIG)
  assert.equal(warned.warnings.filter((w) => /no screenSecondary/.test(w)).length, 1)
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
