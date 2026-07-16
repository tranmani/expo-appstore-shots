/**
 * The root layout for an app that has not got one.
 *
 * expo-router apps always do — `app/_layout.tsx`, rendering `<Stack/>` — and
 * pointing `config.rootLayout` at it is what makes the screenshots carry the
 * app's own header, providers and theme. A React Navigation app has no such
 * file: its equivalent is `App.tsx`, wrapped in a `NavigationContainer` it
 * builds itself.
 *
 * When `config.rootLayout` is omitted, this stands in. It renders the tool's
 * `Stack`, which is the same machinery the expo-router path uses: the target
 * screen is mounted, and the header is drawn from whatever options that screen
 * declares.
 *
 * It is deliberately the *minimum*. Nothing of the app is above the screen here
 * — no providers, no theme, no bootstrap — so if the app needs any of that,
 * point `rootLayout` at a file of your own (or at `App.tsx` itself: the
 * navigator factories resolve to this same `Stack`, so a real `App.tsx` mounts
 * its whole provider tree and stops at the navigator). See `config.setup` for
 * seeding state that no provider can reach.
 */
import { Stack } from './expo-router'

export default function RootLayout() {
  return <Stack />
}
