/**
 * The live preview loop — their iterate-in-a-browser feel, without giving up
 * config-as-truth.
 *
 * The competitor's whole delivery model is a WYSIWYG editor: you drag things in a
 * browser and the browser IS the source of truth. Ours is the opposite — the
 * config file is the truth, the output is reproducible from it, and CI renders it
 * headless. The risk in adding a preview is that it becomes a second, drifting
 * source of truth: a canvas that looks right but renders differently than the
 * real compositor.
 *
 * We sidestep that by construction. The preview does not re-implement anything —
 * it calls the SAME `compose()` the CLI calls, into a temp dir, and serves those
 * exact PNGs. So "does the preview match the headless output" is not a property we
 * have to test; it is the same function. The only thing the browser adds is a
 * refresh: edit `shots.config.mjs`, save, and the frames you would have shot are
 * on screen a second later.
 *
 * What live-reloads is the COMPOSITION — captions, themes, layouts, elements,
 * grounds: everything downstream of the raw screens. Changing which screens are
 * shot, or the app code itself, still needs a restart (the raws are captured once
 * up front, like a normal run), and the page says so rather than lying.
 */
import { createServer } from 'node:http'
import { watch as fsWatch } from 'node:fs'
import { stat, readdir, readFile } from 'node:fs/promises'
import { resolve, join, relative, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compose } from './compose.mjs'
import { resolveDevices } from './devices.mjs'
import { normalise, ConfigError } from './config.mjs'

const MIME = { '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' }

/**
 * Re-read the config from disk, defeating the ESM module cache.
 *
 * `import()` caches by URL, so importing the same path twice returns the FIRST
 * version forever — exactly wrong for a file we expect to change. A `?t=<mtime>`
 * query makes each save a distinct URL, so a saved edit is actually re-read. The
 * mtime (not a counter) means an unchanged file re-uses the cache, and it is
 * stable across a resume.
 */
async function reload(configPath) {
  const { mtimeMs } = await stat(configPath)
  const mod = await import(`${pathToFileURL(configPath).href}?t=${mtimeMs}`)
  return normalise(mod.default, configPath)
}

/** Every composed PNG under the preview dir, grouped by device folder. */
async function listFrames(previewDir) {
  const out = []
  let devices
  try {
    devices = await readdir(previewDir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const d of devices) {
    if (!d.isDirectory()) continue
    const files = (await readdir(join(previewDir, d.name)))
      .filter((f) => extname(f) === '.png')
      .sort()
    if (files.length) out.push({ device: d.name, files })
  }
  return out
}

/**
 * Serve a live-composing preview of the current config.
 *
 * The caller owns the expensive, once-per-run spine — bundle, mock backend,
 * browser, and the captured raws — and hands them in. This function owns the
 * cheap, repeatable half: compose the deck, serve it, and recompose whenever the
 * config file changes. It never returns; the process runs until interrupted.
 *
 * @param {object}  o
 * @param {object}  o.config        the already-normalised config (initial state)
 * @param {string}  o.configPath    the config file to watch
 * @param {object}  o.browser       a live Playwright browser (compose opens pages)
 * @param {string}  o.rawDir        where the captured raw screens live
 * @param {string}  o.previewDir    where composed preview frames are written
 * @param {(config: object) => Promise<string>} o.fontCss  recomputes the @font-face
 * @param {number}  [o.port]        preferred http port (default 4600)
 * @param {(url: string) => void} [o.onReady]  called once the server is listening
 */
export async function serveWatch({ config, configPath, browser, rawDir, previewDir, fontCss, port = 4600, onReady }) {
  const clients = new Set() // open SSE responses
  let state = { at: 0, error: null } // last compose outcome, surfaced to the page

  // Recompose the whole deck from the current config into previewDir. Never
  // throws: a bad config (or a device whose raw was never captured) becomes an
  // on-page error instead of a dead server, because the whole point is to edit
  // toward a working config while watching.
  async function recompose(current) {
    try {
      const { chosen } = resolveDevices(current.devices)
      await compose({ browser, config: current, devices: chosen, fontCss: await fontCss(current), rawDir, outDir: previewDir })
      state = { at: state.at + 1, error: null }
    } catch (e) {
      state = { at: state.at + 1, error: e instanceof ConfigError ? e.message : (e?.message ?? String(e)) }
    }
    for (const res of clients) res.write(`data: ${state.at}\n\n`)
  }

  await recompose(config)

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')

    if (url.pathname === '/sse') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
      res.write(`data: ${state.at}\n\n`)
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }

    if (url.pathname === '/list') {
      const frames = await listFrames(previewDir)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ at: state.at, error: state.error, frames }))
      return
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'content-type': MIME['.html'] })
      res.end(PAGE)
      return
    }

    // A composed frame: /f/<device>/<file>. Confined to previewDir so a crafted
    // path cannot read outside it.
    if (url.pathname.startsWith('/f/')) {
      const rel = decodeURIComponent(url.pathname.slice(3))
      const file = resolve(previewDir, rel)
      if (relative(previewDir, file).startsWith('..')) {
        res.writeHead(403).end()
        return
      }
      try {
        const body = await readFile(file)
        res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
        res.end(body)
      } catch {
        res.writeHead(404).end()
      }
      return
    }

    res.writeHead(404).end()
  })

  // Watch the config file. Editors save via atomic rename as often as in-place
  // writes, so a single fs.watch can miss events — debounce and re-stat rather
  // than trusting the event. Recompose reloads the config itself.
  let timer = null
  const onChange = () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      try {
        const next = await reload(configPath)
        await recompose(next)
      } catch (e) {
        state = { at: state.at + 1, error: e instanceof ConfigError ? e.message : (e?.message ?? String(e)) }
        for (const res of clients) res.write(`data: ${state.at}\n\n`)
      }
    }, 120)
  }
  try {
    fsWatch(configPath, onChange)
  } catch {
    // Some platforms cannot watch a single file; fall back to watching its dir.
    fsWatch(resolve(configPath, '..'), (_e, name) => {
      if (name && configPath.endsWith(name)) onChange()
    })
  }

  await new Promise((ok, no) => {
    server.on('error', no)
    server.listen(port, () => ok())
  })
  const address = `http://localhost:${server.address().port}`
  onReady?.(address)
  // Never resolves: the CLI process lives until the user interrupts it.
  await new Promise(() => {})
}

/**
 * The preview page. One self-contained document — no build step, no framework,
 * no external fetch — that lists the composed frames and re-fetches them whenever
 * the server signals a recompose over SSE. A config error is shown as a banner
 * instead of a blank screen, because you reach broken states on the way to good
 * ones and the page has to stay useful there.
 */
const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>expo-appstore-shots — live preview</title>
<style>
  :root { color-scheme: light dark; --bg:#f4f3f0; --fg:#181a17; --muted:#676f6d; --card:#fff; --line:#e2e0d9; --err:#b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg:#14161b; --fg:#f4f3f0; --muted:#9aa2a0; --card:#1c1f26; --line:#2a2e37; --err:#f97066; } }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--fg); }
  header { position:sticky; top:0; display:flex; align-items:center; gap:.6rem; padding:.7rem 1rem; background:var(--bg); border-bottom:1px solid var(--line); z-index:2; }
  header b { font-weight:700; } header .dot { width:.55rem; height:.55rem; border-radius:50%; background:#12b76a; box-shadow:0 0 0 3px color-mix(in srgb,#12b76a 25%,transparent); }
  header .muted { color:var(--muted); }
  .err { margin:1rem; padding:.8rem 1rem; border:1px solid var(--err); border-radius:.5rem; color:var(--err); white-space:pre-wrap; font-family:ui-monospace,monospace; font-size:13px; }
  main { padding:1rem; }
  section { margin-bottom:1.6rem; }
  h2 { font-size:.8rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:0 0 .7rem; }
  .row { display:flex; gap:1rem; overflow-x:auto; padding-bottom:.5rem; }
  figure { margin:0; flex:0 0 auto; }
  figure img { display:block; height:60vh; max-height:640px; width:auto; border:1px solid var(--line); border-radius:.6rem; background:var(--card); }
  figure figcaption { margin-top:.4rem; color:var(--muted); font-size:12px; }
</style></head><body>
<header><span class="dot"></span><b>live preview</b><span class="muted" id="status">connecting…</span></header>
<div id="err" class="err" hidden></div>
<main id="main"></main>
<script>
  const main = document.getElementById('main'), errBox = document.getElementById('err'), status = document.getElementById('status')
  async function render() {
    const r = await fetch('/list').then((x) => x.json())
    errBox.hidden = !r.error
    if (r.error) errBox.textContent = 'config error — fix and save:\\n\\n' + r.error
    const bust = '?t=' + r.at
    main.innerHTML = r.frames.map((g) =>
      '<section><h2>' + g.device + '</h2><div class="row">' +
      g.files.map((f) =>
        '<figure><img loading="lazy" src="/f/' + encodeURIComponent(g.device + '/' + f) + bust + '">' +
        '<figcaption>' + f + '</figcaption></figure>').join('') +
      '</div></section>').join('') || '<p class="muted">no frames yet</p>'
    status.textContent = 'edit shots.config.mjs — saves render live'
  }
  const es = new EventSource('/sse')
  es.onmessage = render
  es.onerror = () => { status.textContent = 'reconnecting…' }
  render()
</script>
</body></html>`
