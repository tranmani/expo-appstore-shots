/**
 * Wraps each raw screen in its store frame: brand ground, caption, device bezel,
 * status bar.
 *
 * The frame is composed as an HTML page and screenshotted at the exact pixel size
 * of the App Store slot, so there is no resampling and no Python in the toolchain
 * — the same browser that rendered the app renders its packaging.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PNG } from 'pngjs'
import { slideFile } from './config.mjs'
import { resolveGrounds, renderHeadline, escapeHtml, contrastRatio } from './theme.mjs'
import { layoutPlan, isAndroid, isTablet } from './layouts.mjs'
import { thumbnailLegibility, THUMBNAIL_MIN } from './verify.mjs'

/**
 * App Store Connect rejects PNGs with an alpha channel, and Chromium always
 * writes one. The frame is fully opaque, so the channel is dropped rather than
 * flattened — no pixel changes value.
 */
export function stripAlpha(buffer) {
  const png = PNG.sync.read(buffer)
  const out = new PNG({ width: png.width, height: png.height, colorType: 2, inputHasAlpha: false })
  const rgb = Buffer.alloc(png.width * png.height * 3)
  for (let i = 0, j = 0; i < png.data.length; i += 4, j += 3) {
    rgb[j] = png.data[i]
    rgb[j + 1] = png.data[i + 1]
    rgb[j + 2] = png.data[i + 2]
  }
  out.data = rgb
  return PNG.sync.write(out, { colorType: 2, inputColorType: 2 })
}

function statusBarSvg(tint, scale, android = false) {
  if (android) return androidStatusBarSvg(tint, scale)
  const s = (n) => n * scale
  return `
    <svg class="sb-icons" width="${s(78)}" height="${s(14)}" viewBox="0 0 78 14" fill="none">
      <g fill="${tint}">
        <rect x="0" y="8" width="3" height="5" rx="1"/>
        <rect x="5" y="6" width="3" height="7" rx="1"/>
        <rect x="10" y="3" width="3" height="10" rx="1"/>
        <rect x="15" y="0" width="3" height="13" rx="1"/>
      </g>
      <path d="M30.5 4.2a9 9 0 0 1 11 0" stroke="${tint}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <path d="M32.8 7.2a5.6 5.6 0 0 1 6.4 0" stroke="${tint}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <circle cx="36" cy="10.6" r="1.6" fill="${tint}"/>
      <rect x="52" y="1.5" width="21" height="11" rx="3" stroke="${tint}" stroke-width="1.2" fill="none" opacity="0.6"/>
      <rect x="53.8" y="3.3" width="17.4" height="7.4" rx="1.6" fill="${tint}"/>
      <path d="M74.6 5.4v3.2a2.2 2.2 0 0 0 0-3.2Z" fill="${tint}" opacity="0.6"/>
    </svg>`
}

/**
 * The Android tell. The iOS bar above is the wrong chrome on a Play screenshot —
 * an Apple 4-bar signal and a horizontal battery pill. This is the Material read:
 * a filled signal triangle, a wifi fan, and a VERTICAL battery (the clearest
 * platform giveaway). Same 78×14 viewBox so it drops into the same slot.
 */
function androidStatusBarSvg(tint, scale) {
  const s = (n) => n * scale
  return `
    <svg class="sb-icons" width="${s(78)}" height="${s(14)}" viewBox="0 0 78 14" fill="none">
      <path d="M2 13 L18 13 L18 1 Z" fill="${tint}"/>
      <path d="M31 5a9 9 0 0 1 11 0" stroke="${tint}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <path d="M33.3 8a5.6 5.6 0 0 1 6.4 0" stroke="${tint}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <circle cx="36.5" cy="11" r="1.6" fill="${tint}"/>
      <rect x="68" y="1.5" width="8" height="11.5" rx="1.4" stroke="${tint}" stroke-width="1.2" fill="none" opacity="0.7"/>
      <rect x="70.6" y="0.2" width="2.8" height="1.8" rx="0.6" fill="${tint}" opacity="0.7"/>
      <rect x="69.4" y="5" width="5.2" height="6.5" rx="0.8" fill="${tint}"/>
    </svg>`
}

/**
 * One device, positioned absolutely by its top-left — for `two-devices`, where
 * two phones overlap and neither is centred. Fully inline-styled on purpose: it
 * shares no CSS class with the single-device path, so that path stays
 * byte-identical while this one is free to place, scale and tilt each phone.
 * Corners, bezel and the status bar all scale from this device's own width.
 */
function positionedDevice(raw, { left, top, width, tilt, z, device, frame, statusTint }) {
  const tablet = isTablet(device)
  const bezel = Math.round(width * 0.013)
  const radius = Math.round(width * (tablet ? 0.028 : 0.057))
  const shrink = width / (device.width * device.scale)
  const statusScale = device.scale * shrink
  const sbH = Math.round(device.insets.top * shrink * device.scale)
  const transform = tilt ? `rotate(${tilt}deg)` : 'none'
  return `<div style="position:absolute; top:${top}px; left:${left}px; z-index:${z}; width:${width + bezel * 2}px; padding:${bezel}px; border-radius:${radius + bezel}px; background:${frame.bezel ?? '#111517'}; transform:${transform}; transform-origin:center; box-shadow:0 ${Math.round(width / 34)}px ${Math.round(width / 12)}px rgba(0,0,0,0.30);">
  <div style="position:relative; border-radius:${radius}px; overflow:hidden; display:block;">
    <img src="data:image/png;base64,${raw.toString('base64')}" style="width:${width}px; display:block;">
    <div style="position:absolute; left:0; right:0; top:0; height:${sbH}px; display:flex; align-items:center; justify-content:space-between; padding:0 ${Math.round(20 * statusScale)}px; padding-top:${Math.round(6 * statusScale)}px; font-size:${Math.round(17 * statusScale)}px; font-weight:600; color:${statusTint}; letter-spacing:0.01em;">
      <span>${escapeHtml(frame.statusBar?.time ?? '9:41')}</span>
      ${statusBarSvg(statusTint, statusScale, isAndroid(device))}
    </div>
  </div>
</div>`
}

/** The built-in accent marks — a sparkle and a hand-drawn squiggle — so a deck
 *  gets tasteful decoration with no assets, drawn in the ground's accent. */
function accentSvg(kind, color, size) {
  if (kind === 'sparkle') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill="${color}"/></svg>`
  }
  // squiggle: a wavy underline
  return `<svg width="${size}" height="${Math.round(size * 0.26)}" viewBox="0 0 100 24" fill="none"><path d="M2 12 Q 14 2 26 12 T 50 12 T 74 12 T 98 12" stroke="${color}" stroke-width="4" stroke-linecap="round" fill="none"/></svg>`
}

/**
 * Decorative accents, composited over the ground: a stat chip, a proof badge, a
 * sparkle, a squiggle, a line of text, an image. Positioned by `{x, y}` as
 * FRACTIONS of the frame (0–1) so a placement holds across every device size,
 * with optional `rotation` and stacking `z`. Sparsity is the rule — one or two
 * of these on a hero, not a scrapbook — but that is the deck's call, not ours.
 *
 * Entirely opt-in: an empty/absent list renders nothing, which is what keeps the
 * default frame byte-identical.
 */
export function elementsHtml(elements, { W, H, ground, bridge }) {
  if (!elements?.length) return ''
  const px = (frac) => Math.round(frac * W)
  return elements
    .map((el) => {
      // A bridge element is placed in the GROUP's coordinate space — `x` is a
      // fraction of the whole N-wide group, not of one frame — then shifted into
      // this column. The frame's `overflow: hidden` clips whatever runs past the
      // edge, so the same element, drawn in every column of the group, lines up
      // across the seams when the exports sit side by side on the store page.
      const left = bridge
        ? Math.round((el.x ?? 0.5) * bridge.n * W - bridge.i * W)
        : Math.round((el.x ?? 0.5) * W)
      const top = Math.round((el.y ?? 0.5) * H)
      const rot = el.rotation ? ` rotate(${el.rotation}deg)` : ''
      const base = `position:absolute; left:${left}px; top:${top}px; z-index:${el.z ?? 5}; transform:translate(-50%,-50%)${rot}; transform-origin:center;`
      switch (el.type) {
        case 'chip':
        case 'badge': {
          // The pill defaults to the accent, and the accent is LIGHT on a dark
          // ground — so a hard-coded white label would be white-on-light and
          // vanish on exactly the dark hero a proof chip is made for. Default the
          // text to whichever of black/white actually contrasts with the pill.
          const bg = el.color ?? ground.accent
          const label = el.textColor ?? (contrastRatio(bg, '#ffffff') >= contrastRatio(bg, '#111111') ? '#fff' : '#111')
          return `<div style="${base} background:${bg}; color:${label}; padding:${px(0.017)}px ${px(0.032)}px; border-radius:999px; font-size:${px(el.size ?? 0.03)}px; font-weight:700; white-space:nowrap; box-shadow:0 ${px(0.006)}px ${px(0.022)}px rgba(0,0,0,0.16);">${escapeHtml(el.text ?? '')}</div>`
        }
        case 'text':
          return `<div style="${base} color:${el.color ?? ground.ink}; font-size:${px(el.size ?? 0.035)}px; font-weight:${el.weight ?? 700}; white-space:nowrap; letter-spacing:-0.01em;">${escapeHtml(el.text ?? '')}</div>`
        case 'sparkle':
        case 'squiggle':
          return `<div style="${base}">${accentSvg(el.type, el.color ?? ground.accent, px(el.size ?? 0.08))}</div>`
        case 'image':
          // el.src lands in an HTML attribute, so it is escaped like every other
          // author string — a src with a quote must not break out into markup.
          return `<img src="${escapeHtml(el.src ?? '')}" style="${base} width:${px(el.w ?? 0.2)}px; display:block;">`
        default:
          return ''
      }
    })
    .join('\n')
}

export function frameHtml({ slide, device, raw, rawSecondary, frame, fontCss, bridge }) {
  const [W, H] = device.size
  const ground = resolveGrounds(frame)[slide.ground ?? 'light']

  // The layout decides where everything sits; a per-device-kind override in the
  // config still wins on top, exactly as before.
  const plan = layoutPlan(slide.layout ?? 'standard', device)
  const L = { ...plan, ...(frame.layout?.[device.kind] ?? {}) }
  const tilt = Number(slide.tilt ?? L.tilt ?? 0)

  // The screen is rendered at the device's own pixel size; on the frame it sits
  // at `deviceWidth`, so everything drawn over it scales by this factor.
  const shrink = L.deviceWidth / (device.width * device.scale)
  const statusScale = device.scale * shrink
  const statusTint = slide.statusTint ?? frame.statusBar?.tint ?? '#181A17'
  const dots = frame.dots === false ? '' : `
    background-image: radial-gradient(${ground.dot} ${Math.max(1.5, W / 700)}px, transparent ${Math.max(1.5, W / 700)}px);
    background-size: ${Math.round(W / 43)}px ${Math.round(W / 43)}px;`

  // Where the caption is pinned. `top` is the original behaviour; `bottom` and
  // `middle` are what the device-top and no-device layouts need. A `bottom`
  // anchor with no `captionBottom` (only possible via a `frame.layout` override)
  // falls to a sensible default rather than emitting `bottom: undefinedpx`.
  const captionBottom = L.captionBottom ?? Math.round(H * 0.06)
  const captionPos =
    L.captionAnchor === 'bottom'
      ? `bottom: ${captionBottom}px;`
      : L.captionAnchor === 'middle'
        ? `top: 50%; transform: translateY(-50%);`
        : `top: ${L.captionTop}px;`
  // The extras carry their OWN leading space, so when they are empty the caption
  // and paragraph rules are byte-for-byte what they were before the engine — no
  // trailing whitespace on the default path.
  const textAlign = L.captionAlign === 'center' ? ' text-align: center;' : ''
  const subMargin = L.captionAlign === 'center' ? ' margin-left: auto; margin-right: auto;' : ''

  const deviceTransform = `translateX(-50%)${tilt ? ` rotate(${tilt}deg)` : ''}`

  // Android draws a gesture pill where iOS shows the home indicator — the
  // clearest tell that a frame is an Android one. Only for the android kind, so
  // the iOS phone path (the golden) is untouched.
  const navPill =
    isAndroid(device)
      ? `
    <div class="nav"></div>`
      : ''
  // The pill's CSS, added to the style block only for android — so the iOS phone
  // output (the golden) gains nothing and stays byte-identical.
  const navCss =
    isAndroid(device)
      ? `
  .nav { position: absolute; left: 50%; bottom: ${Math.round(device.insets.bottom * shrink * device.scale * 0.3)}px; transform: translateX(-50%); width: ${Math.round(L.deviceWidth * 0.3)}px; height: ${Math.max(6, Math.round(4 * statusScale))}px; border-radius: 999px; background: rgba(20, 20, 20, 0.5); }`
      : ''

  // A small over-line above the headline (proof, category, "NEW") and the free
  // decorative accents — both opt-in, so an eyebrow-less, element-less slide is
  // byte-for-byte what it was before they existed.
  const eyebrow = slide.eyebrow ? `\n  <div class="eyebrow">${escapeHtml(slide.eyebrow)}</div>` : ''
  const eyebrowCss = slide.eyebrow
    ? `
  .eyebrow { font-size: ${Math.round(L.sub * 0.82)}px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${ground.accent}; margin-bottom: ${Math.round(L.headline * 0.2)}px; }`
    : ''
  // Per-slide accents, plus any bridge elements the group carries — the latter
  // drawn in group-canvas space so they cross the seam.
  const slideEls = slide.elements?.length ? elementsHtml(slide.elements, { W, H, ground }) : ''
  const bridgeEls = bridge?.elements?.length ? elementsHtml(bridge.elements, { W, H, ground, bridge }) : ''
  const combined = [slideEls, bridgeEls].filter(Boolean).join('\n')
  const elements = combined ? `\n${combined}` : ''

  // Two phones layered — the back one first (behind), then the front. Falls back
  // to the single centred device the moment the second screenshot is missing, so
  // a `two-devices` slide with no `screenSecondary` still renders one real phone
  // rather than nothing (the config also warns about it).
  const twoDevices = L.secondary && rawSecondary
  const deviceHtml = twoDevices
    ? positionedDevice(rawSecondary, { ...L.secondary, z: 1, device, frame, statusTint }) +
      '\n' +
      positionedDevice(raw, { left: L.deviceLeft, top: L.deviceTop, width: L.deviceWidth, tilt, z: 2, device, frame, statusTint })
    : L.deviceShown
      ? `<div class="device">
  <div class="screen">
    <img src="data:image/png;base64,${raw.toString('base64')}">
    <div class="sb">
      <span>${escapeHtml(frame.statusBar?.time ?? '9:41')}</span>
      ${statusBarSvg(statusTint, statusScale, isAndroid(device))}
    </div>${navPill}
  </div>
</div>`
      : ''

  return `<!doctype html>
<meta charset="utf-8">
<style>
${fontCss}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden;
    background: ${ground.bg};${dots}
    font-family: '${frame.fontFamily ?? 'Inter'}', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .caption { position: absolute; left: ${L.margin}px; right: ${L.margin}px; ${captionPos}${textAlign} }
  h1 {
    font-size: ${L.headline}px; line-height: 1.16; letter-spacing: -0.02em;
    font-weight: ${frame.headlineWeight ?? 800}; color: ${ground.ink}; text-wrap: balance;
  }
  p {
    margin-top: ${Math.round(L.headline * 0.28)}px;
    font-size: ${L.sub}px; line-height: 1.38; font-weight: 400; color: ${ground.muted};
    max-width: ${Math.round((W - L.margin * 2) * 0.94)}px;${subMargin}
  }
  .device {
    position: absolute; top: ${L.deviceTop}px; left: 50%; transform: ${deviceTransform};
    width: ${L.deviceWidth + L.bezel * 2}px;
    padding: ${L.bezel}px;
    border-radius: ${L.radius + L.bezel}px;
    background: ${frame.bezel ?? '#111517'};
    box-shadow: 0 ${Math.round(L.deviceWidth / 40)}px ${Math.round(L.deviceWidth / 14)}px rgba(0,0,0,0.28);
  }
  .screen { position: relative; border-radius: ${L.radius}px; overflow: hidden; display: block; }
  .screen img { width: ${L.deviceWidth}px; display: block; }
  /* The status bar: react-native-web has none, so the app leaves the safe-area
     strip empty and it is drawn back in here, at the device's own scale. */
  .sb {
    position: absolute; left: 0; right: 0; top: 0;
    height: ${Math.round(device.insets.top * shrink * device.scale)}px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 ${Math.round(20 * statusScale)}px;
    padding-top: ${Math.round(6 * statusScale)}px;
    font-size: ${Math.round(17 * statusScale)}px; font-weight: 600; color: ${statusTint};
    letter-spacing: 0.01em;
  }${navCss}${eyebrowCss}
</style>
<div class="caption">${eyebrow}
  <h1>${renderHeadline(slide.headline ?? '', ground.accent)}</h1>
  ${slide.sub ? `<p>${escapeHtml(slide.sub)}</p>` : ''}
</div>
${deviceHtml}${elements}
`
}

/**
 * Which connected group each slide belongs to, and where in it.
 *
 * A run of consecutive slides sharing a `bridge` id is one group: `n` slides
 * wide, this one at index `i`. A group's bridge elements are drawn in every one
 * of its columns, offset per `i`, so they line up across the seams. A `bridge`
 * that names only itself (or lands non-adjacent) simply gets `n: 1` — no bridge,
 * and the config warns.
 */
export function bridgeContexts(slides) {
  const ctx = new Array(slides.length).fill(null)
  let s = 0
  while (s < slides.length) {
    const id = slides[s].bridge
    if (!id) {
      s++
      continue
    }
    let e = s
    while (e + 1 < slides.length && slides[e + 1].bridge === id) e++
    const n = e - s + 1
    for (let k = s; k <= e; k++) ctx[k] = { id, n, i: k - s }
    s = e + 1
  }
  return ctx
}

/**
 * A deck under a variant's overrides, for A/B sets.
 *
 * A variant changes only the packaging — the theme/grounds and, per slide, the
 * copy or layout — never the app render, so the raws are shot once and composed
 * under each variant. `frame` merges shallowly; `slides` merges by index, so a
 * variant can restyle the whole deck, rewrite one headline, or both.
 *
 * The index a variant's `slides[i]` refers to is the AUTHORED-deck index. When
 * `--screen` has narrowed the deck, `applyFilters` stamps each survivor's
 * original position on `_srcIndex`, and we match by that — so an override never
 * slides onto the wrong screen when the array was reindexed.
 */
export function applyVariant(config, variant) {
  return {
    ...config,
    frame: { ...(config.frame ?? {}), ...(variant.frame ?? {}) },
    slides: config.slides.map((s, i) => ({ ...s, ...(variant.slides?.[s._srcIndex ?? i] ?? {}) })),
  }
}

/**
 * The compose jobs a config expands to: one deck straight into `outDir`, or — when
 * the config declares `variants` — one repackaged deck per variant into
 * `outDir/<name>/`. The ONE definition of this, shared by the headless run and the
 * live preview, so the two cannot drift: a variant config previews exactly what CI
 * ships, folders and all.
 */
export function variantJobs(config, outDir) {
  return config.variants?.length
    ? config.variants.map((v) => ({ config: applyVariant(config, v), outDir: resolve(outDir, v.name), label: v.name }))
    : [{ config, outDir, label: null }]
}

export async function compose({ browser, config, devices, fontCss, rawDir, outDir }) {
  const frame = config.frame ?? {}
  const bridges = config.bridges ?? {}
  const groups = bridgeContexts(config.slides)
  const written = []
  const legibility = []

  for (const device of devices) {
    const dir = resolve(outDir, device.out)
    await mkdir(dir, { recursive: true })
    const source = device.renderWith ?? device.id

    for (const [i, slide] of config.slides.entries()) {
      const raw = await readFile(resolve(rawDir, `${source}-${slide.screen}.png`))
      // The back phone of a two-devices slide. It is one of the deck's own
      // screens, so it was already shot — this just reads that raw too.
      const rawSecondary = slide.screenSecondary
        ? await readFile(resolve(rawDir, `${source}-${slide.screenSecondary}.png`))
        : null
      // The connected-group context, if this slide is in one, with the group's
      // bridge elements resolved from `config.bridges`.
      const g = groups[i]
      const bridge = g && g.n > 1 ? { n: g.n, i: g.i, elements: bridges[g.id]?.elements } : null
      const page = await browser.newPage({ viewport: { width: device.size[0], height: device.size[1] } })
      await page.setContent(frameHtml({ slide, device, raw, rawSecondary, frame, fontCss, bridge }))
      await page.evaluate(() => document.fonts.ready)

      const shot = await page.screenshot({ type: 'png' })
      await page.close()

      const name = slideFile(slide, i)
      const file = resolve(dir, name)
      const png = stripAlpha(shot)
      await writeFile(file, png)
      written.push(`${device.out}/${name}`)

      // The thumbnail test, run on the frame we just wrote: a headline that
      // clears the config-time contrast check can still die once the listing
      // shrinks it to ~160px. Only captioned slides carry a headline to read.
      if (slide.headline) {
        // The band to measure is where the caption actually renders — after any
        // per-device-kind `frame.layout` override, the same merge frameHtml does.
        const plan = { ...layoutPlan(slide.layout ?? 'standard', device), ...(frame.layout?.[device.kind] ?? {}) }
        const ratio = thumbnailLegibility(PNG.sync.read(png), plan.captionAnchor)
        if (ratio < THUMBNAIL_MIN) legibility.push({ file: `${device.out}/${name}`, ratio })
      }
    }
  }
  if (legibility.length) {
    console.warn(`\n⚠ thumbnail legibility — the headline may not read at ~160px (min ${THUMBNAIL_MIN}:1):`)
    for (const w of legibility) console.warn(`  ${w.file} — ${w.ratio.toFixed(2)}:1`)
  }
  return written
}
