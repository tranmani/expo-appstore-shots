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
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const stub = (name) => resolve(here, 'stubs', name)

const major = (v) => Number(String(v).split('.')[0])

const version = async (pkgJson) => JSON.parse(await readFile(pkgJson, 'utf8')).version

/**
 * Which react / react-dom pair to bundle.
 *
 * They must be one copy each and the same major, or React throws #527 on the
 * first render and every screenshot comes out blank. Two traps make this less
 * obvious than it sounds:
 *
 *  - An Expo app usually has **no** react-dom at all (it never renders to a DOM).
 *  - A monorepo often has a *hoisted* react-dom that some unrelated tool pulled
 *    in, on a completely different major from the app's react. Resolving it and
 *    trusting it is exactly how you get a blank PNG.
 *
 * So the app's pair is used only when it is internally consistent; otherwise the
 * tool's own matched pair is, which is safe whenever the majors agree.
 */
export function pickReact({ app, appDom, own }) {
  if (appDom && app && major(appDom) === major(app)) return { from: 'app' }

  if (app && major(app) !== major(own)) {
    return {
      error:
        `This app is on React ${app} and expo-appstore-shots ships React ${own}.\n` +
        `Install a matching react-dom in the app and it will be used instead:\n\n` +
        `  npm install --save-dev react-dom@${major(app)}\n`,
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

/** Resolve a package from the *app's* node_modules, not this tool's. */
function fromApp(pkg, projectRoot) {
  try {
    return createRequire(resolve(projectRoot, 'package.json')).resolve(`${pkg}/package.json`)
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

  return `import { createRoot } from 'react-dom/client'
import { View } from 'react-native'
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

createRoot(document.getElementById('root')).render(<App />)
`
}

export async function bundle(config) {
  const projectRoot = config.projectRoot
  const work = config.workDir

  await mkdir(work, { recursive: true })
  const entryFile = resolve(work, 'entry.tsx')
  await writeFile(entryFile, entrySource(config, projectRoot))

  const alias = { ...nativeAliases(), ...resolveExtraStubs(config, projectRoot) }

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

  const pick = pickReact({
    app: appReact && (await version(appReact)),
    appDom: appReactDom && (await version(appReactDom)),
    own: await version(ownReact),
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

  const svg = fromApp('react-native-svg', projectRoot)
  if (svg) alias['react-native-svg'] = dirname(svg)

  const tsconfig = resolve(projectRoot, config.tsconfig ?? 'tsconfig.json')

  await build({
    entryPoints: [entryFile],
    bundle: true,
    outfile: resolve(work, 'app.js'),
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    jsx: 'automatic',
    alias,
    nodePaths,
    plugins: [redirectPlugin(config)],
    // `.web.js` first: this is how react-native-svg and friends ship their
    // browser implementations.
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    loader: {
      '.js': 'jsx',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.gif': 'dataurl',
      '.svg': 'dataurl',
      '.ttf': 'dataurl',
      '.otf': 'dataurl',
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

  await writeFile(resolve(work, 'index.html'), await html(config))
  return { entryFile }
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
 */
function redirectPlugin(config) {
  const rules = Object.entries(config.redirect ?? {})
  return {
    name: 'shots-redirect',
    setup(b) {
      for (const [pattern, target] of rules) {
        const file = isAbsolute(target) ? target : resolve(config.projectRoot, target)
        b.onResolve({ filter: new RegExp(pattern) }, () => ({ path: file }))
      }
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
