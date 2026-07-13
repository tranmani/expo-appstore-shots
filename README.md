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

It also draws the listing art that is *not* a screenshot, from the same brand:

```bash
npx expo-appstore-shots graphics    # → Play icon 512², feature graphic 1024×500,
                                    #   App Store marketing icon 1024²
```

## Store graphics

The stores want more than screens. Play will not publish without a **512×512 icon**
and a **1024×500 feature graphic**; App Store Connect wants a **1024×1024 marketing
icon**. These are the assets people open a drawing program for — and the assets that
end up in a slightly different green from the app, in a typeface the app does not
use, because they were drawn somewhere your tokens do not reach.

`graphics` makes them from what you already have. The icon is your `assets/icon.png`.
The ground, the dots and the typeface are the ones your screenshot frames use. Nothing
is redrawn, so nothing can drift — and the icon, the feature graphic and the screenshots
sitting side by side on one store page are finally the same brand.

```js
graphics: {
  targets: ['play-icon', 'play-feature', 'ios-marketing'],
  wordmark: 'Perron',
  tagline: 'Chat with the platform you are standing on.',
  note: 'Anonymous. Only while you are there.',
  accent: '#1C6B4F',
  iconBackground: '#FDFBF8',
  // icon: 'assets/icon.png'       — found automatically
  // mark: 'assets/logo-mark.png'  — found automatically; see below
  // promoVideo: true              — if your listing has one; see below
}
```

**An icon tile and a bare mark are not the same picture.** `icon` is the finished
square tile — art plus its own ground — and it is what both stores want, full-bleed,
corners left alone (they mask it themselves; a pre-rounded icon gets rounded twice).
The feature graphic wants the **mark alone**, on the feature graphic's ground. Give it
the tile instead and you get a hard-edged square of a slightly-wrong white floating in
the middle of your brand surface. If your app has no bare mark the tile is used and
rounded, so it at least reads as an app icon on purpose — and the run says so.

**Two things no store will reject, which is worse — you find out from the listing:**

- Play **crops** the feature graphic to other aspect ratios in placements you do not
  choose. Anything near an edge gets cut. Every run measures the laid-out lockup and
  warns if it reaches within 6% of one — which is how a long app name gets caught,
  because a wordmark cannot wrap and so it is the thing that runs off.
- If your listing has a **promo video**, Play draws a play button over the *centre* of
  the feature graphic. Centring your logo is the natural thing to do and it is exactly
  wrong. Set `promoVideo: true` and the composition stacks instead of centring, so the
  lockup clears the button — and it is checked, not assumed.

Every asset is written at the exact pixel size, opaque (Chromium always writes an alpha
channel; App Store Connect refuses one and will not tell you which file), and checked
against the store's byte ceiling before you upload it.

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

Point your agent at it and it will read the app, then **come back and ask you
what the set should say** — which screens, in what order, what the captions argue,
what the frames look like — offering choices drawn from your own code, with "you
decide" as the last option. It cannot get that out of the repo, and the cheapest
moment to disagree is before six frames exist. Say "you decide" and it will.

MIT.
