/**
 * react-native-fast-confetti.
 *
 * It draws through Skia (`Atlas`, `useRSXformBuffer`), so it cannot render here
 * — and it does not need to. Confetti is a celebration frame: it fires *after* a
 * tap, on a screen nobody photographs mid-burst, and a still frame of falling
 * paper over a success state is not what sells the app anyway.
 *
 * The imperative handle matters more than the component: an app calls
 * `ref.current?.restart()` from an effect, and a ref that is an empty object is
 * a crash on a screen that otherwise had nothing to do with confetti.
 */
import { forwardRef, useImperativeHandle } from 'react'

const methods = {
  restart: () => undefined,
  pause: () => undefined,
  resume: () => undefined,
  reset: () => undefined,
  stop: () => undefined,
}

const confetti = () =>
  forwardRef<typeof methods, Record<string, unknown>>(function Confetti(_props, ref) {
    useImperativeHandle(ref, () => methods, [])
    return null
  })

export const Confetti = confetti()
export const PIConfetti = confetti()
export const ContinuousConfetti = confetti()
export default Confetti
