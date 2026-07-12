/**
 * Photographs each screen at each device size.
 *
 * One browser context per device, because the safe-area insets and the viewport
 * are baked into the page at load. The clock is shifted (not frozen) to the
 * configured time: relative labels like "3 min ago" stay truthful and timers
 * still fire, but a departure board reads 09:41 instead of whenever CI ran.
 */
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

export async function capture({ browser, config, devices, port, rawDir }) {
  await mkdir(rawDir, { recursive: true })

  const clock = config.runtime?.clock ? new Date(config.runtime.clock).getTime() : null
  const problems = []

  for (const device of devices) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.scale,
      timezoneId: config.runtime?.timezone ?? 'UTC',
      locale: config.runtime?.locale ?? 'en-US',
      colorScheme: config.runtime?.colorScheme ?? 'light',
    })

    if (clock) {
      await context.addInitScript(`{
        const shift = ${clock} - Date.now();
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

    for (const screen of config.screens) {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]))

      const url =
        `http://127.0.0.1:${port}/?screen=${encodeURIComponent(screen.id)}` +
        `&top=${device.insets.top}&bottom=${device.insets.bottom}`

      await page.goto(url, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(config.settleMs ?? 2200)

      await page.screenshot({ path: resolve(rawDir, `${device.id}-${screen.id}.png`) })
      if (errors.length) problems.push(`${device.id}/${screen.id}: ${errors[0]}`)
      await page.close()
    }

    await context.close()
  }

  return problems
}
