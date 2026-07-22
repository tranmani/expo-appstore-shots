import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PNG } from 'pngjs'

import { pickReact } from '../src/build.mjs'
import { ConfigError, normalise, slideFile } from '../src/config.mjs'
import { DEVICES, resolveDevices } from '../src/devices.mjs'
import { match, parseRoute } from '../src/server.mjs'
import { stripAlpha } from '../src/compose.mjs'

const CONFIG_PATH = '/app/shots.config.mjs'
const base = {
  rootLayout: 'src/app/_layout.tsx',
  screens: [{ id: 'home', module: 'src/app/index.tsx' }],
}

test('config: every path resolves against the config file, not the app', () => {
  const c = normalise(base, CONFIG_PATH)
  assert.equal(c.projectRoot, '/app')
  assert.equal(c.api.fixtures, '/app/shots/fixtures.mjs')
  assert.equal(c.outDir, '/app/appstore')
  assert.equal(c.workDir, '/app/.shots')
  assert.equal(c.apiPort, 8788)
  assert.deepEqual(c.devices, ['iphone-6.9', 'iphone-6.5'])
})

test('config: with no slides, every screen is shot uncaptioned', () => {
  const c = normalise(base, CONFIG_PATH)
  assert.deepEqual(c.slides, [{ screen: 'home' }])
})

test('config: rejects what cannot work', () => {
  assert.throws(() => normalise({ ...base, screens: [] }, CONFIG_PATH), ConfigError)
  assert.throws(
    () => normalise({ ...base, screens: [{ id: 'a', module: 'a.tsx' }, { id: 'a', module: 'b.tsx' }] }, CONFIG_PATH),
    ConfigError,
    'duplicate screen ids',
  )
  assert.throws(
    () => normalise({ ...base, slides: [{ screen: 'nope', headline: 'x' }] }, CONFIG_PATH),
    ConfigError,
    'a slide that points at no screen',
  )
})

test('config: slide file names are numbered in upload order', () => {
  assert.equal(slideFile({ screen: 'home' }, 0), '01-home.png')
  assert.equal(slideFile({ screen: 'chat' }, 9), '10-chat.png')
  assert.equal(slideFile({ screen: 'chat', file: 'hero.png' }, 0), 'hero.png')
})

test('devices: every preset is an App Store slot', () => {
  // The exact pixel sizes Apple demands. A wrong number here is a rejected upload.
  assert.deepEqual(DEVICES['iphone-6.9'].size, [1290, 2796]) // accepted 6.9" size
  assert.deepEqual(DEVICES['iphone-6.5'].size, [1284, 2778])
  assert.deepEqual(DEVICES['iphone-6.3'].size, [1206, 2622]) // iPhone 16 Pro slot
  assert.deepEqual(DEVICES['ipad-13'].size, [2064, 2752])
  assert.deepEqual(DEVICES['ipad-12.9'].size, [2048, 2732])
})

test('devices: 6.3" composes from the 6.9 render, like 6.5', () => {
  const { chosen, rendered } = resolveDevices(['iphone-6.9', 'iphone-6.3'])
  assert.equal(chosen.length, 2)
  assert.equal(rendered.length, 1, '6.3 is composed from the 6.9 render, not shot again')
  assert.equal(rendered[0].id, 'iphone-6.9')
})

test('devices: sizes that share a layout are only shot once', () => {
  const { chosen, rendered } = resolveDevices(['iphone-6.9', 'iphone-6.5'])
  assert.equal(chosen.length, 2)
  assert.equal(rendered.length, 1, '6.5 is composed from the 6.9 render')
  assert.equal(rendered[0].id, 'iphone-6.9')
})

test('devices: an unknown preset fails loudly', () => {
  assert.throws(() => resolveDevices(['pixel-9']), /unknown device/)
})

test('routes: method defaults to GET', () => {
  assert.deepEqual(parseRoute('/api/items'), { method: 'GET', parts: ['api', 'items'] })
  assert.equal(parseRoute('POST /api/session').method, 'POST')
})

test('routes: named segments become params', () => {
  const route = parseRoute('GET /api/stations/:code/rooms/:id')
  assert.deepEqual(match(route, 'GET', '/api/stations/ASD/rooms/r-1'), { code: 'ASD', id: 'r-1' })
})

test('routes: a route only matches its own method, depth and literals', () => {
  const route = parseRoute('GET /api/stations/:code/rooms')
  assert.equal(match(route, 'POST', '/api/stations/ASD/rooms'), null, 'wrong method')
  assert.equal(match(route, 'GET', '/api/stations/ASD'), null, 'too shallow')
  assert.equal(match(route, 'GET', '/api/stations/ASD/rooms/r-1'), null, 'too deep')
  assert.equal(match(route, 'GET', '/api/trains/ASD/rooms'), null, 'wrong literal')
})

test('routes: an escaped segment is decoded for the handler', () => {
  const route = parseRoute('GET /api/trains/:tripId')
  assert.deepEqual(match(route, 'GET', '/api/trains/IC%203059'), { tripId: 'IC 3059' })
})

test('png: the alpha channel is dropped, and no pixel changes value', () => {
  // App Store Connect rejects PNGs with alpha; Chromium always writes one.
  const src = new PNG({ width: 2, height: 2 })
  const pixels = [
    [244, 243, 240],
    [23, 81, 63],
    [0, 0, 0],
    [255, 255, 255],
  ]
  pixels.forEach(([r, g, b], i) => {
    src.data[i * 4] = r
    src.data[i * 4 + 1] = g
    src.data[i * 4 + 2] = b
    src.data[i * 4 + 3] = 255
  })

  const out = PNG.sync.read(stripAlpha(PNG.sync.write(src)))
  assert.equal(out.width, 2)
  assert.equal(out.height, 2)
  pixels.forEach(([r, g, b], i) => {
    assert.equal(out.data[i * 4], r)
    assert.equal(out.data[i * 4 + 1], g)
    assert.equal(out.data[i * 4 + 2], b)
  })
})

test('react: an app with an EXACTLY matching react-dom supplies both', () => {
  assert.deepEqual(
    pickReact({ app: '19.1.0', appDom: '19.1.0', own: '19.2.7', ownDom: '19.2.7' }),
    { from: 'app' },
  )
})

test('react: an Expo app with no react-dom gets the tool\'s matched pair', () => {
  assert.deepEqual(
    pickReact({ app: '19.1.0', appDom: null, own: '19.2.7', ownDom: '19.2.7' }),
    { from: 'own' },
  )
})

test('react: a hoisted react-dom on another major is ignored, not trusted', () => {
  // The monorepo trap: some unrelated tool pulled react-dom 18 into the root
  // node_modules. Bundling it against the app's React 19 renders nothing.
  assert.deepEqual(
    pickReact({ app: '19.1.0', appDom: '18.3.1', own: '19.2.7', ownDom: '19.2.7' }),
    { from: 'own' },
  )
})

test('react: a react-dom on the same MAJOR but a different patch is still refused', () => {
  // THE BUG. This used to compare majors, and 19.1.0 against 19.2.7 sailed through — but React
  // compares the two EXACTLY and throws #527 on any difference, which means a blank PNG. The app's
  // pair is only usable when it is identical; otherwise fall back to the tool's own matched pair.
  assert.deepEqual(
    pickReact({ app: '19.1.0', appDom: '19.2.7', own: '19.2.7', ownDom: '19.2.7' }),
    { from: 'own' },
  )
})

test('react: the TOOL\'s own broken pair is caught, not handed to the bundler', () => {
  // Also the bug, and the half nobody would have looked for. This package declared react and
  // react-dom as two independent ^19.0.0 ranges, so an install was free to satisfy them with
  // different resolutions — and did: react 19.1.0 beside react-dom 19.2.7. The tool then bundled
  // its OWN mismatched pair and produced twenty-four blank frames without a word. The versions are
  // pinned now; this is the belt to that pair of braces, because a dependency range is a promise
  // that somebody else keeps.
  const { error } = pickReact({ app: '19.1.0', appDom: null, own: '19.1.0', ownDom: '19.2.7' })
  assert.match(error, /broken React install/)
  assert.match(error, /19\.1\.0/)
  assert.match(error, /19\.2\.7/)
})

test('react: an app on another major is told exactly what to install', () => {
  const { error } = pickReact({ app: '18.3.1', appDom: null, own: '19.2.7', ownDom: '19.2.7' })
  assert.match(error, /npm install --save-dev react-dom@18/)
})
