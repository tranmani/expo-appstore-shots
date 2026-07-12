/**
 * Read the app, and write down what it obviously contains.
 *
 * Filling the config by hand means reverse-engineering someone else's app: which
 * routes exist, what the tabs are, which endpoints the screens call, where the
 * session is kept. All of that is *in the repo* — expo-router puts the routes in
 * the filenames, the tabs layout names the tabs, and the fetch calls name the
 * endpoints. Guessing them is archaeology; reading them is a glob.
 *
 * Everything here is a first draft, and it says so. The scan cannot know which
 * five screens sell the app, and it does not pretend to.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/** expo-router's file conventions, as route ids. */
export function routeId(file) {
  const parts = file
    .replace(/\.[jt]sx?$/, '')
    .split('/')
    // (tabs) and (auth) are grouping folders: they organise files, not URLs.
    .filter((p) => !(p.startsWith('(') && p.endsWith(')')))

  const last = parts[parts.length - 1]
  if (last === 'index') parts.pop()
  if (!parts.length) return 'index'

  return parts
    .map((p) => p.replace(/^\[\.\.\.(.+)\]$/, '$1').replace(/^\[(.+)\]$/, '$1'))
    .join('-')
}

/** `[id].tsx` and `[...rest].tsx` are dynamic: they need a param to render. */
export function paramsOf(file) {
  const out = {}
  for (const m of file.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)) out[m[1]] = '1'
  return Object.keys(out).length ? out : undefined
}

/**
 * Which tab a route file belongs to, if any.
 *
 * `(tabs)/index.tsx` is the tab named "index" — the group folder is not its
 * parent for this purpose. `(tabs)/settings/index.tsx` is the tab "settings".
 * Getting this wrong drops the home tab, which is the one screen every app has.
 */
export function tabOf(file) {
  const parts = file.replace(/\.[jt]sx?$/, '').split('/')
  const group = parts.indexOf('(tabs)')
  if (group === -1) return null

  const after = parts.slice(group + 1)
  if (!after.length) return null
  // A directory tab: the folder is the tab, the index file is just its entry.
  if (after.length > 1 && after[after.length - 1] === 'index') return after[0]
  return after[0]
}

const IGNORE = new Set(['node_modules', '.git', '__tests__', 'components'])

/** Every route module under the app directory. */
export async function walk(dir, base = dir) {
  const out = []
  for (const name of await readdir(dir)) {
    if (IGNORE.has(name)) continue
    const path = join(dir, name)
    if ((await stat(path)).isDirectory()) {
      out.push(...(await walk(path, base)))
    } else if (/\.[jt]sx$/.test(name) && !name.startsWith('_') && !name.includes('.test.')) {
      out.push(relative(base, path).split('\\').join('/'))
    }
  }
  return out
}

/**
 * The tabs, from the tabs layout.
 *
 * Both spellings are read: expo-router's `<Tabs.Screen name= …>` and the native
 * `<NativeTabs.Trigger name= …>`. The label is guessed from the name, because a
 * label is a two-word edit and a missing tab is a rebuild.
 */
export function tabsFrom(source) {
  const items = []
  const seen = new Set()

  for (const m of source.matchAll(/<(?:Tabs|NativeTabs)\.(?:Screen|Trigger)[^>]*?\bname=["']([^"']+)["']/g)) {
    const id = m[1]
    if (seen.has(id)) continue
    seen.add(id)
    items.push({ id, label: title(id) })
  }
  return items
}

const title = (s) =>
  s
    .replace(/[-_/]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()

/**
 * The endpoints the app calls.
 *
 * Only the literal ones — a template with an interpolated id becomes a `:param`
 * route, which is what the fixture should be anyway. Anything built entirely at
 * runtime is invisible here, and the unfixtured-route report catches it on the
 * first run.
 */
export function endpointsFrom(source, prefix = '/api/') {
  const out = new Set()
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // The prefix is matched wherever it appears, not only at the start of a
  // string literal — because the way apps actually write this is
  // `${apiUrl}/api/rooms/${id}`, with a base URL in front of it.
  const re = new RegExp(`${esc}[^"'\`\\s),]*`, 'g')

  for (const m of source.matchAll(re)) {
    const path = m[0]
      // `${id}` in a template literal is a path parameter.
      .replace(/\$\{[^}]*\}/g, ':param')
      .split('?')[0]
      .replace(/\/+$/, '')
    if (path.length > prefix.length) out.add(path)
  }
  return [...out]
}

/** Read the app and draft a config for it. */
export async function scan(root, { appDir } = {}) {
  const dir = appDir ?? (await findAppDir(root))
  if (!dir) return null

  const files = await walk(dir)
  const rel = (f) => `${relative(root, join(dir, f)).split('\\').join('/')}`

  const layout = ['_layout.tsx', '_layout.jsx', '_layout.ts', '_layout.js']
    .map((f) => join(dir, f))
    .find((f) => existsSync(f))

  const tabsLayout = await findTabsLayout(dir)
  const tabBar = tabsLayout ? tabsFrom(await readFile(tabsLayout, 'utf8')) : []
  const tabIds = new Set(tabBar.map((t) => t.id))

  const screens = files.map((f) => {
    const id = routeId(f)
    const params = paramsOf(f)
    const tab = tabIds.has(tabOf(f)) ? tabOf(f) : undefined

    return {
      id,
      module: rel(f),
      ...(params ? { params } : {}),
      ...(tab ? { tab, title: title(id) } : {}),
    }
  })

  const endpoints = await endpointsIn(root)

  return {
    rootLayout: layout ? relative(root, layout).split('\\').join('/') : null,
    screens,
    tabBar: tabBar.length ? { items: tabBar } : null,
    endpoints,
  }
}

async function findAppDir(root) {
  for (const c of ['src/app', 'app']) {
    const dir = resolve(root, c)
    if (existsSync(dir)) return dir
  }
  return null
}

async function findTabsLayout(appDir) {
  for (const c of ['(tabs)/_layout.tsx', '(tabs)/_layout.jsx', '(tabs)/_layout.js']) {
    const f = join(appDir, c)
    if (existsSync(f)) return f
  }
  return null
}

/** Grep the source for API paths. Cheap, and it only has to be a first draft. */
async function endpointsIn(root) {
  const dirs = ['src', 'app', 'lib', 'api'].map((d) => resolve(root, d)).filter((d) => existsSync(d))
  const found = new Set()

  for (const dir of dirs) {
    for (const file of await walkAll(dir)) {
      const source = await readFile(file, 'utf8')
      for (const e of endpointsFrom(source)) found.add(e)
    }
  }
  return [...found].sort()
}

async function walkAll(dir) {
  const out = []
  for (const name of await readdir(dir)) {
    if (IGNORE.has(name)) continue
    const path = join(dir, name)
    if ((await stat(path)).isDirectory()) out.push(...(await walkAll(path)))
    else if (/\.[jt]sx?$/.test(name)) out.push(path)
  }
  return out
}
