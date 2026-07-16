/**
 * Bundles the Expo app for a headless browser.
 *
 * The trick is entirely in resolution: `react-native` becomes `react-native-web`,
 * the native modules become the stubs in `src/stubs`, and the app's own tsconfig
 * is handed to esbuild so its `@/…` path aliases keep working exactly as they do
 * under Metro. Nothing in the app has to know it is being photographed.
 */
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const stub = (name) => resolve(here, 'stubs', name)

const major = (v) => Number(String(v).split('.')[0])

const version = async (pkgJson) => JSON.parse(await readFile(pkgJson, 'utf8')).version

/**
 * Which react / react-dom pair to bundle.
 *
 * THEY MUST BE THE SAME EXACT VERSION, not merely the same major. React compares the two at the
 * first render and throws #527 — "Incompatible React versions" — on any difference at all, and a
 * thrown render is a BLANK PNG. 19.1.0 against 19.2.7 is enough to lose every screenshot.
 *
 * That distinction is the whole bug this function was rewritten for. It used to compare majors, on
 * the reasonable-sounding theory that 19.x is 19.x, and it let two different patches of React 19
 * through to the bundler. Reasonable-sounding is not what React checks.
 *
 * Three traps, and the third is the one that bit:
 *
 *  - An Expo app usually has NO react-dom at all. It never renders to a DOM.
 *
 *  - A monorepo often has a HOISTED react-dom that some unrelated tool dragged in, on a completely
 *    different major from the app's react. Resolving it and trusting it is how you get a blank PNG.
 *
 *  - THE TOOL'S OWN PAIR CAN BE MISMATCHED TOO, and that is not hypothetical: this package declared
 *    `react: ^19.0.0` and `react-dom: ^19.0.0` as two INDEPENDENT ranges, so a fresh install was
 *    free to satisfy them with different resolutions — and did, landing react 19.1.0 next to
 *    react-dom 19.2.7. The tool then handed its own broken pair to the bundler and produced
 *    twenty-four blank frames without a word. The versions are pinned now, and this checks anyway:
 *    a dependency range is a promise somebody else keeps.
 */
export function pickReact({ app, appDom, own, ownDom }) {
  // The tool's own pair is the fallback for everything below, so if IT is broken there is no safe
  // ground to stand on. Say so, loudly, rather than render nothing.
  if (ownDom && own !== ownDom) {
    return {
      error:
        `expo-appstore-shots has a broken React install: react ${own} but react-dom ${ownDom}.\n` +
        `They must be identical or React throws #527 and every screenshot comes out blank.\n\n` +
        `Reinstall the tool. If you are running it from a checkout, delete node_modules and install again.\n`,
    }
  }

  // The app's own pair, but only if it is INTERNALLY CONSISTENT — exactly equal, not merely the
  // same major.
  if (appDom && app && appDom === app) return { from: 'app' }

  // No usable pair in the app. Fall back to the tool's, which is safe as long as the majors agree:
  // the app's code is compiled against whatever React ends up in the bundle, and 19.x is 19.x as far
  // as the API is concerned. It is only the react/react-dom PAIR that has to match exactly.
  if (app && major(app) !== major(own)) {
    return {
      error:
        `This app is on React ${app} and expo-appstore-shots ships React ${own}.\n` +
        `Install a matching react-dom in the app and it will be used instead:\n\n` +
        `  npm install --save-dev react-dom@${app}\n`,
    }
  }

  return { from: 'own' }
}

/**
 * The `node_modules` directory a resolved package sits in.
 *
 * `<nm>/react-native-web/package.json` → `<nm>`, and a scoped package is one
 * level deeper: `<nm>/@scope/pkg/package.json` → `<nm>`. Under pnpm the resolved
 * path is the real one inside `.pnpm/…`, whose parent is a real node_modules
 * holding that package and its dependencies — which is exactly what esbuild
 * needs to resolve from.
 */
export function nodeModulesOf(pkgJsonPath, name) {
  const up = name.startsWith('@') ? '../../..' : '../..'
  return resolve(pkgJsonPath, up)
}

/**
 * Resolve a package from the *app's* node_modules, not this tool's.
 *
 * Returns the path to the package's own package.json — which is both the thing
 * `version()` reads and, via `dirname`, the directory esbuild is aliased to.
 *
 * THE OBVIOUS IMPLEMENTATION IS WRONG, and it fails silently. Asking for
 * `${pkg}/package.json` looks like the direct question, but a package with an
 * `exports` map only answers for the subpaths it lists, and almost none of them
 * list `./package.json`. lucide-react-native stopped listing it in 0.544, so
 * `require.resolve('lucide-react-native/package.json')` throws
 * ERR_PACKAGE_PATH_NOT_EXPORTED for a package that is sitting right there,
 * installed — and this function used to answer "not installed", and every icon
 * in the app rendered as nothing. No error, no warning: just an app whose icons
 * had all quietly disappeared.
 *
 * So when the front door is bolted, come in through the entry point: resolve the
 * package's main module (which every `exports` map answers for) and walk up to
 * the directory whose package.json actually claims the name.
 */
function fromApp(pkg, projectRoot) {
  const req = createRequire(resolve(projectRoot, 'package.json'))

  try {
    return req.resolve(`${pkg}/package.json`)
  } catch {
    // Bolted, or genuinely absent. The next block tells the two apart.
  }

  try {
    // `<root>/dist/cjs/lucide-react-native.js` → walk up looking for the root.
    let dir = dirname(req.resolve(pkg))
    for (let i = 0; i < 12; i++) {
      const candidate = resolve(dir, 'package.json')
      if (existsSync(candidate) && named(candidate) === pkg) return candidate
      const up = dirname(dir)
      if (up === dir) break
      dir = up
    }
  } catch {
    // Not installed at all.
  }

  return null
}

/** The `name` a package.json claims, or null if it is unreadable or nameless. */
function named(pkgJson) {
  try {
    return JSON.parse(readFileSync(pkgJson, 'utf8')).name ?? null
  } catch {
    return null
  }
}

/**
 * The modules a browser cannot provide. Each stub returns the state of a phone
 * that is unlocked, located, online and permitted — so location-gated screens
 * render their granted path instead of a permission prompt.
 */
function nativeAliases() {
  return {
    // Not react-native-web directly: the shim re-exports all of it and adds the
    // one prop it is missing (adjustsFontSizeToFit). See stubs/react-native.tsx.
    'react-native': stub('react-native.tsx'),
    'expo-router': stub('expo-router.tsx'),
    'expo-router/unstable-native-tabs': stub('native-tabs.tsx'),
    'expo-location': stub('expo-location.ts'),
    'expo-secure-store': stub('expo-secure-store.ts'),
    'expo-haptics': stub('expo-haptics.ts'),
    'expo-clipboard': stub('expo-clipboard.ts'),
    'expo-crypto': stub('expo-crypto.ts'),
    'expo-device': stub('expo-device.ts'),
    'expo-localization': stub('expo-localization.ts'),
    'expo-notifications': stub('expo-notifications.ts'),
    'expo-task-manager': stub('expo-task-manager.ts'),
    'expo-status-bar': stub('expo-status-bar.ts'),
    'expo-constants': stub('expo-constants.ts'),
    'expo-image': stub('expo-image.tsx'),
    'expo-image-picker': stub('noop.ts'),
    '@expo/vector-icons': stub('vector-icons.tsx'),
    'react-native-webview': stub('webview.tsx'),
    '@react-native-community/datetimepicker': stub('datetimepicker.tsx'),
    'react-native-screens': stub('noop.ts'),
    'expo-file-system': stub('noop.ts'),
    'expo-web-browser': stub('noop.ts'),
    'expo-linking': stub('noop.ts'),
    'react-native-iap': stub('react-native-iap.ts'),
    'react-native-reanimated': stub('reanimated.ts'),
    'react-native-gesture-handler': stub('gesture-handler.ts'),
    'react-native-safe-area-context': stub('safe-area.ts'),
    '@react-native-async-storage/async-storage': stub('async-storage.ts'),
    '@shopify/flash-list': stub('flash-list.ts'),

    // Draws on a GPU canvas, or through a native view. Neither exists here, and
    // each one reaches for a `react-native/Libraries/…` internal on the way in —
    // which is a resolve error against the *stub's own filename*, and takes the
    // whole bundle with it. See rnSubpath().
    '@shopify/react-native-skia': stub('skia.tsx'),
    'react-native-fast-confetti': stub('fast-confetti.tsx'),
    'react-native-android-widget': stub('android-widget.tsx'),
    'react-native-maps': stub('maps.tsx'),

    // Local data, which the mock backend cannot reach: read expo-sqlite.ts
    // before you believe an empty list in a frame.
    'expo-sqlite': stub('expo-sqlite.ts'),

    // The apps that are not expo-router apps. Their screens are ordinary
    // components that happen to call hooks which throw outside a navigator.
    '@react-navigation/native': stub('react-navigation.tsx'),
    '@react-navigation/elements': stub('react-navigation-elements.tsx'),
    '@react-navigation/native-stack': stub('react-navigation-navigators.tsx'),
    '@react-navigation/stack': stub('react-navigation-navigators.tsx'),
    '@react-navigation/bottom-tabs': stub('react-navigation-navigators.tsx'),
    '@react-navigation/drawer': stub('react-navigation-navigators.tsx'),
    '@react-navigation/material-top-tabs': stub('react-navigation-navigators.tsx'),
  }
}

/**
 * `react-native/Libraries/…`, short-circuited.
 *
 * `react-native` is aliased to a *file*, and esbuild rewrites an alias by
 * prefix — so `react-native/Libraries/Image/AssetRegistry` becomes
 * `…/stubs/react-native.tsx/Libraries/Image/AssetRegistry`, a path under a
 * filename, which cannot resolve and never could. The error names the tool's own
 * stub, so it reads like a broken install rather than what it is: a native
 * package asking for an RN internal.
 *
 * A plugin's onResolve runs ahead of the alias, so catching the subpath here is
 * what keeps one such import from ending the run. This is the general case of
 * section B in the FamMedley report — Skia, maps, and every new-architecture
 * package that ships a codegen'd native view fail this exact way.
 */
function rnSubpath() {
  return {
    name: 'shots-rn-subpath',
    setup(b) {
      b.onResolve({ filter: /^react-native\// }, () => ({ path: stub('rn-internal.ts') }))
    },
  }
}

/**
 * The entry point, written from the config: it imports each screen module the
 * config names and mounts the one the URL asks for, inside the app's own root
 * layout. Generated rather than hand-written because only the config knows which
 * screens exist.
 */
function entrySource(config, projectRoot) {
  const rel = (p) => JSON.stringify(isAbsolute(p) ? p : resolve(projectRoot, p))
  const imports = config.screens
    .map((s, i) => `import Screen${i} from ${rel(s.module)}`)
    .join('\n')

  const entries = config.screens
    .map(
      (s, i) => `  ${JSON.stringify(s.id)}: {
    route: ${JSON.stringify(s.route ?? s.id)},
    component: Screen${i},
    params: ${JSON.stringify(s.params ?? {})},
    back: ${Boolean(s.back)},
    tab: ${s.tab ? JSON.stringify(s.tab) : 'undefined'},
    title: ${s.title ? JSON.stringify(s.title) : 'undefined'},
    header: ${s.header === undefined ? (s.title ? 'true' : 'undefined') : String(Boolean(s.header))},
    scroll: ${JSON.stringify(s.scroll ?? 'top')},
  },`,
    )
    .join('\n')

  // `setup` is imported FIRST, and that is not cosmetic: ES modules evaluate in
  // import order, so anything it does at module scope — patching a service,
  // seeding a store — happens before a screen module's own top-level code runs.
  const setup = config.setup
    ? `import * as __setup from ${rel(config.setup)}`
    : 'const __setup = {}'

  return `import { createRoot } from 'react-dom/client'
import { View } from 'react-native'
${setup}
import RootLayout from ${rel(config.rootLayout)}
import { setTarget } from ${JSON.stringify(stub('expo-router.tsx'))}
import { setInsets, setListScroll, TAB_BAR_HEIGHT } from ${JSON.stringify(stub('runtime.ts'))}
import { TabBar } from ${JSON.stringify(resolve(here, 'TabBar.tsx'))}
${imports}

const SHOTS = {
${entries}
}

const q = new URLSearchParams(location.search)
const shot = SHOTS[q.get('screen')]
if (!shot) throw new Error('unknown screen: ' + q.get('screen'))

const top = Number(q.get('top') || 0)
const safeBottom = Number(q.get('bottom') || 0)

// The tab bar is an overlay here but takes layout space on a device, so a screen
// that sits under one is inset above it — otherwise a FAB or a paginator lands
// beneath the bar in the frame and the only fix is to delete the feature.
const bottom = shot.tab ? Math.max(safeBottom, TAB_BAR_HEIGHT) : safeBottom

setInsets({ top, bottom, left: 0, right: 0 })
setListScroll(shot.scroll)
setTarget(shot)

// The chrome this tool draws, in page coordinates — so the verify pass can tell
// when the app's own content is hiding underneath it.
window.__SHOTS_ZONES__ = [
  { name: 'status bar', top: 0, bottom: top },
  ...(shot.tab
    ? [{ name: 'tab bar', top: window.innerHeight - TAB_BAR_HEIGHT, bottom: window.innerHeight }]
    : []),
]

function App() {
  return (
    <View style={{ flex: 1 }}>
      <RootLayout />
      {shot.tab ? <TabBar active={shot.tab} /> : null}
    </View>
  )
}

const mount = () => createRoot(document.getElementById('root')).render(<App />)

// \`config.setup\` runs before the first render, and is awaited: seeding a store
// is usually async, and a screen that mounts before its data lands photographs
// the skeleton it would have shown for one frame on a device.
//
// A setup that throws must not degrade into a blank frame — that is the one
// thing this tool must never hand back — so the failure is rethrown where the
// page can see it, which is what the run reports as a screen that did not
// render.
Promise.resolve()
  .then(() => (typeof __setup.default === 'function' ? __setup.default(window.__SHOTS__) : undefined))
  .then(mount)
  .catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
`
}

export async function bundle(config) {
  const projectRoot = config.projectRoot
  const work = config.workDir

  await mkdir(work, { recursive: true })
  const entryFile = resolve(work, 'entry.tsx')
  await writeFile(entryFile, entrySource(config, projectRoot))

  const warnings = []

  // The user's stubs are NOT merged here — they are applied last, at the bottom
  // of this function, after every internal alias has had its say. See the note
  // there: merging them at the top is how a config silently loses an argument
  // with the tool.
  const alias = { ...nativeAliases() }

  const own = createRequire(import.meta.url)

  // esbuild resolves an alias *target* from the working directory, and aliases
  // do not chain — so `react-native` → `react-native-web` is a bare specifier
  // that must be findable from the app being photographed. Handing esbuild this
  // tool's own node_modules as a nodePath is what makes that true, and it is
  // what keeps the web-only packages (react-native-web, react-dom) the tool's
  // problem rather than the app's: an Expo app should not have to install DOM
  // packages, where Metro can trip over them, just to be screenshotted.
  const nodePaths = [
    nodeModulesOf(own.resolve('react-native-web/package.json'), 'react-native-web'),
    resolve(here, '..', 'node_modules'),
  ].filter((d, i, all) => existsSync(d) && all.indexOf(d) === i)

  const appReact = fromApp('react', projectRoot)
  const appReactDom = fromApp('react-dom', projectRoot)
  const ownReact = own.resolve('react/package.json')

  const ownReactDom = own.resolve('react-dom/package.json')

  const pick = pickReact({
    app: appReact && (await version(appReact)),
    appDom: appReactDom && (await version(appReactDom)),
    own: await version(ownReact),
    ownDom: await version(ownReactDom),
  })

  if (pick.error) throw new Error(pick.error)

  if (pick.from === 'app') {
    alias.react = dirname(appReact)
    alias['react-dom'] = dirname(appReactDom)
    alias['react-dom/client'] = resolve(dirname(appReactDom), 'client.js')
  } else {
    alias.react = dirname(ownReact)
    alias['react-dom'] = dirname(own.resolve('react-dom/package.json'))
    alias['react-dom/client'] = own.resolve('react-dom/client')
  }

  // The tab bar wants lucide; if the app doesn't have it, fall back to labels.
  const lucide = fromApp('lucide-react-native', projectRoot)
  alias['lucide-react-native'] = lucide ? dirname(lucide) : stub('lucide-empty.ts')

  // FALLING BACK TO THE EMPTY STUB IS A LOUD EVENT, NOT A QUIET ONE.
  //
  // When the app has no lucide at all, this is exactly right and always was: the
  // tab bar draws labels, and nothing is lost. But when the app *does* depend on
  // lucide and it still could not be resolved, the same silent fallback deletes
  // every icon in the app — not just the tab bar's — and the run says nothing at
  // all. Twenty-four frames of an app with no icons, and the only way to notice
  // is to look. That is the worst failure this tool can have: it is invisible.
  if (!lucide && declares(projectRoot, 'lucide-react-native')) {
    warnings.push(
      `this app depends on lucide-react-native, but it could not be resolved from ` +
        `${projectRoot} — so EVERY lucide icon in these frames will render as nothing.\n` +
        `      Install it (npm install) and run again. If it is installed, this is a bug worth reporting.`,
    )
  }

  const svg = fromApp('react-native-svg', projectRoot)
  if (svg) alias['react-native-svg'] = dirname(svg)

  // Applied LAST, on purpose.
  //
  // These used to be merged at the top of the function, which read as harmless
  // and was not: every alias set since — react, react-dom, lucide,
  // react-native-svg — overwrote them. A config that stubbed lucide got the
  // tool's answer instead of its own, silently, and there was nothing to see.
  // The user's config is the last word about the user's app.
  for (const [from, to] of Object.entries(resolveExtraStubs(config, projectRoot))) {
    alias[from] = to
  }

  const tsconfig = resolve(projectRoot, config.tsconfig ?? 'tsconfig.json')

  const result = await build({
    entryPoints: [entryFile],
    bundle: true,
    outfile: resolve(work, 'app.js'),
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    jsx: 'automatic',
    alias,
    nodePaths,
    plugins: [rnSubpath(), redirectPlugin(config)],
    // `.web.js` first: this is how react-native-svg and friends ship their
    // browser implementations.
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    // An asset an app `require()`s has to have a loader or the bundle fails, and
    // the list of image formats an app might ship is not a thing this tool gets
    // to have an opinion about — `.webp` is just what Expo's own image tooling
    // emits now. `config.loaders` is the escape hatch for the rest (`.mp4`,
    // `.lottie`, `.riv`), because there will always be a next format.
    loader: {
      '.js': 'jsx',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.gif': 'dataurl',
      '.webp': 'dataurl',
      '.avif': 'dataurl',
      '.bmp': 'dataurl',
      '.svg': 'dataurl',
      '.ttf': 'dataurl',
      '.otf': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      ...(config.loaders ?? {}),
    },
    ...(existsSync(tsconfig) ? { tsconfig } : {}),
    define: {
      __DEV__: 'false',
      'process.env.NODE_ENV': '"production"',
      'process.env.EXPO_OS': '"ios"',
      ...Object.fromEntries(
        Object.entries(config.env ?? {}).map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)]),
      ),
    },
    logLevel: 'warning',
  })

  /**
   * esbuild's warnings are findings, not chatter — and the one that matters is
   * `import-is-undefined`.
   *
   * A stub that re-exports with `export *` cannot be checked statically, so a
   * name it does not have is not an error: esbuild shrugs, hands the app
   * `undefined`, and prints a warning nobody reads because the run says it
   * succeeded. Then `Notifications.setBadgeCountAsync(0).catch(…)` throws at the
   * *call* — before there is a `.catch` to catch it — and one screen photographs
   * as nothing for a reason that was on screen at bundle time.
   *
   * So they are collected and reported with everything else the run found.
   */
  for (const w of result.warnings) {
    const where = w.location ? ` (${w.location.file}:${w.location.line})` : ''
    warnings.push(`${w.text}${where}`)
  }

  await writeFile(resolve(work, 'index.html'), await html(config))
  return { entryFile, warnings }
}

/** Does the app's package.json name this dependency? Answers "installed?" vs "declared?". */
function declares(projectRoot, pkg) {
  try {
    const p = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
    return Boolean(p.dependencies?.[pkg] ?? p.devDependencies?.[pkg] ?? p.peerDependencies?.[pkg])
  } catch {
    return false
  }
}

/** User-declared replacements, e.g. a module that talks to the secure enclave. */
function resolveExtraStubs(config, projectRoot) {
  const out = {}
  for (const [from, to] of Object.entries(config.stubs ?? {})) {
    out[from] = isAbsolute(to) ? to : resolve(projectRoot, to)
  }
  return out
}

/**
 * Some modules are imported by *relative* path from several places (a keychain
 * wrapper, an analytics client), which an alias cannot catch. `config.redirect`
 * matches the tail of the import path instead.
 *
 * IT MATCHES WHAT THE IMPORT SAYS, NOT WHAT THE IMPORT REACHES.
 *
 * This is the whole of the trap, and the pattern always looks right. A rule
 * keyed on `InteractiveLineChart$` catches `import … from './InteractiveLineChart'`
 * and nothing else — so when the app reaches that component through a barrel
 * (`./components/performance`, which re-exports it with `export *`), the import
 * specifier esbuild sees is the *barrel's* path. The rule never fires, the
 * component is bundled anyway, and everything it drags in comes with it. The
 * redirect looks configured and is inert.
 *
 * `config.redirectFile` is the answer when that happens: it matches the resolved
 * path on disk, which a barrel cannot disguise. It costs a second resolve pass
 * for every import in the bundle, so it is only wired up when it is asked for.
 */
function redirectPlugin(config) {
  const at = (target) => (isAbsolute(target) ? target : resolve(config.projectRoot, target))
  const rules = Object.entries(config.redirect ?? {})
  const fileRules = Object.entries(config.redirectFile ?? {}).map(([p, t]) => [new RegExp(p), at(t)])

  return {
    name: 'shots-redirect',
    setup(b) {
      for (const [pattern, target] of rules) {
        const file = at(target)
        b.onResolve({ filter: new RegExp(pattern) }, () => ({ path: file }))
      }

      if (!fileRules.length) return

      // Resolve the import the way esbuild would, look at where it actually
      // landed, and only then decide. `RESOLVING` breaks the recursion: the
      // nested resolve re-enters this same callback, and without the guard it
      // would call itself forever.
      const RESOLVING = Symbol('shots-resolving')
      b.onResolve({ filter: /.*/ }, async (args) => {
        if (args.pluginData === RESOLVING) return null
        const found = await b.resolve(args.path, {
          importer: args.importer,
          resolveDir: args.resolveDir,
          kind: args.kind,
          pluginData: RESOLVING,
        })
        if (found.errors.length) return null
        for (const [pattern, file] of fileRules) {
          if (pattern.test(found.path)) return { path: file }
        }
        // null: let esbuild resolve it again, normally. Returning `found` here
        // would silently swallow the other plugins' say in it.
        return null
      })
    },
  }
}

async function html(config) {
  const font = await fontFace(config)
  const appFonts = await appFontFaces(config)
  const runtime = JSON.stringify({
    coords: config.runtime?.coords ?? { latitude: 52.3789, longitude: 4.9003, accuracy: 8 },
    locale: config.runtime?.locale ?? 'en-US',
    storage: config.runtime?.storage ?? {},
    secureStore: config.runtime?.secureStore ?? {},
    tabBar: config.tabBar ?? { items: [] },
    apiUrl: `http://127.0.0.1:${config.apiPort}`,
  })

  // With the app's own faces loaded, the screen is set in them and the shot is
  // the real thing. Without, everything falls back to one substituted face —
  // legible, but not the app, and something you then have to disclose.
  const fallback = config.frame?.fontFamily ?? 'Inter'
  const typeface = appFonts.length
    ? ''
    : `  * { font-family: '${fallback}', system-ui, sans-serif !important;
      -webkit-font-smoothing: antialiased; }`

  return `<!doctype html>
<meta charset="utf-8">
<title>shot</title>
<style>
${font}
${appFonts.map((f) => f.css).join('\n')}
  html, body, #root { height: 100%; margin: 0; padding: 0; overflow: hidden; }
  /* The app's root view is \`flex: 1\`, which only fills the screen if its parent
     is a flex container. Without this, short screens stop halfway down the page
     and anything pinned to the bottom (a chat composer) falls off it. */
  #root { display: flex; flex-direction: column; }
  body { font-family: '${appFonts[0]?.family ?? fallback}', system-ui, sans-serif;
         -webkit-font-smoothing: antialiased; }
${typeface}
</style>
<div id="root"></div>
<script>
  window.global = window;
  window.process = { env: { NODE_ENV: 'production' } };
  // The run's state, with this screen's overrides on top — which is how one
  // module gets photographed in several states.
  window.__SHOTS__ = Object.assign(${runtime}, window.__SHOTS_OVERRIDE__ || {});
</script>
<script src="/app.js"></script>
`
}

/**
 * The app's own typefaces.
 *
 * An Expo app loads its faces at runtime through expo-font, which does nothing
 * in a browser — so without this, every screen renders in a substituted face and
 * the frame is subtly not the app. Point `fonts` at the files the app already
 * ships and they are embedded as real @font-face rules, under the family name
 * the app's styles ask for.
 *
 *   fonts: { Lato: 'assets/fonts/Lato-Regular.ttf',
 *            'Lato-Black': 'assets/fonts/Lato-Black.ttf' }
 */
async function appFontFaces(config) {
  const entries = Object.entries(config.fonts ?? {})
  const out = []
  for (const [family, file] of entries) {
    const path = resolve(config.projectRoot, file)
    if (!existsSync(path)) {
      throw new Error(`config.fonts["${family}"] points at ${file}, which does not exist`)
    }
    out.push({ family, css: await faceFor(family, path) })
  }
  return out
}

async function faceFor(family, path) {
  const data = await readFile(path)
  const format = path.endsWith('.woff2') ? 'woff2' : path.endsWith('.woff') ? 'woff' : 'truetype'
  return `  @font-face {
    font-family: '${family}';
    font-display: block;
    src: url(data:font/${format};base64,${data.toString('base64')}) format('${format}');
  }`
}

/**
 * The device runs SF Pro (or Roboto), which cannot be redistributed and is not
 * on a Linux CI box. Inter stands in unless the config points at a real font
 * file — pass the app's own typeface here if it bundles one.
 */
async function fontFace(config) {
  const custom = config.frame?.fontFile
  const path = custom
    ? resolve(config.projectRoot, custom)
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
