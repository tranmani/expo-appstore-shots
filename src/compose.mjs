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
import { resolveGrounds, renderHeadline, escapeHtml } from './theme.mjs'
import { layoutPlan } from './layouts.mjs'

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

function statusBarSvg(tint, scale) {
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

export function frameHtml({ slide, device, raw, frame, fontCss }) {
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

  const deviceHtml = L.deviceShown
    ? `<div class="device">
  <div class="screen">
    <img src="data:image/png;base64,${raw.toString('base64')}">
    <div class="sb">
      <span>${escapeHtml(frame.statusBar?.time ?? '9:41')}</span>
      ${statusBarSvg(statusTint, statusScale)}
    </div>
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
  }
</style>
<div class="caption">
  <h1>${renderHeadline(slide.headline ?? '', ground.accent)}</h1>
  ${slide.sub ? `<p>${escapeHtml(slide.sub)}</p>` : ''}
</div>
${deviceHtml}
`
}

export async function compose({ browser, config, devices, fontCss, rawDir, outDir }) {
  const frame = config.frame ?? {}
  const written = []

  for (const device of devices) {
    const dir = resolve(outDir, device.out)
    await mkdir(dir, { recursive: true })
    const source = device.renderWith ?? device.id

    for (const [i, slide] of config.slides.entries()) {
      const raw = await readFile(resolve(rawDir, `${source}-${slide.screen}.png`))
      const page = await browser.newPage({ viewport: { width: device.size[0], height: device.size[1] } })
      await page.setContent(frameHtml({ slide, device, raw, frame, fontCss }))
      await page.evaluate(() => document.fonts.ready)

      const shot = await page.screenshot({ type: 'png' })
      await page.close()

      const name = slideFile(slide, i)
      const file = resolve(dir, name)
      await writeFile(file, stripAlpha(shot))
      written.push(`${device.out}/${name}`)
    }
  }
  return written
}
