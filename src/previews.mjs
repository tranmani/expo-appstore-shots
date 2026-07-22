/**
 * App-preview videos — the app in motion, from the app's own code.
 *
 * This is the thing no wrap-a-screenshot tool can do and the single most
 * underused asset on the store: a 15–30s recording of the real screens. Because
 * we already run the app under a browser, we can *drive* it — hold, scroll
 * through the content, settle — and record that, then hand it to a bundled ffmpeg
 * to come out at exactly the codec, size and length App Store Connect demands.
 *
 * A preview is NOT a framed screenshot. Apple wants the raw screen, full-bleed,
 * no bezel and no caption — so this records the app page directly at the device's
 * pixel size, and never touches compose.mjs.
 */
import { mkdir, rm, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/**
 * The ffmpeg binary: the bundled static build if it is installed (the tool ships
 * it, like it ships Chromium), otherwise whatever `ffmpeg` is on PATH. A clear
 * error beats a spawn failure nobody can read.
 */
export function ffmpegBin() {
  try {
    const bin = createRequire(import.meta.url)('ffmpeg-static')
    if (bin) return bin
  } catch {
    // not bundled — fall through to the system one
  }
  return 'ffmpeg'
}

/** ease-in-out, so the scroll starts and stops gently instead of jerking. */
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/**
 * Where the longest scrollable should sit at time `t` seconds into the tour:
 * held at the top for `holdS`, eased to the bottom over `scrollS`, held there.
 *
 * A pure function of time, so the frames are stepped through it deterministically
 * — two runs trace the exact same path — which the recordVideo approach could not
 * promise (its timing drifted, and it recorded at CSS pixels, not device pixels,
 * so a 1290-wide video was a 430-wide app in the corner of a grey canvas).
 */
export function scrollAt(t, { holdS, scrollS, max }) {
  if (t <= holdS) return 0
  if (t >= holdS + scrollS) return max
  return Math.round(max * ease((t - holdS) / scrollS))
}

/** Find the longest scrollable's scroll extent, in the page. */
export const MEASURE = `() => {
  const el = [...document.querySelectorAll('*')].filter((e) => {
    const s = getComputedStyle(e)
    return /auto|scroll/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1
  }).sort((a, b) => b.clientHeight - a.clientHeight)[0]
  if (!el) return { max: 0 }
  el.setAttribute('data-shots-scroller', '1')
  return { max: el.scrollHeight - el.clientHeight }
}`

/**
 * The ffmpeg arguments that turn a folder of device-pixel frames into an
 * App-Store-legal preview.
 *
 * The frames are already the exact device size and even-dimensioned, so there is
 * no scaling — every pixel is the one the browser rendered. The rest is
 * rejections avoided: `yuv420p` (Apple refuses alpha and 4:4:4), `libx264` high
 * profile, `+faststart` so it streams, `-an` (silent is allowed; a scroll tour
 * has nothing to say). Duration is the frame count over the fps, which the
 * recorder already clamped into the 15–30s window.
 */
export function frameSeqArgs(framesDir, output, fps) {
  return [
    '-y',
    '-framerate', String(fps),
    '-i', `${framesDir}/frame-%04d.png`,
    '-vf', 'format=yuv420p',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '20',
    '-profile:v', 'high',
    '-level', '4.2',
    '-pix_fmt', 'yuv420p',
    '-r', String(fps),
    '-movflags', '+faststart',
    '-an',
    output,
  ]
}

/** Total length of a preview, held inside Apple's 15–30s window. */
export function previewSeconds({ hold = 1.8, scrollSeconds = 14 } = {}) {
  return Math.min(30, Math.max(15, hold * 2 + scrollSeconds))
}

/**
 * Record every preview as a sequence of device-pixel frames, then encode.
 *
 * FRAMES, NOT A SCREEN RECORDING. Playwright's video is captured at CSS pixels
 * and padded (not scaled) into its target size — a 1290-wide video came out as a
 * 430-wide app in the corner of a grey canvas. Stepping the scroll through a
 * deterministic curve and screenshotting each frame gives the opposite: every
 * frame is the browser's real device-pixel output, sharp, and identical run to
 * run. A tour of ~17s at 30fps is ~510 screenshots — slow, but a preview is made
 * rarely, and the result is a store-grade video instead of an upscaled blur.
 *
 * `hold`/`scrollSeconds` default to a ~17s tour; a preview can override them.
 */
export async function recordPreviews({ browser, config, previews, port, outDir, workDir, ffmpeg = ffmpegBin() }) {
  await mkdir(outDir, { recursive: true })
  const fps = 30
  const written = []
  const problems = []

  for (const preview of previews) {
    const device = preview.device
    const holdS = preview.hold ?? 1.8
    const scrollS = preview.scrollSeconds ?? 14
    const totalS = previewSeconds(preview)
    const frameCount = Math.round(totalS * fps)

    const framesDir = resolve(workDir, `frames-${preview.id}`)
    await rm(framesDir, { force: true, recursive: true })
    await mkdir(framesDir, { recursive: true })

    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.scale,
      timezoneId: config.runtime?.timezone ?? 'UTC',
      locale: config.runtime?.locale ?? 'en-US',
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]))

    await page.emulateMedia({ colorScheme: preview.colorScheme ?? config.runtime?.colorScheme ?? 'light' })
    await page.addInitScript(`window.__SHOTS_OVERRIDE__ = ${JSON.stringify(preview.runtime ?? {})}`)
    if (config.runtime?.clock) {
      await page.addInitScript(`{
        const shift = ${new Date(config.runtime.clock).getTime()} - Date.now();
        const RealDate = Date;
        const now = () => RealDate.now() + shift;
        Date = class extends RealDate {
          constructor(...a) { super(...(a.length ? a : [now()])); }
          static now() { return now(); }
        };
        Date.UTC = RealDate.UTC; Date.parse = RealDate.parse;
      }`)
    }

    const url =
      `http://127.0.0.1:${port}/?screen=${encodeURIComponent(preview.screen)}` +
      `&top=${device.insets.top}&bottom=${device.insets.bottom}`
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(config.settleMs ?? 1500)

    const { max } = await page.evaluate(`(${MEASURE})()`)

    for (let i = 0; i < frameCount; i++) {
      const top = scrollAt(i / fps, { holdS, scrollS, max })
      await page.evaluate((y) => {
        const el = document.querySelector('[data-shots-scroller]')
        if (el) el.scrollTop = y
      }, top)
      await page.screenshot({ path: resolve(framesDir, `frame-${String(i).padStart(4, '0')}.png`) })
    }

    if (errors.length) problems.push(`${preview.id}: ${errors[0]}`)
    await page.close()
    await context.close()

    const out = resolve(outDir, preview.file ?? `${preview.id}.mp4`)
    await run(ffmpeg, frameSeqArgs(framesDir, out, fps))
    await rm(framesDir, { force: true, recursive: true })

    written.push({
      id: preview.id,
      file: out,
      device: device.id,
      deviceSize: device.size,
      seconds: frameCount / fps,
      bytes: (await stat(out)).size,
    })
  }

  return { written, problems }
}

/** Read a video's real shape back, for the run to check against the store spec. */
export async function probe(file, ffprobe) {
  const { stdout } = await run(ffprobe, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_name,pix_fmt,r_frame_rate:format=duration',
    '-of', 'json',
    file,
  ])
  const j = JSON.parse(stdout)
  const s = j.streams[0]
  const [num, den] = s.r_frame_rate.split('/').map(Number)
  return {
    width: s.width,
    height: s.height,
    codec: s.codec_name,
    pixFmt: s.pix_fmt,
    fps: den ? num / den : num,
    duration: Number(j.format.duration),
  }
}
