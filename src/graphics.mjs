/**
 * Store graphics: the listing artwork that is not a screenshot.
 *
 * The stores ask for more than screens. Play wants a 512×512 icon and a 1024×500
 * feature graphic before it will let you publish; App Store Connect wants a 1024×1024
 * marketing icon. These are the assets people open a drawing program for, and they are
 * the assets that end up in a different green from the app, with a different typeface,
 * because they were drawn somewhere the app's own tokens do not reach.
 *
 * They are made here for the same reason the frames are: the app already contains the
 * answer. The icon is `assets/icon.png`. The brand ground and the platform-dot texture
 * are the ones the frames use. The typeface is the one the frames set. Nothing is
 * redrawn, so nothing can drift.
 *
 * WHAT THE STORES ACTUALLY REJECT, which is most of what this file is about:
 *
 *  - **An alpha channel.** Chromium always writes one; App Store Connect refuses it
 *    outright and Play composites it against an unpredictable background. Every target
 *    here is opaque and the channel is dropped, not flattened.
 *  - **The wrong pixel size.** Off by one and the upload is refused. The page is
 *    screenshotted at the exact slot size — no resampling, no rounding.
 *  - **Bytes.** The Play icon has a 1 MB ceiling that a 512×512 PNG can genuinely hit.
 *
 * And the two that nothing rejects, which is worse, because you find out from the
 * listing:
 *
 *  - The feature graphic is **cropped** to other aspect ratios in placements you do not
 *    choose. Anything near an edge can be cut off.
 *  - If the listing has a promo video, Play draws **a play button over the centre** of
 *    the feature graphic. Centring the logo is the natural thing to do and it is exactly
 *    wrong when there is a video.
 *
 * Both are geometry, both are checkable, and both are checked — against the real boxes,
 * measured in the page after layout, not against what the layout was supposed to do.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { PNG } from 'pngjs'
import { stripAlpha } from './compose.mjs'

const MB = 1024 * 1024

/**
 * What each store asks for. Sizes and ceilings are the stores' own; `mask` is what the
 * store does to the art afterwards, which is the part that decides how much padding the
 * source icon needs.
 */
export const TARGETS = {
  'play-icon': {
    label: 'Play Store icon',
    file: 'play-icon-512.png',
    size: [512, 512],
    maxBytes: 1 * MB,
    kind: 'icon',
    // Play masks the icon itself — historically to a rounded square, today to whatever
    // shape the launcher and the storefront feel like. The art is full-bleed square and
    // the corners are not ours to round: a pre-rounded icon gets rounded twice and ends
    // up with pale wedges in its corners.
    mask: 'rounded square, applied by the store — supply full-bleed square art',
  },
  'ios-marketing': {
    label: 'App Store marketing icon',
    file: 'ios-marketing-1024.png',
    size: [1024, 1024],
    maxBytes: 15 * MB,
    kind: 'icon',
    mask: 'squircle, applied by the store — supply full-bleed square art',
  },
  'play-feature': {
    label: 'Play Store feature graphic',
    file: 'play-feature-1024x500.png',
    size: [1024, 500],
    maxBytes: 15 * MB,
    kind: 'feature',
    mask: null,
  },
}

/** Everything outside this is at the mercy of a crop the store chooses. */
const EDGE_SAFE = 0.06

/** Where Play puts the play button when the listing has a promo video. */
const PLAY_BUTTON_R = 0.19

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

async function dataUri(path) {
  const ext = extname(path).toLowerCase()
  const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
  return `data:${mime};base64,${(await readFile(path)).toString('base64')}`
}

/**
 * The icon, at the size the store wants it.
 *
 * Deliberately not a redraw. The source is the app's own icon — the one on the home
 * screen, the one people will match the listing against — and the only things done to it
 * are a resize and an opaque ground. `padding` exists for the app whose icon art is a
 * bare mark rather than a finished tile; left at 0, which is right for anything Expo has
 * already built an icon from, the source lands full-bleed.
 */
function iconHtml({ spec, icon, g, fontCss }) {
  const [W, H] = spec.size
  const pad = Math.round(W * (g.iconPadding ?? 0))
  return `<!doctype html>
<meta charset="utf-8">
<style>
${fontCss}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden;
    background: ${g.iconBackground ?? g.background};
    display: flex; align-items: center; justify-content: center;
  }
  img { width: ${W - pad * 2}px; height: ${H - pad * 2}px; object-fit: contain; display: block; }
</style>
<img src="${icon}">
`
}

/**
 * The feature graphic: the mark, the name, and one line about what the app is.
 *
 * A lockup rather than a scene, because this image is shown at every size from a
 * thumbnail to a banner, and it is cropped. Something that survives that is worth more
 * than something that looks better at exactly 1024×500 and nowhere else.
 */
function featureHtml({ spec, mark, markIsTile, g, fontCss }) {
  const [W, H] = spec.size
  const dots = g.dots === false ? '' : `
    background-image: radial-gradient(${g.dot} ${Math.max(1.5, W / 700)}px, transparent ${Math.max(1.5, W / 700)}px);
    background-size: ${Math.round(W / 40)}px ${Math.round(W / 40)}px;`

  // Two layouts, and the promo one is not a nudge of the other.
  //
  // A mark beside a wordmark and a tagline is about 70% of this canvas wide. Shifting
  // that left does not get it out from under a play button stamped through the centre —
  // it is simply too wide to have a middle it can avoid, and pretending otherwise was
  // the first version of this file. So with a video the lockup stacks instead: a smaller
  // mark, the name under it, the tagline under that, the whole column narrow enough to
  // end before the button begins. It is a different composition because it has to be.
  const promo = !!g.promoVideo
  const markPx = Math.round(H * (promo ? 0.3 : 0.47))
  // Left of the button's leading edge, with room to breathe.
  const columnMax = Math.round(W / 2 - H * PLAY_BUTTON_R - W * 0.09)

  return `<!doctype html>
<meta charset="utf-8">
<style>
${fontCss}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden;
    background: ${g.background};${dots}
    font-family: '${g.fontFamily ?? 'Inter'}', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    display: flex; align-items: center;
    justify-content: ${promo ? 'flex-start' : 'center'};
    padding-left: ${promo ? Math.round(W * 0.055) : 0}px;
  }
  .lockup {
    display: flex;
    ${promo
      ? `flex-direction: column; align-items: flex-start; max-width: ${columnMax}px;
         gap: ${Math.round(H * 0.05)}px;`
      : `align-items: center; gap: ${Math.round(W * 0.042)}px;`}
  }
  .mark {
    width: ${markPx}px; height: ${markPx}px;
    object-fit: contain; display: block;
    /* Only when we are pasting the finished tile: rounding it makes it read as an app
       icon rather than as a square somebody forgot to cut out. A bare mark gets nothing
       — it sits directly on the ground, which is the point of it. */
    ${markIsTile ? `border-radius: ${Math.round(markPx * 0.224)}px;` : ''}
  }
  .words { display: flex; flex-direction: column; }
  .name {
    font-size: ${Math.round(H * (promo ? 0.13 : 0.175))}px; font-weight: ${g.headlineWeight ?? 800};
    letter-spacing: -0.03em; line-height: 1.05; color: ${g.accent};
  }
  .tagline {
    margin-top: ${Math.round(H * 0.038)}px;
    font-size: ${Math.round(H * (promo ? 0.05 : 0.062))}px; font-weight: 500; line-height: 1.3;
    letter-spacing: -0.01em; color: ${g.ink}; text-wrap: balance;
    max-width: ${promo ? columnMax : Math.round(W * 0.42)}px;
  }
  .note {
    margin-top: ${Math.round(H * 0.042)}px;
    font-size: ${Math.round(H * (promo ? 0.038 : 0.044))}px; font-weight: 400; color: ${g.muted};
  }
</style>
<div class="lockup" id="lockup">
  ${mark ? `<img class="mark" src="${mark}">` : ''}
  <div class="words">
    <div class="name">${escapeHtml(g.wordmark ?? '')}</div>
    ${g.tagline ? `<div class="tagline">${escapeHtml(g.tagline)}</div>` : ''}
    ${g.note ? `<div class="note">${escapeHtml(g.note)}</div>` : ''}
  </div>
</div>
`
}

/**
 * Does the art survive what the store will do to it?
 *
 * Measured from the laid-out page, not from the layout's intentions: the tagline that
 * wrapped to a third line and pushed the lockup past the edge is exactly the failure
 * this has to catch, and it is invisible to anything that only reads the config.
 */
async function inspect(page, spec, g) {
  const [W, H] = spec.size
  if (spec.kind !== 'feature') return []

  const box = await page.evaluate(() => {
    const el = document.getElementById('lockup')
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })

  const out = []
  const mx = W * EDGE_SAFE
  const my = H * EDGE_SAFE

  if (box.x < mx || box.y < my || box.x + box.w > W - mx || box.y + box.h > H - my) {
    out.push(
      `feature graphic: the lockup reaches within ${Math.round(EDGE_SAFE * 100)}% of an edge. ` +
        `Play crops this image to other aspect ratios in placements you do not choose, and ` +
        `what is near an edge is what gets cut. Shorten the tagline or the wordmark.`,
    )
  }

  if (g.promoVideo) {
    const cx = W / 2
    const cy = H / 2
    const r = H * PLAY_BUTTON_R
    const nearestX = Math.max(box.x, Math.min(cx, box.x + box.w))
    const nearestY = Math.max(box.y, Math.min(cy, box.y + box.h))
    if (Math.hypot(nearestX - cx, nearestY - cy) < r) {
      out.push(
        `feature graphic: content runs under the centre, where Play draws the play button ` +
          `because this listing has a promo video. Set graphics.promoVideo: false if it does not.`,
      )
    }
  }

  return out
}

/** Reads back what was written, rather than trusting what was asked for. */
function audit(spec, buffer) {
  const out = []
  const png = PNG.sync.read(buffer)
  const [W, H] = spec.size

  if (png.width !== W || png.height !== H) {
    out.push(`${spec.label}: rendered ${png.width}×${png.height}, the store requires ${W}×${H}`)
  }
  if (buffer.length > spec.maxBytes) {
    out.push(
      `${spec.label}: ${(buffer.length / MB).toFixed(2)} MB, over the store's ` +
        `${(spec.maxBytes / MB).toFixed(0)} MB ceiling`,
    )
  }
  return out
}

/**
 * A transparent source icon is the one silent failure left.
 *
 * It renders perfectly here — over whatever ground the config names — and then the app's
 * own launcher composites the same art over something else, and the two do not match.
 * Worth a word, never worth a failure: an icon drawn to sit on a coloured ground is a
 * legitimate thing to have.
 */
function alphaNote(buffer, path) {
  const png = PNG.sync.read(buffer)
  for (let i = 3; i < png.data.length; i += 4) {
    if (png.data[i] < 250) {
      return (
        `${basename(path)} has transparent pixels: the store icons are opaque, so it was ` +
          `composited onto graphics.iconBackground. If the app's icon is meant to be ` +
          `full-bleed, that colour must be the one baked into it.`
      )
    }
  }
  return null
}

export async function renderGraphics({ browser, config, fontCss }) {
  const g = config.graphics
  const outDir = g.outDir
  await mkdir(outDir, { recursive: true })

  const written = []
  const problems = []

  if (g.icon && !existsSync(g.icon)) problems.push(`graphics.icon does not exist: ${g.icon}`)
  if (g.mark && !existsSync(g.mark)) problems.push(`graphics.mark does not exist: ${g.mark}`)

  const icon = g.icon && existsSync(g.icon) ? await dataUri(g.icon) : null
  if (icon && extname(g.icon).toLowerCase() === '.png') {
    const note = alphaNote(await readFile(g.icon), g.icon)
    if (note) problems.push(note)
  }

  // The feature graphic wants the mark. Falling back to the tile is a real answer, not a
  // failure — but it is a visible compromise, so it is said out loud rather than quietly
  // producing a squarer picture than anyone asked for.
  const markPath = g.mark && existsSync(g.mark) ? g.mark : null
  const markIsTile = !markPath && !!icon
  const mark = markPath ? await dataUri(markPath) : icon

  if (markIsTile && g.targets.includes('play-feature')) {
    problems.push(
      `feature graphic: no graphics.mark, so the app icon tile was used and rounded. A ` +
        `transparent mark on the feature graphic's own ground looks considerably better — ` +
        `point graphics.mark at one if the app has it.`,
    )
  }

  for (const id of g.targets) {
    const spec = TARGETS[id]
    if (!spec) {
      problems.push(`unknown graphics target "${id}" — known: ${Object.keys(TARGETS).join(', ')}`)
      continue
    }
    if (spec.kind === 'icon' && !icon) {
      problems.push(`${spec.label} needs graphics.icon — skipped`)
      continue
    }

    const html =
      spec.kind === 'icon'
        ? iconHtml({ spec, icon, g, fontCss })
        : featureHtml({ spec, mark, markIsTile, g, fontCss })

    const page = await browser.newPage({ viewport: { width: spec.size[0], height: spec.size[1] } })
    await page.setContent(html)
    await page.evaluate(() => document.fonts.ready)

    problems.push(...(await inspect(page, spec, g)))

    const shot = stripAlpha(await page.screenshot({ type: 'png' }))
    await page.close()

    problems.push(...audit(spec, shot))

    const file = resolve(outDir, spec.file)
    await writeFile(file, shot)
    written.push({ id, file, spec, bytes: shot.length })
  }

  return { written, problems }
}
