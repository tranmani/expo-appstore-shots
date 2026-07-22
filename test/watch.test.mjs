/**
 * Phase 5: the live preview loop.
 *
 * The server itself needs a browser and a running app, so it is exercised by the
 * e2e run, not here. What these guard are the two pure pieces the loop stands on
 * and that fail silently: reloading a *changed* config past the ESM module cache
 * (without the cache-bust, "see it live" shows the first version forever), and
 * enumerating the composed frames the page renders.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reload, listFrames } from '../src/watch.mjs'

test('reload re-reads a CHANGED config past the ESM import cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shots-watch-'))
  const cfg = join(dir, 'shots.config.mjs')
  const write = (headline) =>
    writeFile(
      cfg,
      `export default {
        rootLayout: 'src/app/_layout.tsx',
        screens: [{ id: 'a', module: 'a.tsx' }],
        slides: [{ screen: 'a', headline: ${JSON.stringify(headline)} }],
      }`,
    )

  try {
    await write('First')
    const one = await reload(cfg)
    assert.equal(one.slides[0].headline, 'First')

    // Rewrite the SAME path with new content. A plain import() would hand back the
    // cached 'First' — the whole bug the mtime cache-bust exists to prevent.
    await write('Second')
    const two = await reload(cfg)
    assert.equal(two.slides[0].headline, 'Second', 'a saved edit is actually re-read')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('listFrames groups PNGs by device folder, sorted, ignoring non-PNGs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shots-frames-'))
  try {
    await mkdir(join(dir, '6.9'), { recursive: true })
    await mkdir(join(dir, '6.3'), { recursive: true })
    // Written out of order; listFrames must sort within a device.
    await writeFile(join(dir, '6.9', '02-b.png'), '')
    await writeFile(join(dir, '6.9', '01-a.png'), '')
    await writeFile(join(dir, '6.9', 'notes.txt'), '') // ignored
    await writeFile(join(dir, '6.3', '01-a.png'), '')

    const frames = await listFrames(dir)
    const byDevice = Object.fromEntries(frames.map((g) => [g.device, g.files]))
    assert.deepEqual(byDevice['6.9'], ['01-a.png', '02-b.png'], 'sorted, txt dropped')
    assert.deepEqual(byDevice['6.3'], ['01-a.png'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('listFrames on a missing dir is empty, not a throw', async () => {
  assert.deepEqual(await listFrames(join(tmpdir(), 'shots-nope-does-not-exist')), [])
})

test('listFrames recurses into variant folders and labels them by path', async () => {
  // A variant config writes <variant>/<device>/NN.png — one level deeper than a
  // plain deck. The group label is the path relative to the preview root.
  const dir = await mkdtemp(join(tmpdir(), 'shots-variants-'))
  try {
    await mkdir(join(dir, 'A-default', '6.9'), { recursive: true })
    await mkdir(join(dir, 'B-ocean', '6.9'), { recursive: true })
    await writeFile(join(dir, 'A-default', '6.9', '01-a.png'), '')
    await writeFile(join(dir, 'B-ocean', '6.9', '01-a.png'), '')

    const labels = (await listFrames(dir)).map((g) => g.device)
    assert.deepEqual(labels, ['A-default/6.9', 'B-ocean/6.9'], 'each variant deck listed under its own path')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
