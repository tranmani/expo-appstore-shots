/** The config the test suite drives. Small on purpose: one screen, one device. */
export default {
  projectRoot: '.',
  rootLayout: 'src/app/_layout.tsx',
  outDir: 'out',
  workDir: '.shots',

  screens: [
    { id: 'home', module: 'src/app/index.tsx', route: 'index', tab: 'home' },
    // Not a slide — it is never framed. It is here so that the run compiles and
    // renders every import a modern native-heavy app makes. See the file.
    //
    // Deliberately NO `title`: a config title would override the one the layout
    // registers for this route, and it is that registration the screen asserts.
    { id: 'kitchen-sink', module: 'src/app/kitchen-sink.tsx', route: 'kitchen-sink', header: true },
  ],

  tabBar: {
    tint: '#17513F',
    items: [
      { id: 'home', label: 'Home', icon: 'House' },
      { id: 'you', label: 'You', icon: 'CircleUserRound' },
    ],
  },

  runtime: {
    coords: { latitude: 52.379, longitude: 4.9, accuracy: 8 },
    locale: 'en-NL',
    timezone: 'Europe/Amsterdam',
    clock: '2026-03-17T09:41:00+01:00',
    storage: { 'fixture.seen': 'returning user' },
  },

  // State that does not arrive over `fetch`. Here it only records that it ran
  // before the first render — kitchen-sink.tsx throws if it did not.
  setup: 'src/app/setup.ts',

  api: { fixtures: 'shots/fixtures.mjs' },
  // iPhone, an Android phone, and an Android tablet — so the e2e proves every
  // device CLASS emits the exact store pixel size, opaque, not just the iPhone.
  devices: ['iphone-6.9', 'android-phone', 'android-tablet-7'],

  slides: [
    {
      screen: 'home',
      headline: 'Shot from the code.',
      sub: 'This frame was rendered by the app itself.',
      ground: 'dark',
      file: '01-home.png',
    },
  ],
}
