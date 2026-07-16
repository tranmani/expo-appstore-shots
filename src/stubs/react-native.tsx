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
import { anything } from './anything'

export * from 'react-native-web'

/**
 * The two things `react-native` exports that react-native-web does not, and that
 * an app can reach for without ever meaning to render them.
 *
 * `DevSettings` is imported by dev-only screens; `TurboModuleRegistry` is how a
 * native package (react-native-android-widget, and most of the new-architecture
 * ecosystem) asks for its native side. Neither exists in a browser, and neither
 * is missed in a still frame — but a missing *export* is not a missing feature,
 * it is `No matching export`, and that fails the whole bundle. Every screen
 * bundles together here, so one dev-only import takes down the entire run.
 */
export const DevSettings = {
  addMenuItem: () => undefined,
  reload: () => undefined,
}

/**
 * THE SKELETON THAT NEVER LEAVES.
 *
 * The best kind of bug: every part behaves exactly as designed, and the result
 * is a photograph of a loading state that can never finish.
 *
 * A screen defers its post-mount work — "fill this card in once the animations
 * have settled" — with `InteractionManager.runAfterInteractions(…)`, and shows a
 * skeleton until it runs. react-native-web schedules that with
 * `requestIdleCallback` and **no timeout**, so it waits for an idle frame. The
 * skeleton is a shimmer: an infinite `Animated.loop`, which on web is rAF. The
 * page therefore never goes idle, the callback never runs, and the skeleton
 * never turns itself off. The shimmer starves the callback that would remove the
 * shimmer.
 *
 * On a device it resolves in a frame and nobody ever sees it. Here it is a
 * permanent grey rectangle where the product should be — with no error, no
 * warning, and a run that reports success.
 *
 * So interactions do not exist here, for the same reason `useFocusEffect` runs
 * once and never blurs: a still frame has nothing to wait for. The task runs on
 * the next macrotask — still asynchronous, so the ordering the caller asked for
 * holds, minus the waiting.
 */
type Task = (() => void) | { run?: () => void; gen?: () => void }

export const InteractionManager = {
  ...(RNW.InteractionManager as object),
  runAfterInteractions(task?: Task) {
    let cancelled = false
    const done = new Promise<void>((resolve) => {
      setTimeout(() => {
        if (!cancelled) {
          if (typeof task === 'function') task()
          else task?.run?.()
        }
        resolve()
      }, 0)
    })
    // RN hands back `{ then, done, cancel }`, and callers use all three.
    return {
      then: done.then.bind(done),
      done: done.then.bind(done),
      cancel: () => {
        cancelled = true
      },
    }
  },
  createInteractionHandle: () => 1,
  clearInteractionHandle: () => undefined,
  setDeadline: () => undefined,
  addListener: () => ({ remove: () => undefined }),
}

/**
 * `getEnforcing` is named for what it does: it throws when the module is absent.
 * It must not — but it must not hand back `{}` either.
 *
 * A package does not call `getEnforcing('Foo')` to look at it; it calls it and
 * then uses it, at module scope: `getEnforcing('Foo').addListener(…)`. An empty
 * object answers the first half and throws on the second, which is a crash with
 * a friendly name rather than a stub. `get` may return null — callers check it,
 * that is why it exists — but whatever `getEnforcing` returns has to survive
 * being used.
 */
export const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: () => anything(),
}

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
