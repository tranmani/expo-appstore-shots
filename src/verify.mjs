/**
 * Does the frame actually show the app?
 *
 * Every other part of this tool is about fidelity, so this is the part that says
 * when fidelity broke. It exists because the failure mode that matters is not a
 * crash — a crash is loud. It is a clean run, zero errors, and a polished
 * 1290×2796 PNG with the headline number truncated to "48 260…" in it. The tool
 * that produced that told you everything went fine, and it was the only thing in
 * the room that could have known otherwise.
 *
 * Nothing here fails a build. These are warnings, printed the way the
 * unfixtured-route report is printed: a to-do list, ordered by how likely it is
 * to have ruined the shot.
 */
import { PNG } from 'pngjs'
import { readFile } from 'node:fs/promises'

/**
 * Runs *inside the page*, after the screen has settled.
 *
 * Text overflow is invisible to the DOM's own error reporting — the element is
 * laid out, painted, and quietly ellipsised — so the only way to catch it is to
 * measure. `scrollWidth > clientWidth` is the same question the browser asked
 * when it decided to draw the ellipsis.
 */
export const PROBE = `((title) => {
  const out = {
    clipped: [],
    overlaps: [],
    scrollables: 0,
    // A navigation title that only repeats a heading the screen already prints.
    echoedTitle: null,
    // lucide lives only in the page, so the tab bar checks the icon names there
    // and leaves the result here for the run to report.
    iconNames: window.__SHOTS_ICON_NAMES__ || [],
    missingIcons: window.__SHOTS_ICONS_MISSING__ || [],
  }
  const seen = new Set()

  // The tab bar is this tool's own chrome, not the app's content. Without this
  // it reports its own labels as content hidden underneath itself.
  const chrome = document.querySelector('[data-shots-chrome]')

  for (const el of document.querySelectorAll('*')) {
    if (chrome && chrome.contains(el)) continue

    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue

    const box = el.getBoundingClientRect()
    if (!box.width || !box.height) continue

    if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) {
      const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll' ||
                      style.overflowX === 'auto' || style.overflowX === 'scroll'
      if (scrolls) out.scrollables++
    }

    // A leaf that holds text and cannot show all of it.
    const text = (el.textContent || '').trim()
    if (text && !el.children.length) {
      const clippedX = el.scrollWidth > el.clientWidth + 1
      const clippedY = el.scrollHeight > el.clientHeight + 1
      const ellipsis = style.textOverflow === 'ellipsis' && clippedX
      if ((clippedX || clippedY || ellipsis) && !seen.has(text)) {
        seen.add(text)
        out.clipped.push({ text: text.slice(0, 40), top: Math.round(box.top) })
      }
    }

    // Content underneath the chrome the tool draws over it.
    if (text && !el.children.length) {
      for (const zone of window.__SHOTS_ZONES__ || []) {
        const hit = box.top < zone.bottom && box.bottom > zone.top
        if (hit && !seen.has(zone.name + text)) {
          seen.add(zone.name + text)
          out.overlaps.push({ zone: zone.name, text: text.slice(0, 40) })
        }
      }
    }
  }

  // The screen says its own name, and the nav bar says it again directly above.
  //
  // This is a trap the config walks you into: a tab screen renders with no header at
  // all (its header lives in the tabs layout, which is never mounted), the run tells
  // you so, you add a title — and if the screen already prints its name as a heading,
  // the frame now carries the word twice, once small and once large, and nothing
  // anywhere is technically wrong. \`header: false\` is the right answer whenever the
  // screen titles itself, and only the laid-out page knows which.
  //
  // Matched on the configured title rather than on a marker in this tool's own header
  // stub, because an app that installs its own header component — which the first
  // version of this check assumed away, and which is exactly the app it was written
  // for — never renders that stub at all.
  if (title) {
    const band = window.innerHeight * 0.45
    const hits = []
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length) continue
      if ((el.textContent || '').trim() !== title) continue
      const box = el.getBoundingClientRect()
      if (box.width && box.top >= 0 && box.top < band) hits.push(box.top)
    }
    // Twice near the top of the same screen: once in the bar, once as the heading. A
    // single occurrence is just the header doing its job.
    if (hits.length > 1) out.echoedTitle = title
  }

  return out
})`

/**
 * Dead space: the run of blank rows at the *bottom* of the screen.
 *
 * A list that renders ten rows and then half a blank page is a real failure —
 * the fixture ran out of data — and on a 13" iPad nothing else will tell you.
 * But a flat band anywhere else is just design: a hero image, a coloured header,
 * an airy section. Only the trailing run carries the meaning, so only the
 * trailing run is measured, and the false-positive rate collapses.
 *
 * `ignoreBottom` skips the tab bar, which is drawn into the frame and would
 * otherwise stop the run dead one pixel in.
 */
export function flatness(png, ignoreBottom = 0) {
  const { width, height, data } = png

  /**
   * The colour of a row, if it has one.
   *
   * Not "every pixel is identical" — that sounds right and is useless, because
   * real app backgrounds are textured: a dot grid, a subtle noise, a gradient of
   * one step. A background like that is *visually* empty and arithmetically
   * busy, so an exact test reports nothing on precisely the screens that are
   * emptiest. So: find the dominant colour, and call the row flat if nearly all
   * of it is that colour give or take a shade.
   */
  /**
   * Telling an empty row from a full one is harder than it sounds, because a
   * real app's "empty" background is textured — Perron's is a dot grid — and on
   * the two obvious axes a dot grid and a line of small type look identical:
   *
   *   dots on Perron's ground:  8% of the row,  42 away in colour
   *   a line of body text:     ~10% of the row, and also not far, once it is
   *                            antialiased down to a light grey
   *
   * So neither coverage nor distance can separate them, and the tempting
   * thresholds all end up either reporting every screen or reporting none.
   *
   * What does separate them is the number of distinct *shades*. A dot grid is
   * the ground plus one dot colour: three shades, and no more however wide the
   * screen. Antialiased type is a gradient — dozens. That is a property of what
   * the thing *is*, not of how much room it takes, so it does not need tuning.
   */
  const SHADES = 8 // a ground, a texture, and their antialiasing. Type has more.
  const INK = 90 * 90 // unambiguously content, whatever else is in the row
  const SAME = 12 * 12 // two rows share a ground only if they nearly match

  const rowColour = (y) => {
    // Bucketed, so the antialiasing on a texture dot does not read as a new
    // shade — but type, which is a real gradient, still does.
    const counts = new Map()
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)
      const hit = counts.get(key)
      if (hit) hit.n++
      else counts.set(key, { n: 1, rgb: [data[i], data[i + 1], data[i + 2]] })
    }

    if (counts.size > SHADES) return null

    let ground = null
    let best = 0
    for (const { n, rgb } of counts.values()) {
      if (n > best) {
        best = n
        ground = rgb
      }
    }

    // The row must actually be mostly ground. Half a card is not a background.
    if (best / width < 0.6) return null

    // And a hard-edged mark — an icon, a rule, a glyph with no antialiasing —
    // is content even though it adds only one shade.
    let ink = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const dr = data[i] - ground[0]
      const dg = data[i + 1] - ground[1]
      const db = data[i + 2] - ground[2]
      if (dr * dr + dg * dg + db * db > INK) ink++
    }

    return ink / width > 0.003 ? null : ground
  }

  /** Two rows share a ground only if their dominant colours nearly match. */
  const same = (a, b) => {
    if (!a || !b) return false
    const dr = a[0] - b[0]
    const dg = a[1] - b[1]
    const db = a[2] - b[2]
    return dr * dr + dg * dg + db * db <= SAME
  }

  const last = height - 1 - Math.min(ignoreBottom, height - 1)
  const canvas = last + 1
  const ground = rowColour(last)
  if (!ground) return { rows: 0, height: canvas, share: 0, colour: null }

  let rows = 0
  for (let y = last; y >= 0 && same(rowColour(y), ground); y--) rows++

  return { rows, height: canvas, share: rows / canvas, colour: ground.join(',') }
}

/**
 * The thumbnail test, run on pixels instead of by eye.
 *
 * A store listing is scrolled as a strip of ~160px-wide thumbnails; the headline
 * has to carry from there or the slide is wasted. A caption can clear a config-
 * time contrast check (accent vs ground, done in `config.mjs`) and still vanish
 * at thumbnail size, because downscaling averages a thin stroke *toward* the
 * ground — 3:1 type over a busy screenshot or a near-tone ground washes out to
 * nothing once the letters are two pixels wide. The only honest way to know is to
 * actually shrink the frame and look at the caption band that remains.
 *
 * So: box-average the caption band down to a 160px-wide thumbnail, and in each
 * surviving row measure the WCAG contrast between the row's ground (its median
 * luminance) and its strongest surviving stroke (the luminance percentile
 * furthest from that median — a percentile, not the single extreme pixel, so one
 * stray antialiased dot is not mistaken for legible text). The loudest row is the
 * headline; its contrast *after* the downscale is the number that predicts
 * whether a scroller can read it. Anti-aliasing has already done its damage by
 * then, which is the point.
 *
 * `anchor` says where the caption sits (`top` | `bottom` | `middle`) so the app's
 * own screen text is never what gets measured.
 */
const luminance = (r, g, b) => {
  const lin = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const wcag = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

const CAPTION_BAND = {
  top: [0.045, 0.19],
  bottom: [0.8, 0.955],
  middle: [0.4, 0.62],
}

export function thumbnailLegibility(png, anchor = 'top', thumbWidth = 160) {
  const { width, height, data } = png
  const band = CAPTION_BAND[anchor] ?? CAPTION_BAND.top
  const y0 = Math.floor(band[0] * height)
  const y1 = Math.ceil(band[1] * height)

  // Box-average full-res blocks down to `thumbWidth` columns. The block is the
  // downscale kernel; averaging is what pulls a thin stroke toward the ground.
  const scale = Math.max(1, Math.round(width / thumbWidth))
  const cols = Math.floor(width / scale)

  let best = 0
  for (let y = y0; y + scale <= y1; y += scale) {
    const lums = []
    for (let cx = 0; cx < cols; cx++) {
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((y + dy) * width + (cx * scale + dx)) * 4
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          n++
        }
      }
      lums.push(luminance(r / n, g / n, b / n))
    }
    if (lums.length < 8) continue
    lums.sort((a, c) => a - c)
    const at = (p) => lums[Math.min(lums.length - 1, Math.max(0, Math.round(p * (lums.length - 1))))]
    const ground = at(0.5)
    // The strongest stroke is whichever tail is furthest from the ground.
    const dark = wcag(at(0.08), ground)
    const light = wcag(at(0.92), ground)
    best = Math.max(best, dark, light)
  }
  return best
}

/**
 * Below this WCAG contrast, a headline that survived the full-size check still
 * dies at thumbnail scale. Calibrated so real Perron/FamMedley heroes clear it
 * comfortably and a deliberately near-tone caption does not.
 */
export const THUMBNAIL_MIN = 2.2

/** Anything above this is dead space you would notice, and reviewers will. */
const DEAD_SHARE = 0.3

export async function inspectImage(file, ignoreBottom = 0) {
  const png = PNG.sync.read(await readFile(file))
  const flat = flatness(png, ignoreBottom)
  return flat.share >= DEAD_SHARE ? flat : null
}

/**
 * Turn the raw findings into the lines a human reads. Ordered by how badly each
 * one misrepresents the app: clipped text is a lie about the content, dead space
 * is a lie about how full the app is, and an overlap is a lie about its chrome.
 */
export function report(findings) {
  const lines = []

  for (const f of findings) {
    const where = `${f.device}/${f.screen}`

    for (const c of f.clipped ?? []) {
      lines.push(`${where}: clipped text — "${c.text}"`)
    }
    if (f.flat) {
      const pct = Math.round(f.flat.share * 100)
      // "of the screen", not "of the frame": this is measured on the raw shot of the
      // app, before the brand ground is composed around it — and the brand ground is
      // meant to be flat, so saying "frame" invites you to dismiss a true finding.
      lines.push(`${where}: ${pct}% of the screen is one flat colour (${f.flat.colour}) — dead space?`)
    }
    if (f.echoedTitle) {
      lines.push(
        `${where}: the header says "${f.echoedTitle}" and the screen says it again ` +
          `right underneath — set header: false, this screen titles itself`,
      )
    }
    for (const o of f.overlaps ?? []) {
      lines.push(`${where}: the ${o.zone} is drawn over "${o.text}"`)
    }
    if (f.scrollWanted && !f.scrollables) {
      lines.push(`${where}: scroll: ${JSON.stringify(f.scrollWanted)} was asked for, but nothing on this screen scrolls`)
    }
    if (f.missingAnchor) {
      lines.push(`${where}: scroll: "${f.missingAnchor}" — no element has that testID`)
    }
  }

  return lines
}

/**
 * Icon names lucide does not have. Reported once for the run, not once per
 * frame: a typo'd icon is wrong on every screen at once, and saying so twelve
 * times would bury the things that are wrong on only one.
 */
export function iconReport(findings, suggest) {
  const names = findings.find((f) => f.iconNames?.length)?.iconNames ?? []
  const missing = new Map()
  for (const f of findings) {
    for (const m of f.missingIcons ?? []) missing.set(m.icon, m.tab)
  }

  return [...missing].map(([icon, tab]) => {
    const near = names.length ? suggest(icon, names) : []
    const did = near.length ? ` — did you mean ${near.join(', ')}?` : ''
    return `tab "${tab}": lucide has no icon "${icon}"${did}`
  })
}

/**
 * Fixtures nobody asked for. The unfixtured-route report catches a route with no
 * fixture; this catches its mirror image — a fixture whose path is a typo, which
 * fails *silently*, as an empty screen with no clue why.
 */
export function unusedFixtures(routes, hits) {
  return routes.map((r) => r.key).filter((key) => !hits.has(key))
}
