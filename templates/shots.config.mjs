/**
 * expo-appstore-shots — configuration.
 *
 * Every path is relative to `projectRoot` (your Expo app). Start with one screen
 * and one device, get a frame out, then add the rest.
 */
export default {
  /** Where the Expo app lives (its package.json and tsconfig.json). */
  projectRoot: '.',

  /** Your root layout — the providers, theme and header the screens live inside. */
  rootLayout: 'src/app/_layout.tsx',

  /** Where finished frames go. */
  outDir: 'appstore',

  /**
   * The screens to photograph.
   *
   * `module` is the screen file; `route` is the name your root layout registers
   * it under (so `<Stack.Screen name="…" options={…}>` still applies); `params`
   * are what `useLocalSearchParams()` will return; `back: true` draws the back
   * chevron; `tab` lights that tab in the tab bar.
   */
  screens: [
    { id: 'home', module: 'src/app/(tabs)/index.tsx', route: '(tabs)', tab: 'home' },
    // { id: 'detail', module: 'src/app/item/[id].tsx', route: 'item/[id]', params: { id: '42' }, back: true },
  ],

  /**
   * The tab bar. On iOS with expo-router's native tabs, the OS draws this — a
   * browser cannot — so it is redrawn here. Icons are lucide names (any app that
   * has lucide-react-native installed); omit `enabled` or set it false if your
   * app draws its own JS tab bar, which will render on its own.
   */
  tabBar: {
    tint: '#367CED',
    items: [
      { id: 'home', label: 'Home', icon: 'House' },
      // { id: 'you', label: 'You', icon: 'CircleUserRound' },
    ],
  },

  /** The phone's state while it is being photographed. */
  runtime: {
    coords: { latitude: 52.3789, longitude: 4.9003, accuracy: 8 },
    locale: 'en-US',
    timezone: 'Europe/Amsterdam',
    /** The app's clock. Absolute times (a departure board) are rendered from it. */
    clock: '2026-03-17T09:41:00+01:00',
    /** AsyncStorage, pre-seeded — a returning user, not a first launch. */
    storage: {
      // 'app.onboarding': 'done',
    },
    secureStore: {},
  },

  /** The mock backend. */
  api: { fixtures: 'shots/fixtures.mjs' },

  /** Extra module replacements, e.g. anything touching the keychain directly. */
  // stubs: { '@/lib/device-key': 'shots/stubs/device-key.ts' },
  /** Same, but matched against the *end* of an import path (for relative imports). */
  // redirect: { '(^|/)device-key$': 'shots/stubs/device-key.ts' },

  /** `process.env.*` values compiled into the bundle. */
  env: {
    EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8788',
  },

  devices: ['iphone-6.9', 'iphone-6.5'],

  /** The look of the frame around the screen. */
  frame: {
    grounds: {
      light: { bg: '#F4F3F0', dot: '#D8D6CE', ink: '#181A17', muted: '#676F6D' },
      dark: { bg: '#17513F', dot: '#23614D', ink: '#F5F3EE', muted: '#9FC2B3' },
    },
    dots: true,
    bezel: '#111517',
    statusBar: { time: '9:41', tint: '#181A17' },
    /** Point this at your own typeface to match the app exactly. */
    // fontFile: 'assets/fonts/YourFont.ttf',
    // fontFamily: 'YourFont',
  },

  /** One entry per screenshot, in upload order. This is the marketing copy. */
  slides: [
    {
      screen: 'home',
      headline: 'Say the one true thing about this screen.',
      sub: 'One supporting line. Describe what the screenshot actually shows.',
      ground: 'dark',
      file: '01-home.png',
    },
  ],
}
