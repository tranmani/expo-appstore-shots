/**
 * A `config.setup` module, as an app would write one.
 *
 * This is the escape hatch for state that does not arrive over `fetch` — a
 * zustand store to fill, a SQLite-backed repository to replace, an entitlement
 * to grant. It runs in the page, in the app's own module world, and the run
 * *awaits* it before the first render, so a screen never photographs the
 * skeleton it would show while its data was still landing.
 *
 * A real one would import the app's stores and set them:
 *
 *   useSession.setState({ user, entitlements: { pro: true }, loading: false })
 *   useTasks.setState({ tasks: fixtures.tasks, isInitializing: false })
 *
 * This one records that it ran, and that it finished *before* anything mounted.
 * `kitchen-sink.tsx` reads the flag while rendering and throws if it is missing,
 * which is what turns the e2e run into an assertion about the ordering rather
 * than a claim about it.
 */
declare global {
  interface Window {
    __SHOTS_SETUP_RAN__?: boolean
  }
}

export default async function setup(runtime: { locale: string }) {
  void runtime

  // A REAL TIMER, NOT A RESOLVED PROMISE, AND THAT IS THE WHOLE TEST.
  //
  // Seeding is async because it reads a file, opens a database, or waits on a
  // hydration promise — none of which land in the same microtask. An `await
  // Promise.resolve()` here would prove nothing: a fire-and-forget `setup()`
  // that the run never awaited would *also* have set the flag before the first
  // render, because `mount` is itself a microtask. This makes the difference
  // observable, so `kitchen-sink.tsx` fails when the awaiting is removed.
  await new Promise((done) => setTimeout(done, 30))

  window.__SHOTS_SETUP_RAN__ = true
}
