/**
 * expo-splash-screen.
 *
 * The splash is the frame BEFORE the app — the last thing a screenshot should
 * catch. `preventAutoHideAsync` at startup and `hideAsync` once ready are the
 * whole API most apps touch, and both are no-ops here: there is no native splash
 * to hold or to dismiss, and the screen underneath is already mounted.
 *
 * (expo-router ships its own `SplashScreen` too, stubbed separately. An app can
 * import from either; both have to answer.)
 */
export const preventAutoHideAsync = async () => true
export const hideAsync = async () => undefined
export const setOptions = () => undefined
export const showAsync = async () => undefined
