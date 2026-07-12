# expo-appstore-shots

App Store screenshots rendered from your Expo app's **own code**. No Mac, no
simulator, no Figma mock-ups, no hand-editing a PNG that drifts from the product
three commits later.

It runs your real screens in a headless browser — `react-native` aliased to
`react-native-web`, the native modules stubbed, your backend replaced by seeded
fixtures — photographs them, and wraps each shot in a store frame with your
caption on it.

```bash
npm install --save-dev expo-appstore-shots
npx playwright install chromium     # once
npx expo-appstore-shots init        # writes shots.config.mjs + shots/fixtures.mjs
npx expo-appstore-shots             # → appstore/6.9/01-home.png, …
```

Output is the exact pixel size App Store Connect demands (1290×2796 and friends),
PNG, no alpha channel — ready to upload.

## What is real, and what is not

**Real:** everything inside the phone. Your screens run their own code — your
providers, your query client, your theme, your i18n, your auth bootstrap, your
geofence check, your sockets. If a screen cannot render in this harness, it
cannot render in production either.

**Not real, and honestly so:**

| | Why |
|---|---|
| The API answers | Seeded, by you, in `shots/fixtures.mjs` — shaped like your real endpoints. |
| The tab bar | With expo-router's native tabs, **iOS** draws it, not your app. It is redrawn from your config. Set `tabBar.enabled: false` if your app draws its own. |
| The status bar | react-native-web has none, so it is drawn into the safe-area strip your app leaves empty (9:41, full battery — Apple's own convention). |
| The typeface | The device runs SF Pro, which Apple does not license for redistribution. Inter stands in unless you point `frame.fontFile` at your app's own font. |

Screenshots must represent your app truthfully — that is an App Review rule, not
a style note. Seed fixtures with data your app could actually return, and caption
each slide with what that slide actually shows.

## Configuration

`shots.config.mjs`, in full:

```js
export default {
  projectRoot: '.',
  rootLayout: 'src/app/_layout.tsx',   // your providers + header live here
  outDir: 'appstore',

  screens: [
    { id: 'home',   module: 'src/app/(tabs)/index.tsx', route: '(tabs)', tab: 'home' },
    { id: 'detail', module: 'src/app/item/[id].tsx', route: 'item/[id]',
      params: { id: '42' }, back: true },
    // A tab screen whose header is declared in the tabs layout (never mounted
    // here) needs its title given: `title` implies a header, `header` forces it
    // either way. `scroll: 'end'` opens a chat on its newest message.
    { id: 'chat',   module: 'src/app/chat/[id].tsx', route: 'chat/[id]',
      params: { id: '7' }, back: true, scroll: 'end' },
  ],

  tabBar: {
    style: 'capsule',                  // 'capsule' = iOS native tabs; 'bar' = React Navigation's JS tabs
    tint: '#367CED',
    idle: '#0B0B0B',
    background: '#FFFFFF',
    items: [                           // lucide icon names
      { id: 'home', label: 'Home', icon: 'House' },
      { id: 'you',  label: 'You',  icon: 'CircleUserRound' },
    ],
  },

  runtime: {                           // the phone's state while it is photographed
    coords: { latitude: 52.3789, longitude: 4.9003, accuracy: 8 },
    locale: 'en-US',
    timezone: 'Europe/Amsterdam',
    clock: '2026-03-17T09:41:00+01:00',       // absolute times render from this
    storage: { 'app.onboarding': 'done' },    // AsyncStorage, pre-seeded
  },

  api: { fixtures: 'shots/fixtures.mjs' },
  env: { EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8788' },

  devices: ['iphone-6.9', 'iphone-6.5'],      // also: ipad-13, ipad-12.9

  frame: {
    grounds: {
      light: { bg: '#F4F3F0', dot: '#D8D6CE', ink: '#181A17', muted: '#676F6D' },
      dark:  { bg: '#17513F', dot: '#23614D', ink: '#F5F3EE', muted: '#9FC2B3' },
    },
    dots: true,
    bezel: '#111517',
    statusBar: { time: '9:41', tint: '#181A17' },
  },

  slides: [                            // ← your marketing copy lives here
    { screen: 'home', ground: 'dark', file: '01-home.png',
      headline: 'The one true thing about this screen.',
      sub: 'A supporting line that describes what is actually on it.' },
  ],
}
```

### Fixtures

Keys are `METHOD /path`, `:name` matches any segment, and a value can be data or
a function of `{ params, query }`:

```js
export const routes = {
  'POST /api/session': { token: 'demo', userId: 'u_1' },
  'GET /api/items': [{ id: '1', title: 'Rendered from the app' }],
  'GET /api/items/:id': ({ params }) => ({ id: params.id, title: 'One item' }),
}

export const fallback = {}       // anything unmatched
export const prefix = '/api/'    // everything under here is the API

/** If your app opens a WebSocket, script what it receives on connect. */
export function ws(send) {
  send({ type: 'history', messages: [{ id: 'm1', body: 'Anyone else stuck here?' }] })
}
```

## When a screen comes out wrong

**Blank, with a React #527 error** — your app's React and the bundled react-dom
disagree. Install a matching react-dom in the app: `npm i -D react-dom@19`.

**A permission prompt or an empty state** — the app is reading state this tool
does not know about. Seed it: `runtime.storage`, `runtime.secureStore`, or a
fixture route.

**A module the browser cannot load** (a keychain wrapper, an analytics client)
— replace it. `stubs` matches an import path exactly; `redirect` matches the end
of one, which is how you catch a module imported relatively from several places:

```js
stubs:    { '@/lib/device-key': 'shots/stubs/device-key.ts' },
redirect: { '(^|/)device-key$': 'shots/stubs/device-key.ts' },
```

**Something below the fold is missing** — the screen is taller than the viewport.
That is also true on device; scroll position is what a screenshot captures.

**A screen shows an empty state you did not expect** — read the end of the run.
Every API call that no fixture matched is listed there; the empty state is almost
always one of them.

**No header on a tab screen** — its header is declared in the tabs layout, which a
one-screen harness never mounts, while the root layout hides the header for the
whole tab group. Give the screen a `title`.

## Requirements

Node 20+, and Chromium (`npx playwright install chromium`, ~130MB, once). Your
Expo app needs its own `node_modules` installed — the tool bundles the app *from*
them.

Works with: expo-router (Stack and native tabs), Reanimated, Gesture Handler,
FlashList, react-native-svg, lucide-react-native, expo-location / secure-store /
haptics / notifications / constants / clipboard / crypto / device / localization
/ task-manager / status-bar, react-native-iap, AsyncStorage. Anything else, stub
it yourself in three lines.

## For AI agents

See [AGENTS.md](AGENTS.md) — a step-by-step procedure for setting this up in an
unfamiliar repo, including how to discover the screens, what to seed, and how to
check the result.

MIT.
