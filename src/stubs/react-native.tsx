/**
 * `react-native`, as the browser sees it.
 *
 * Everything is react-native-web's — except `Text`, which react-native-web
 * builds without `adjustsFontSizeToFit`. On a device that prop shrinks a string
 * until it fits its box; in the browser the prop is simply ignored, so the
 * string overflows and CSS truncates it to "48 260…". The screenshot is then
 * *wrong in a way that looks like an app bug*, and the tool says nothing.
 *
 * So it is implemented here: measure, and scale the font down until the text
 * fits — the same thing UIKit does, and the same result on the frame.
 */
import * as RNW from 'react-native-web'
import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react'

export * from 'react-native-web'

type TextProps = React.ComponentProps<typeof RNW.Text> & {
  adjustsFontSizeToFit?: boolean
  minimumFontScale?: number
}

/** UIKit's own floor when `minimumFontScale` is unset. */
const MIN_SCALE = 0.5

/**
 * Shrink `el`'s font until its content fits, mirroring UIKit.
 *
 * Binary search would need fewer passes, but text reflow is not monotonic at the
 * pixel level (a word wraps, and suddenly a *smaller* font is taller), so it
 * steps down instead — which is what UIKit does, and it converges in a handful
 * of iterations from a 0.5 floor.
 */
export function fitFontSize(el: HTMLElement, minScale: number): number {
  const style = window.getComputedStyle(el)
  const base = parseFloat(style.fontSize)
  if (!base) return 1

  const fits = () =>
    el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1

  // Nothing to do: it already fits at full size.
  el.style.fontSize = `${base}px`
  if (fits()) return 1

  for (let scale = 0.98; scale >= minScale; scale -= 0.02) {
    el.style.fontSize = `${base * scale}px`
    if (fits()) return scale
  }

  // Even the floor overflows. UIKit truncates here too — leave it at the floor
  // so the frame shows what the device would show, and let the verify pass flag
  // it as clipped rather than pretending it is fine.
  el.style.fontSize = `${base * minScale}px`
  return minScale
}

export const Text = forwardRef<unknown, TextProps>(function Text(props, ref) {
  const { adjustsFontSizeToFit, minimumFontScale, ...rest } = props
  const own = useRef<HTMLElement | null>(null)

  const setRef = useCallback(
    (node: HTMLElement | null) => {
      own.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as { current: unknown }).current = node
    },
    [ref],
  )

  useLayoutEffect(() => {
    if (!adjustsFontSizeToFit || !own.current) return
    fitFontSize(own.current, minimumFontScale ?? MIN_SCALE)
  })

  // `numberOfLines` is react-native-web's job and it does it properly; only the
  // shrink-to-fit half is missing, so only that half is added.
  return <RNW.Text ref={setRef as never} {...(rest as never)} />
}) as unknown as typeof RNW.Text
