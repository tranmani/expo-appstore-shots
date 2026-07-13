/**
 * A real config, from the app this tool was built for: Perron, an anonymous
 * chat room for the Dutch train station you are standing on.
 *
 * It exercises everything the tool has: a location gate, a session bootstrap, a
 * live WebSocket room, a native tab bar, a keychain-backed device key, and six
 * screens across two device classes.
 *
 * Run it from a checkout of https://github.com/tranmani/perron:
 *   npx expo-appstore-shots examples/perron/shots.config.mjs
 */
export default {
  projectRoot: '../../../perron/apps/mobile',
  rootLayout: 'src/app/_layout.tsx',
  outDir: '../../appstore-v2',

  screens: [
    { id: 'station', module: 'src/app/station/[code].tsx', route: 'station/[code]', params: { code: 'ASD' }, back: true },
    { id: 'room', module: 'src/app/room/[roomId].tsx', route: 'room/[roomId]', back: true,
      params: { roomId: 'r-disruption', code: 'ASD', title: 'Storing: seinstoring tussen Amsterdam C. en Haarlem', disruption: '1' } },
    { id: 'nearby', module: 'src/app/(tabs)/index.tsx', route: '(tabs)', tab: 'nearby', header: false },
    { id: 'passport', module: 'src/app/passport/[authorId].tsx', route: 'passport/[authorId]', params: { authorId: 'u_demo' }, back: true },
  ],

  tabBar: {
    tint: '#367CED',
    items: [
      { id: 'nearby', label: 'Nearby', icon: 'MapPin' },
      { id: 'leaderboard', label: 'Leaderboard', icon: 'Trophy' },
      { id: 'you', label: 'You', icon: 'CircleUserRound' },
    ],
  },

  runtime: {
    // On the platform at Amsterdam Centraal — inside the 250m fence, so the
    // rooms unlock instead of showing the "walk closer" nudge.
    coords: { latitude: 52.3789, longitude: 4.9003, accuracy: 8 },
    locale: 'en-NL',
    timezone: 'Europe/Amsterdam',
    clock: '2026-03-17T09:41:00+01:00',
    storage: { 'perron.eula.v1': 'accepted', 'perron.theme': 'light' },
  },

  api: { fixtures: '../../../expo-appstore-shots/examples/perron/fixtures.mjs' },

  // The device key lives in the secure enclave and is imported by relative path
  // from several modules, so it is matched by path tail rather than by alias.
  redirect: { '(^|/)device-key$': '../../../expo-appstore-shots/examples/perron/device-key.ts' },

  env: { EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8788' },

  devices: ['iphone-6.9', 'iphone-6.5'],

  frame: {
    grounds: {
      light: { bg: '#F4F3F0', dot: '#D8D6CE', ink: '#181A17', muted: '#676F6D' },
      dark: { bg: '#17513F', dot: '#23614D', ink: '#F5F3EE', muted: '#9FC2B3' },
    },
    bezel: '#111517',
    statusBar: { time: '9:41', tint: '#181A17' },
  },

  // The listing art. It inherits the ground, the dots and the typeface from `frame`
  // above, so the feature graphic cannot end up in a different green from the
  // screenshots sitting next to it on the same store page. The icon is not stated: it
  // is `assets/icon.png`, which is where Expo already keeps it.
  graphics: {
    targets: ['play-icon', 'play-feature', 'ios-marketing'],
    outDir: '../../appstore-v2/graphics',
    iconBackground: '#FDFBF8',
    accent: '#1C6B4F',
    wordmark: 'Perron',
    tagline: 'Chat with the platform you are standing on.',
    note: 'Anonymous. Only while you are there.',
  },

  slides: [
    { screen: 'station', ground: 'dark', file: '01-station.png',
      headline: 'Every station has a room.',
      sub: 'Departures, delays, and the people standing right next to you.' },
    { screen: 'room', ground: 'light', file: '02-disruption.png',
      headline: 'A delay opens its own room.',
      sub: 'Compare notes with the people stuck on the same platform.' },
    { screen: 'nearby', ground: 'dark', file: '03-nearby.png',
      headline: 'Only when you are actually there.',
      sub: 'One station: the one under your feet. A room opens within 250 metres, and nowhere else.' },
    { screen: 'passport', ground: 'light', file: '04-passport.png',
      headline: 'Collect the whole network.',
      sub: 'A stamp for every one of the 397 stations you have really stood on.' },
  ],
}
