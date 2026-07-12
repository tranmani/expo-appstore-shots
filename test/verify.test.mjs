/**
 * The checks that stop a broken frame from being reported as a good one.
 *
 * Each of these corresponds to a real failure a first-time user hit: a clean
 * run, no errors, and a polished PNG that was not shippable.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PNG } from 'pngjs'

import { flatness, iconReport, report, unusedFixtures } from '../src/verify.mjs'
import { checkIcons, distance, suggest } from '../src/icons.mjs'
import { byPrecedence, match, parseRoute } from '../src/server.mjs'
import { endpointsFrom, paramsOf, routeId, tabOf, tabsFrom } from '../src/scan.mjs'
import { applyFilters, flagValues } from '../src/args.mjs'
import { runtimeFor } from '../src/capture.mjs'
import { normalise } from '../src/config.mjs'
import { nodeModulesOf } from '../src/build.mjs'

/** A PNG whose bottom `deadRows` rows are a single flat colour. */
function png({ width = 10, height = 100, deadRows = 0 }) {
  const p = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const dead = y >= height - deadRows
      // Live rows vary along x so no row is flat; dead rows are uniform white.
      p.data[i] = dead ? 255 : (x * 20) % 256
      p.data[i + 1] = dead ? 255 : 100
      p.data[i + 2] = dead ? 255 : 40
      p.data[i + 3] = 255
    }
  }
  return p
}

/* ------------------------------------------------------------ dead space --- */

test('flatness: a screen that ran out of data is mostly one colour', () => {
  const f = flatness(png({ deadRows: 50 }))
  assert.equal(f.rows, 50)
  assert.equal(f.share, 0.5)
  assert.equal(f.colour, '255,255,255')
})

test('flatness: a busy screen has no long flat run', () => {
  const f = flatness(png({ deadRows: 0 }))
  assert.equal(f.rows, 0)
})

test('flatness: only the run that reaches the bottom counts', () => {
  // A flat band in the middle is a hero image or a coloured header — design, not
  // failure. Counting every flat row would report it, and the warning would be
  // noise on exactly the screens that are meant to look like that.
  const p = png({ height: 100, deadRows: 40 })
  for (let x = 0; x < 10; x++) p.data[(80 * 10 + x) * 4] = x * 20 // break the run

  // The trailing run is now y=81..99, and everything above the break is ignored.
  assert.equal(flatness(p).rows, 19)
})

test('flatness: the tab bar is chrome, not content — and not dead space', () => {
  // The bar is painted into the frame, so without skipping it the trailing run
  // stops at the bar and dead space above it is never seen.
  const p = png({ height: 100, deadRows: 40 })
  for (let x = 0; x < 10; x++) p.data[(95 * 10 + x) * 4] = 7 // a "tab bar" band

  // Measured from the bottom, the bar stops the run after 4 rows and the 30
  // blank rows above it are never seen — which is the whole failure.
  assert.equal(flatness(p).rows, 4, 'the bar hides the dead space above it')
  assert.equal(flatness(p, 10).rows, 30, 'skip the bar and the dead space appears')
})

/* ---------------------------------------------------------------- report --- */

test('report: clipped text names the string that got cut', () => {
  const lines = report([
    { device: 'iphone-6.9', screen: 'home', clipped: [{ text: '48 260…' }] },
  ])
  assert.equal(lines.length, 1)
  assert.match(lines[0], /iphone-6\.9\/home/)
  assert.match(lines[0], /clipped text/)
  assert.match(lines[0], /48 260…/)
})

test('report: chrome drawn over content is named by zone', () => {
  const lines = report([
    { device: 'ipad-13', screen: 'calendar', overlaps: [{ zone: 'status bar', text: 'July' }] },
  ])
  assert.match(lines[0], /status bar is drawn over "July"/)
})

test('report: a scroll nobody could honour is flagged', () => {
  const lines = report([
    { device: 'iphone-6.9', screen: 'about', scrollWanted: 'end', scrollables: 0 },
  ])
  assert.match(lines[0], /nothing on this screen scrolls/)
})

test('report: the default scroll is not a complaint', () => {
  // Every static screen would otherwise warn, and the report would be noise.
  const lines = report([
    { device: 'iphone-6.9', screen: 'about', scrollWanted: null, scrollables: 0 },
  ])
  assert.deepEqual(lines, [])
})

test('report: a testID that does not exist is named', () => {
  const lines = report([
    { device: 'iphone-6.9', screen: 'home', missingAnchor: 'kpi-tile', scrollables: 1 },
  ])
  assert.match(lines[0], /no element has that testID/)
})

test('report: a clean run says nothing at all', () => {
  assert.deepEqual(report([{ device: 'iphone-6.9', screen: 'home', clipped: [], overlaps: [] }]), [])
})

/* -------------------------------------------------------------- fixtures --- */

test('fixtures: one nobody requested is probably a typo', () => {
  const routes = [{ key: 'GET /api/rooms' }, { key: 'GET /api/romos' }]
  assert.deepEqual(unusedFixtures(routes, new Set(['GET /api/rooms'])), ['GET /api/romos'])
})

test('route precedence: an exact path beats a :param, whatever the order', () => {
  // The trap: /bookings/:id declared first used to swallow /bookings/today-count.
  const routes = [parseRoute('GET /bookings/:id'), parseRoute('GET /bookings/today-count')]
  const sorted = [...routes].sort(byPrecedence)

  const hit = sorted.find((r) => match(r, 'GET', '/bookings/today-count'))
  assert.deepEqual(hit.parts, ['bookings', 'today-count'])

  // …and the dynamic one still catches everything else.
  const other = sorted.find((r) => match(r, 'GET', '/bookings/42'))
  assert.deepEqual(other.parts, ['bookings', ':id'])
})

/* ----------------------------------------------------------------- icons --- */

test('icons: a renamed lucide icon gets a near match', () => {
  const known = ['ChartColumn', 'ChartLine', 'Calendar', 'House']
  const [problem] = checkIcons([{ id: 'stats', icon: 'ChartColum' }], known)
  assert.equal(problem.icon, 'ChartColum')
  assert.ok(problem.suggestions.includes('ChartColumn'))
})

test('icons: a name lucide has is not reported', () => {
  assert.deepEqual(checkIcons([{ id: 'home', icon: 'House' }], ['House']), [])
})

test('icons: containment outranks raw edit distance', () => {
  // "barchart" is 3 edits from "BarChart" but also 4 from "Calendar"; the
  // substring match is the one a human means.
  assert.equal(suggest('barchart', ['BarChart', 'Calendar'])[0], 'BarChart')
})

test('icons: distance is symmetric and zero on equality', () => {
  assert.equal(distance('house', 'house'), 0)
  assert.equal(distance('house', 'mouse'), distance('mouse', 'house'))
})

test('icons: the run-level report suggests, and only says it once', () => {
  const findings = [
    { iconNames: ['ChartColumn'], missingIcons: [{ tab: 'stats', icon: 'BarChart3' }] },
    { iconNames: ['ChartColumn'], missingIcons: [{ tab: 'stats', icon: 'BarChart3' }] },
  ]
  const lines = iconReport(findings, suggest)
  assert.equal(lines.length, 1, 'a bad icon is wrong on every frame; say it once')
  assert.match(lines[0], /lucide has no icon "BarChart3"/)
})

/* ------------------------------------------------------------------ scan --- */

test('scan: expo-router filenames become route ids', () => {
  assert.equal(routeId('(tabs)/index.tsx'), 'index')
  assert.equal(routeId('(tabs)/profile.tsx'), 'profile')
  assert.equal(routeId('station/[id].tsx'), 'station-id')
  assert.equal(routeId('blog/[...rest].tsx'), 'blog-rest')
})

test('scan: the home tab is a tab, not the group folder', () => {
  // (tabs)/index.tsx is the tab called "index". Reading the *parent directory*
  // for an index file gives "(tabs)", which matches no tab — and silently drops
  // the one screen every app has.
  assert.equal(tabOf('(tabs)/index.tsx'), 'index')
  assert.equal(tabOf('(tabs)/profile.tsx'), 'profile')
  assert.equal(tabOf('(tabs)/settings/index.tsx'), 'settings', 'a directory tab')
  assert.equal(tabOf('account.tsx'), null, 'not a tab screen at all')
})

test('scan: a dynamic route is given a param so it can render', () => {
  assert.deepEqual(paramsOf('station/[id].tsx'), { id: '1' })
  assert.equal(paramsOf('index.tsx'), undefined)
})

test('scan: the tabs come out of the tabs layout, both spellings', () => {
  const source = `
    <Tabs.Screen name="index" options={{}} />
    <NativeTabs.Trigger name="profile" />
  `
  assert.deepEqual(tabsFrom(source), [
    { id: 'index', label: 'Index' },
    { id: 'profile', label: 'Profile' },
  ])
})

test('scan: an interpolated endpoint becomes a :param fixture', () => {
  const source = 'fetch(`${api}/api/rooms/${id}/messages`); fetch("/api/status?full=1")'
  const found = endpointsFrom(source)
  assert.ok(found.includes('/api/rooms/:param/messages'))
  assert.ok(found.includes('/api/status'), 'the query string is not part of the route')
})

/* ------------------------------------------------------------------- cli --- */

test('cli: --screen takes repeats and = form', () => {
  assert.deepEqual(flagValues(['--screen', 'home', '--screen=chat'], '--screen'), ['home', 'chat'])
})

test('cli: filtering a run narrows screens and their slides', () => {
  const config = normalise(
    {
      rootLayout: 'src/app/_layout.tsx',
      screens: [
        { id: 'home', module: 'a.tsx' },
        { id: 'chat', module: 'b.tsx' },
      ],
      slides: [{ screen: 'home' }, { screen: 'chat' }],
    },
    '/app/shots.config.mjs',
  )

  const filtered = applyFilters(config, ['--screen', 'chat', '--device', 'ipad-13'])
  assert.deepEqual(filtered.screens.map((s) => s.id), ['chat'])
  assert.deepEqual(filtered.slides.map((s) => s.screen), ['chat'])
  assert.deepEqual(filtered.devices, ['ipad-13'])

  // A partial run must know it is partial: otherwise every fixture the screens
  // it skipped would be reported as an unrequested typo.
  assert.equal(filtered.allScreens, 2)
  assert.notEqual(filtered.screens.length, filtered.allScreens)
})

test('cli: a typo in --screen is refused, with the real ids', () => {
  const config = normalise(
    { rootLayout: 'a.tsx', screens: [{ id: 'home', module: 'a.tsx' }] },
    '/app/shots.config.mjs',
  )
  assert.throws(() => applyFilters(config, ['--screen', 'hoem']), /no such screen.*home/s)
})

/* --------------------------------------------------------------- runtime --- */

test('runtime: a screen overrides the run, key by key', () => {
  const config = { runtime: { locale: 'en-US', storage: { seen: '1' }, clock: '09:41' } }
  const merged = runtimeFor(config, { runtime: { colorScheme: 'dark', clock: '21:00' } })

  assert.equal(merged.colorScheme, 'dark')
  assert.equal(merged.clock, '21:00', 'the screen wins')
  assert.equal(merged.locale, 'en-US', 'and inherits the rest')
})

test('runtime: a screen with no overrides is just the run', () => {
  assert.deepEqual(runtimeFor({ runtime: { locale: 'nl-NL' } }, {}), { locale: 'nl-NL' })
})

/* ---------------------------------------------------------------- config --- */

test('config: a tab screen with no header is warned about, not failed', () => {
  // Its header lives in (tabs)/_layout.tsx, which is never mounted — so it would
  // render under the status bar, and nothing about that looks like an error.
  const c = normalise(
    {
      rootLayout: 'src/app/_layout.tsx',
      screens: [{ id: 'home', module: 'a.tsx', tab: 'home' }],
    },
    '/app/shots.config.mjs',
  )
  assert.equal(c.warnings.length, 1)
  assert.match(c.warnings[0], /under the status bar/)
})

test('config: a tab screen that asks for a header is not warned about', () => {
  const c = normalise(
    {
      rootLayout: 'src/app/_layout.tsx',
      screens: [
        { id: 'home', module: 'a.tsx', tab: 'home', title: 'Home' },
        { id: 'map', module: 'b.tsx', tab: 'map', header: false },
      ],
    },
    '/app/shots.config.mjs',
  )
  assert.deepEqual(c.warnings, [])
})

/* ----------------------------------------------------------------- build --- */

test('build: the node_modules a package sits in, scoped or not', () => {
  assert.equal(nodeModulesOf('/app/node_modules/react-native-web/package.json', 'react-native-web'), '/app/node_modules')
  assert.equal(nodeModulesOf('/app/node_modules/@scope/pkg/package.json', '@scope/pkg'), '/app/node_modules')
})

test('flatness: a textured background is still empty', () => {
  // The false negative that matters: real app grounds are dotted, noisy or
  // gradient-y. An exact "every pixel identical" test reports nothing on exactly
  // the screens that are emptiest, because the texture makes them arithmetically
  // busy while being visually blank.
  const p = new PNG({ width: 100, height: 100 })
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      const i = (y * 100 + x) * 4
      const dead = y >= 50
      const dot = dead && x % 20 === 0 // a dot grid on the empty ground
      p.data[i] = dead ? (dot ? 238 : 244) : (x * 3) % 256
      p.data[i + 1] = dead ? (dot ? 237 : 243) : 90
      p.data[i + 2] = dead ? (dot ? 234 : 240) : 30
      p.data[i + 3] = 255
    }
  }
  assert.equal(flatness(p).rows, 50, 'the dots do not make an empty half look busy')
})

test('flatness: a row of text is not an empty row', () => {
  // The other side of the tolerance: it must not swallow content. A line of body
  // text is mostly background too, just not *enough* of it.
  const p = new PNG({ width: 100, height: 10 })
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 100; x++) {
      const i = (y * 100 + x) * 4
      const ink = y === 9 && x < 10 // 10% of the last row is glyph
      p.data[i] = ink ? 0 : 244
      p.data[i + 1] = ink ? 0 : 243
      p.data[i + 2] = ink ? 0 : 240
      p.data[i + 3] = 255
    }
  }
  assert.equal(flatness(p).rows, 0, 'a row with type in it is content')
})
