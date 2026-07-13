/**
 * Photographs each screen at each device size.
 *
 * One browser context per device, because the viewport is baked into the page at
 * load. Everything that can vary per *screen* — the clock, the stored session,
 * the colour scheme — is applied to the page instead, so the same module can be
 * photographed in several states: a calendar in agenda view and in month view,
 * from one config, in one run.
 *
 * The clock is shifted, not frozen: relative labels like "3 min ago" stay
 * truthful and timers still fire, but a departure board reads 09:41 instead of
 * whenever CI happened to run.
 */
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PROBE, inspectImage } from './verify.mjs'
import { TAB_BAR_BAND } from './geometry.mjs'

/** Merge a screen's runtime overrides onto the run's. Shallow, one level deep. */
export function runtimeFor(config, screen) {
  const base = config.runtime ?? {}
  const over = screen.runtime ?? {}
  return { ...base, ...over }
}

/**
 * Put the screen where the shot wants it.
 *
 * `scroll` used to be 'top' | 'end' and drive only lists — on a plain ScrollView
 * 'end' silently did nothing, which costs a rebuild cycle to discover. This
 * works on whatever actually scrolls, and reports back when nothing does.
 */
const SCROLL = `(want) => {
  const all = [...document.querySelectorAll('*')].filter((el) => {
    const s = getComputedStyle(el)
    const scrolls = /auto|scroll/.test(s.overflowY) || /auto|scroll/.test(s.overflowX)
    return scrolls && el.scrollHeight > el.clientHeight + 1
  })
  if (!all.length) return { scrollables: 0 }

  // The biggest one is the screen's content; the small ones are chips and pills.
  const el = all.sort((a, b) => b.clientHeight - a.clientHeight)[0]

  if (typeof want === 'number') el.scrollTop = want
  else if (want === 'end') el.scrollTop = el.scrollHeight
  else if (want === 'top') el.scrollTop = 0
  else if (typeof want === 'string') {
    const target = document.querySelector('[data-testid=' + JSON.stringify(want) + ']')
    if (!target) return { scrollables: all.length, missingAnchor: want }
    el.scrollTop = target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
  }
  return { scrollables: all.length }
}`

export async function capture({ browser, config, devices, port, rawDir }) {
  await mkdir(rawDir, { recursive: true })

  const problems = []
  const findings = []

  for (const device of devices) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.scale,
      timezoneId: config.runtime?.timezone ?? 'UTC',
      locale: config.runtime?.locale ?? 'en-US',
    })

    for (const screen of config.screens) {
      const runtime = runtimeFor(config, screen)
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]))

      await page.emulateMedia({ colorScheme: runtime.colorScheme ?? 'light' })

      // The page reads this and merges it over the run's baked-in state, so a
      // screen can be shot with a different session, clock or stored flag.
      await page.addInitScript(
        `window.__SHOTS_OVERRIDE__ = ${JSON.stringify(screen.runtime ?? {})}`,
      )

      if (runtime.clock) {
        await page.addInitScript(`{
          const shift = ${new Date(runtime.clock).getTime()} - Date.now();
          const RealDate = Date;
          const now = () => RealDate.now() + shift;
          Date = class extends RealDate {
            constructor(...args) { super(...(args.length ? args : [now()])); }
            static now() { return now(); }
          };
          Date.UTC = RealDate.UTC;
          Date.parse = RealDate.parse;
        }`)
      }

      const url =
        `http://127.0.0.1:${port}/?screen=${encodeURIComponent(screen.id)}` +
        `&top=${device.insets.top}&bottom=${device.insets.bottom}`

      await page.goto(url, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(config.settleMs ?? 2200)

      const want = screen.scroll ?? 'top'
      const scrolled = await page.evaluate(`(${SCROLL})(${JSON.stringify(want)})`)
      if (scrolled.scrollables) await page.waitForTimeout(250)

      const file = resolve(rawDir, `${device.id}-${screen.id}.png`)
      await page.screenshot({ path: file })

      // Measured after the shot, on the page that produced it, so what is
      // reported is exactly what is in the PNG.
      const probe = await page.evaluate(`(${PROBE})(${JSON.stringify(screen.title ?? null)})`)

      findings.push({
        device: device.id,
        screen: screen.id,
        clipped: probe.clipped,
        overlaps: probe.overlaps,
        echoedTitle: probe.echoedTitle,
        scrollables: scrolled.scrollables,
        missingAnchor: scrolled.missingAnchor,
        // 'top' is the default and asks nothing of the screen, so a screen with
        // nothing to scroll is not a mistake — only an explicit request is.
        scrollWanted: screen.scroll && screen.scroll !== 'top' ? screen.scroll : null,
        // The bar *and its shadow* are painted into the frame. Skip only the bar
        // and the measurement starts inside the shadow — a gradient, which reads
        // as content — so a half-empty screen comes back looking full.
        flat: await inspectImage(file, screen.tab ? TAB_BAR_BAND * device.scale : 0),
      })

      if (errors.length) problems.push(`${device.id}/${screen.id}: ${errors[0]}`)
      await page.close()
    }

    await context.close()
  }

  return { problems, findings }
}
