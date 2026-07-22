/**
 * Phase 6: app-preview videos — the exceed feature.
 *
 * The recording itself needs a browser and ~90s, so it is validated by hand on a
 * real app; these lock the parts that decide whether App Store Connect ACCEPTS
 * the result — the scroll curve (deterministic), the duration window, and the
 * ffmpeg flags that keep the codec/pixel-format legal. A regression in any of
 * those is a rejected upload, which is exactly what a person cannot see by
 * watching the video.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scrollAt, previewSeconds, frameSeqArgs, ffmpegBin } from '../src/previews.mjs'
import { normalise, ConfigError } from '../src/config.mjs'

test('the scroll curve holds, eases, and settles — deterministically', () => {
  const p = { holdS: 2, scrollS: 10, max: 1000 }
  assert.equal(scrollAt(0, p), 0, 'starts at the top')
  assert.equal(scrollAt(1.9, p), 0, 'held at the top through the opening hold')
  assert.equal(scrollAt(12, p), 1000, 'reaches the bottom')
  assert.equal(scrollAt(20, p), 1000, 'stays at the bottom through the closing hold')
  const mid = scrollAt(7, p) // halfway through the scroll → ~half, by the ease
  assert.ok(mid > 400 && mid < 600, `midpoint ${mid} should be near half`)
  // Pure function of time: same inputs, same output, forever.
  assert.equal(scrollAt(7, p), scrollAt(7, p))
  // A screen with nothing to scroll never moves.
  assert.equal(scrollAt(7, { holdS: 2, scrollS: 10, max: 0 }), 0)
})

test('a preview is always inside Apple’s 15–30s window', () => {
  assert.equal(previewSeconds({ hold: 1.8, scrollSeconds: 14 }), 17.6)
  assert.equal(previewSeconds({ hold: 1, scrollSeconds: 2 }), 15, 'a short tour is padded up to 15s')
  assert.equal(previewSeconds({ hold: 5, scrollSeconds: 40 }), 30, 'a long tour is capped at 30s')
})

test('the ffmpeg args produce an App-Store-legal encode', () => {
  const a = frameSeqArgs('/frames', '/out.mp4', 30).join(' ')
  assert.match(a, /-c:v libx264/, 'must be H.264')
  assert.match(a, /-pix_fmt yuv420p/, 'must be yuv420p (Apple refuses alpha/4:4:4)')
  assert.match(a, /-profile:v high/)
  assert.match(a, /-movflags \+faststart/, 'must stream')
  assert.match(a, /-framerate 30/, 'reads the frames at 30fps')
  assert.match(a, /frame-%04d\.png/, 'reads the zero-padded frame sequence')
})

test('the bundled ffmpeg is found, not left to the system PATH', () => {
  // The tool ships its own encoder, like it ships Chromium — so a user with no
  // system ffmpeg still gets video. If this ever falls back to bare "ffmpeg",
  // the bundling regressed.
  assert.match(ffmpegBin(), /ffmpeg-static/, 'should resolve the bundled static binary')
})

test('previews are validated at config time — screen and device must be real', () => {
  const base = { rootLayout: 'a', screens: [{ id: 'home', module: 'h.tsx' }] }
  const ok = normalise({ ...base, previews: [{ id: 'p', screen: 'home', device: 'iphone-6.9' }] }, '/app/c.mjs')
  assert.match(ok.previewDir, /appstore\/previews$/, 'previewDir has a sensible default')
  assert.throws(() => normalise({ ...base, previews: [{ id: 'p', screen: 'ghost' }] }, '/app/c.mjs'), ConfigError)
  assert.throws(
    () => normalise({ ...base, previews: [{ id: 'p', screen: 'home', device: 'nope' }] }, '/app/c.mjs'),
    /unknown device/,
  )
})
