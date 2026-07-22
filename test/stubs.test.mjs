/**
 * The stubs, against the imports a real app actually makes.
 *
 * This is the cheap half of `kitchen-sink.tsx` — no browser, no screenshots,
 * just the bundler — and it is the half that catches the failure that hurts
 * most. A missing export is not a degraded screen: every screen in a run is
 * bundled into one file, so a single unanswered import from one dev-only screen
 * fails *all* of them at once, with an esbuild error naming this tool's own
 * stub. That is what produced the ~15 hand-patches behind the FamMedley report.
 *
 * It runs everywhere, which the e2e test does not (that one needs Chromium), so
 * this is the test that will actually be run when someone touches a stub.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bundle } from '../src/build.mjs'
import { normalise } from '../src/config.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const app = resolve(here, 'fixture-app')
const configPath = resolve(app, 'shots.config.mjs')

/**
 * Bundle the fixture app into a scratch dir and hand back everything worth
 * asserting on. The files are read *before* the cleanup, not after: the scratch
 * dir is gone by the time the caller sees any of this.
 */
async function build(overrides = {}) {
  const raw = (await import(pathToFileURL(configPath).href)).default
  const work = resolve(here, `.stubs-work-${Math.random().toString(36).slice(2)}`)
  const config = normalise({ ...raw, ...overrides, workDir: work }, configPath)
  try {
    const built = await bundle(config)
    return {
      config,
      warnings: built.warnings,
      js: await readFile(resolve(work, 'app.js'), 'utf8'),
      entry: await readFile(built.entryFile, 'utf8'),
    }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

test('every import a native-heavy app makes resolves to a stub', async () => {
  // The assertion IS the build: `kitchen-sink.tsx` imports DevSettings,
  // TurboModuleRegistry, the exiting reanimated descriptors, useAnimatedProps,
  // gesture-handler's ScrollView/FlatList, the badge APIs, expo-file-system's
  // File/Directory/Paths, the auth-session functions, Skia, fast-confetti,
  // android-widget, react-native-maps, expo-sqlite, six @react-navigation hooks,
  // two react-native/Libraries subpaths and a .webp. Each was a hard failure.
  const { js } = await build()
  assert.ok(js.length > 1000, 'the bundle is suspiciously small')
})

test('no import in a native-heavy app quietly resolves to undefined', async () => {
  // THE HALF A BUILD DOES NOT FAIL ON.
  //
  // A stub that re-exports with `export *` cannot be checked statically, so a
  // name it is missing is not an error — the app just gets `undefined`, and
  // esbuild says so in a warning that scrolls past a run which then reports
  // success. `Notifications.setBadgeCountAsync(0).catch(…)` is the shape that
  // punishes it: the throw happens at the call, before `.catch` exists to catch
  // anything, so a line that looks defensive takes the whole screen down.
  const { warnings } = await build()
  const undefined_ = warnings.filter((w) => /will always be undefined|no matching export/i.test(w))
  assert.deepEqual(undefined_, [], 'an import in kitchen-sink.tsx is undefined at runtime')
})

test('an import that IS undefined gets reported', async () => {
  // The other half, and without it the test above is a tautology: it filters a
  // list that is empty whether or not the tool collects anything, so deleting
  // the collector outright left every test green. A feature nothing can fail is
  // not a feature. `undefined-import.tsx` reaches for a name that does not
  // exist; the run has to say so.
  const { warnings } = await build({
    screens: [{ id: 'bad', module: 'src/app/undefined-import.tsx', route: 'bad' }],
    slides: [],
    setup: undefined,
  })
  assert.ok(
    warnings.some((w) => /definitelyNotAnExport/.test(w)),
    `esbuild's import-is-undefined warning was not reported: ${JSON.stringify(warnings)}`,
  )
})

test('a react-native subpath resolves to the internals stub, not to a path under a filename', async () => {
  // THE RECURRING FAILURE SHAPE. `react-native` is aliased to a file, and
  // esbuild rewrites aliases by prefix, so `react-native/Libraries/…` used to
  // resolve to `…/stubs/react-native.tsx/Libraries/…` — a directory under a
  // filename, which cannot exist. The error named this tool's stub, so it read
  // like a broken install rather than a package asking for an RN internal.
  const { js } = await build()
  assert.ok(!js.includes('react-native.tsx/Libraries'), 'the alias spliced a subpath onto a filename')
  // registerAsset is real, not a no-op: an id round-trips back to its asset.
  assert.match(js, /registerAsset/)
})

test('the webp loader is wired up, and the asset is inlined', async () => {
  const { js } = await build()
  assert.match(js, /data:image\/webp;base64/, 'the .webp asset was not inlined')
})

test('an audio asset resolves to an empty module, not a failed build', async () => {
  // kitchen-sink imports `./tap.wav`. esbuild has no built-in loader for audio,
  // so without one the whole bundle fails — the same shape as the .webp gap, one
  // format over. It is `empty`, not `dataurl`: a sound effect never plays in a
  // still frame, and embedding a soundtrack as a data URI would bloat every
  // bundle for nothing. The proof is simply that the build above produced JS.
  const { js } = await build()
  assert.ok(js.length > 1000, 'the bundle failed — an audio asset had no loader')
  assert.ok(!/data:audio/.test(js), 'the .wav was embedded; it should be empty')
})

test('config.loaders can add a format the tool has never heard of', async () => {
  // The escape hatch, because there is always a next format. Turning .webp into
  // a `text` loader is a nonsense choice that nobody would make — which is
  // exactly why it proves the option is honoured rather than ignored.
  const { js } = await build({ loaders: { '.webp': 'text' } })
  assert.ok(!js.includes('data:image/webp;base64'), 'config.loaders was ignored')
})

test('a user stub wins over the tool’s own alias', async () => {
  // F16: `config.stubs` used to be merged FIRST and then overwritten by every
  // internal alias set afterwards — lucide, react, react-dom, react-native-svg.
  // A config that stubbed one of those got the tool's answer instead of its own,
  // silently. The user's config is the last word about the user's app.
  const marker = resolve(here, 'fixture-app/src/app/fake-lucide.ts')
  const { js } = await build({ stubs: { 'lucide-react-native': marker } })
  assert.match(js, /USER_STUB_WON/, 'config.stubs lost to an internal alias')
})

test('a user stub beats even the react-native subpath catch-all', async () => {
  // The catch-all is an onResolve plugin, and a plugin beats the alias table —
  // which is where `config.stubs` lives. So "your stubs win" was false for this
  // whole namespace, and there was no way at all to answer, say,
  // `react-native/Libraries/Utilities/Platform` properly: the tool always got
  // there first with a Proxy.
  const marker = resolve(here, 'fixture-app/src/app/fake-asset-registry.ts')
  const { js } = await build({
    stubs: { 'react-native/Libraries/Image/AssetRegistry': marker },
  })
  assert.match(js, /USER_ASSET_REGISTRY_WON/, 'the subpath catch-all overrode config.stubs')
})

test('config.redirect can out-argue the react-native subpath catch-all', async () => {
  // Plugins answer in the order they are registered, and the catch-all is a
  // plugin — so if it goes first, no `redirect` rule in the world can reach this
  // namespace. The user's config is registered first for exactly this reason.
  const { js } = await build({
    redirect: { 'Libraries/Image/AssetRegistry$': 'src/app/fake-asset-registry.ts' },
  })
  assert.match(js, /USER_ASSET_REGISTRY_WON/, 'the subpath catch-all answered before config.redirect')
})

test('redirectFile matches the resolved path, whatever the import called it', async () => {
  // F17's capability, which shipped with no test at all. `kitchen-sink.tsx`
  // imports './pixel.webp' by a relative specifier; this rule never mentions
  // that string — it matches where the import lands on disk.
  const { js } = await build({
    redirectFile: { 'fake-lucide\\.ts$': 'src/app/fake-asset-registry.ts' },
    stubs: { 'lucide-react-native': resolve(here, 'fixture-app/src/app/fake-lucide.ts') },
  })
  // The stub resolves to fake-lucide.ts; redirectFile then catches it by its
  // real path and swaps it again. If it fired, the marker from the *second*
  // file is what ends up in the bundle.
  assert.match(js, /USER_ASSET_REGISTRY_WON/, 'redirectFile did not match the resolved path')
  assert.ok(!js.includes('USER_STUB_WON'), 'redirectFile did not replace the module it matched')
})

test('lucide missing from an app that depends on it is a loud warning, not a quiet fallback', async () => {
  // C11, and the worst failure in the report: the fallback to `lucide-empty`
  // deleted every icon in the app and said nothing at all. The fixture app
  // genuinely has no node_modules, so declaring the dependency is enough to put
  // the tool in exactly that state.
  const { warnings } = await build({
    projectRoot: resolve(here, 'fixture-app-lucide'),
    screens: [{ id: 'home', module: 'src/app/index.tsx', route: 'index' }],
    setup: undefined,
  })
  assert.equal(warnings.length, 1, `expected one warning, got: ${JSON.stringify(warnings)}`)
  assert.match(warnings[0], /lucide-react-native/)
  assert.match(warnings[0], /render as nothing/)
})

test('an app with no lucide at all is not warned at — that fallback is correct', async () => {
  // The mirror image, and the reason the warning checks the *dependency* rather
  // than the resolution: an app that never asked for lucide loses nothing when
  // the tab bar draws labels, and a warning there would be noise that trains
  // people to ignore the one above.
  const { warnings } = await build()
  assert.deepEqual(warnings, [])
})

test('lucide resolves even when its exports map bolts the front door', async () => {
  // THE BUG THAT DELETED EVERY ICON IN AN APP, WITHOUT SAYING ANYTHING.
  //
  // The tool asked Node for `lucide-react-native/package.json`. That is the
  // obvious question and it stopped working in lucide 0.544: an `exports` map
  // only answers for the subpaths it lists, and lucide stopped listing
  // `./package.json`. So `require.resolve` threw ERR_PACKAGE_PATH_NOT_EXPORTED
  // for a package that was installed and sitting right there, the tool concluded
  // "no lucide", aliased it to the empty stub — and every icon in the app
  // rendered as nothing, with no error and no warning.
  //
  // This builds a real package with a real 0.563-shaped exports map (no
  // `./package.json`, verified against the published one) and asserts the tool
  // finds it anyway, by resolving the entry and walking up to the root.
  await withFakeLucide({ esmOnly: false }, async ({ js, warnings }) => {
    assert.deepEqual(warnings, [], 'an installed lucide was reported as missing')
    assert.match(js, /FAKE_LUCIDE_HOUSE/, 'the app’s real lucide was not the one bundled')
  })
})

test('lucide resolves even when the package answers no `require` condition at all', async () => {
  // The walk-up's original premise was that the entry is something "every
  // exports map answers for". It is not: `createRequire().resolve()` asks under
  // the **require** condition, so a package shipping only `import`/`browser` —
  // which is where the react-native ecosystem is going — answers neither that
  // nor `./package.json`, and the tool was back to concluding "no lucide" and
  // deleting every icon. lucide 0.563 ships `require`, so the first fix worked
  // by luck as much as by reasoning. Reading it off the disk does not care.
  await withFakeLucide({ esmOnly: true }, async ({ js, warnings }) => {
    assert.deepEqual(warnings, [], 'an ESM-only lucide was reported as missing')
    assert.match(js, /FAKE_LUCIDE_HOUSE/, 'the app’s real lucide was not the one bundled')
  })
})

/**
 * A real installed lucide, with a real 0.563-shaped exports map — no
 * `./package.json`, no `icons` object, icons as individual named exports.
 * `esmOnly` drops the `require` condition and `main` too, which is what makes
 * Node's resolver refuse the package entirely.
 */
async function withFakeLucide({ esmOnly }, check) {
  const app = await mkdtemp(resolve(tmpdir(), 'shots-lucide-'))
  try {
    const pkg = resolve(app, 'node_modules/lucide-react-native')
    await mkdir(resolve(pkg, 'dist/esm'), { recursive: true })
    await mkdir(resolve(pkg, 'dist/cjs'), { recursive: true })
    await mkdir(resolve(app, 'src/app'), { recursive: true })

    await writeFile(
      resolve(pkg, 'package.json'),
      JSON.stringify({
        name: 'lucide-react-native',
        version: '0.563.0',
        ...(esmOnly ? {} : { main: 'dist/cjs/lucide.js' }),
        exports: {
          '.': {
            types: './dist/lucide.d.ts',
            import: './dist/esm/lucide.js',
            browser: './dist/esm/lucide.js',
            ...(esmOnly ? {} : { require: './dist/cjs/lucide.js' }),
          },
        },
      }),
    )
    await writeFile(resolve(pkg, 'dist/esm/lucide.js'), 'export const House = () => "FAKE_LUCIDE_HOUSE"\n')
    await writeFile(resolve(pkg, 'dist/cjs/lucide.js'), 'exports.House = () => "FAKE_LUCIDE_HOUSE"\n')

    await writeFile(
      resolve(app, 'package.json'),
      JSON.stringify({ name: 'a', dependencies: { 'lucide-react-native': '^0.563.0' } }),
    )
    await writeFile(resolve(app, 'src/app/index.tsx'), 'export default function Home() { return null }\n')

    await check(
      await build({
        projectRoot: app,
        rootLayout: undefined,
        screens: [{ id: 'home', module: 'src/app/index.tsx', route: 'index' }],
        setup: undefined,
      }),
    )
  } finally {
    await rm(app, { recursive: true, force: true })
  }
}

test('rootLayout is optional, and defaults to the built-in one', async () => {
  // D12: this used to be a hard ConfigError, which meant a React Navigation app
  // — which has no `_layout.tsx` to point at — could not get past the tool's
  // first question.
  const { config } = await build({ rootLayout: undefined })
  assert.match(config.rootLayout, /stubs\/root-layout\.tsx$/)
  // It says so, rather than quietly standing in: an expo-router app that simply
  // forgot to point at its `_layout.tsx` would otherwise lose its whole header
  // and provider tree without a word.
  assert.ok(
    config.warnings.some((w) => /no config\.rootLayout/.test(w)),
    `expected a rootLayout note, got: ${JSON.stringify(config.warnings)}`,
  )
})

test('config.setup is imported before the screens, and awaited before mount', async () => {
  // E13/E14/E15: the harness mounts one screen, not the app root, so an app that
  // hydrates in a root lifecycle hook renders its skeleton forever. This is the
  // hook that lets state arrive by any route other than `fetch`.
  const { entry } = await build({ setup: 'src/app/setup.ts' })
  const setupAt = entry.indexOf('setup.ts')
  const screenAt = entry.indexOf('kitchen-sink.tsx')
  assert.ok(setupAt > 0, 'the setup module was not imported')
  assert.ok(setupAt < screenAt, 'setup must be imported before the screen modules evaluate')
  assert.match(entry, /__setup\.default/)
})
