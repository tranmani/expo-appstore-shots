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

And it records **app-preview videos** — the real screens in motion, the store's
most underused asset, which a wrap-a-screenshot tool cannot make at all:

```bash
npx expo-appstore-shots preview     # → appstore/previews/home.mp4, …
```

```js
// in shots.config.mjs
previews: [
  { id: 'home', screen: 'home' },                      // a ~17s scroll tour
  { id: 'chat', screen: 'chat', scrollSeconds: 10, hold: 2, device: 'iphone-6.9' },
],
```

Each preview loads the real screen, eases through its content on a deterministic
curve, and captures device-pixel frames that a **bundled ffmpeg** encodes to the
exact App Store spec — H.264, yuv420p, 15–30s, 30fps, portrait device resolution
— which the run then verifies with `ffprobe` before trusting the file. Silent, so
it doubles as a YouTube promo video for Google Play (Play takes a YouTube link,
not an upload). Nothing to install: the encoder ships with the tool, like Chromium.

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
| A Skia canvas | There is no GPU canvas here, so `@shopify/react-native-skia` draws nothing. If a chart or a shader **is** the screen, point `config.stubs` at a component that draws it in ordinary views — otherwise that frame is honestly empty. |
| A map | `react-native-maps` is a native view. `MapView` renders an empty box of the right size (so the rest of the screen keeps its real layout) rather than vanishing. |
| Local data | `expo-sqlite` answers "no rows". An offline-first screen photographs as a fresh install unless you seed it — see [Seeding what `fetch` cannot reach](#seeding-what-fetch-cannot-reach). |

Screenshots must represent your app truthfully — that is an App Review rule, not
a style note. Seed fixtures with data your app could actually return, and caption
each slide with what that slide actually shows.

## Configuration

`shots.config.mjs`, in full:

```js
export default {
  projectRoot: '.',
  rootLayout: 'src/app/_layout.tsx',   // your providers + header live here.
                                       // Optional: omit it and a minimal one is
                                       // used (see "React Navigation" below).
  setup: 'shots/setup.ts',             // optional: seed what fetch cannot reach
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

  // Escape hatches. Most apps need none of these.
  stubs: { 'src/lib/keychain': 'shots/fake-keychain.ts' },  // replace a module
  redirect: { '(^|/)device-key$': 'shots/device-key.ts' },  // ↑ by import path
  redirectFile: { 'components/Chart\\.tsx$': 'shots/chart.tsx' },  // ↑ by real path
  loaders: { '.lottie': 'dataurl' },   // an asset format esbuild has no loader for
  apiPort: 8788,                       // a busy default moves; a set one does not
}
```

`stubs` and `redirect` are the same idea at two levels: `stubs` swaps a whole
package (it is an alias, so it catches every importer), `redirect` swaps a module
reached by a *relative* path. Whatever you put in `stubs` wins over the tool's own
aliases — you can replace its lucide, its Skia, its react-native-maps.

**`redirect` matches what an import says, not where it lands.** One file has as
many specifiers as it has importers — `./Chart`, `../components/Chart`,
`@/components/Chart` — and your rule has to match the one esbuild is handed, for
every importer. `redirectFile` matches the resolved path on disk instead, which
is one string however many ways the app spells it. (A barrel is not a problem
for either: `export * from './Chart'` is itself an import of `./Chart`, so a
`Chart$` rule does fire through it.)

## Composition

Every slide is `standard` by default — the caption on top, the device below, the
look the tool has always drawn. From there, a deck is a set of opt-in choices.
None of them changes a slide that doesn't ask for them.

**Layouts** — vary the composition so a deck reads with rhythm, never one long
slide (the run warns if two adjacent slides choose the same one):

```js
slides: [
  { screen: 'home',   layout: 'hero' },          // big headline, device dropped low
  { screen: 'detail', layout: 'device-top' },     // device up, caption beneath
  { screen: 'stats',  layout: 'no-device' },      // a centred statement, no phone
  { screen: 'chat',   layout: 'two-devices', screenSecondary: 'home' }, // two phones layered
  // also: device-bottom
]
```

**Themes** — five coherent light+dark palettes with a shared accent, or your own:

```js
frame: {
  theme: 'clean-light',   // clean-light · dark-bold · warm-editorial · ocean-fresh · bloom-roast
  // grounds: { light: { bg, dot, ink, muted, accent } }  ← still overrides, token by token
}
```

**Headlines** carry one accented word, and an eyebrow rides above:

```js
{ screen: 'home', eyebrow: 'Editors’ Choice', headline: 'A home for *every* coffee.' }
```

**Decorative accents** — a stat chip, a proof badge, a built-in sparkle or
squiggle, a line of text, an image — placed by fractions of the frame, so one
placement holds on every device. Sparingly, on the hero:

```js
{ screen: 'home', elements: [
  { type: 'chip', text: '4.9 ★ · 12k ratings', x: 0.72, y: 0.14, rotation: -4 },
  { type: 'squiggle', x: 0.4, y: 0.28, color: '#5B7CFA' },
]}
```

**Connected canvas** — a decorative object crosses the seam between two adjacent
slides, so the store page reads as one panorama while each screenshot still
stands alone:

```js
slides:  [{ screen: 'nearby', bridge: 'g' }, { screen: 'station', bridge: 'g' }],
bridges: { g: { elements: [{ type: 'image', src: glowDataUri, x: 0.5, y: 0.32, w: 0.6 }] } },
```

`x: 0.5` is the seam of the two-wide group; the object lands at the right edge of
the first slide and the left edge of the second. Only decorative elements bridge
— captions and devices stay whole per slide — so a headline is never split.

## React Navigation

The tool grew up around expo-router, but a React Navigation app needs no
special-casing beyond knowing which file to point at:

```js
export default {
  // Your App.tsx: every provider above the navigator mounts and runs for real,
  // and at the navigator itself the tool renders the one screen being shot.
  rootLayout: 'App.tsx',
  screens: [
    { id: 'home', module: 'src/screens/HomeScreen.tsx', route: 'Home', title: 'Home' },
  ],
  tabBar: { style: 'bar', items: [/* … */] },   // 'bar' = React Navigation's JS tabs
}
```

`createNativeStackNavigator()` and friends hand back the tool's own `Stack`, so
`<Stack.Screen name="Home" options={{ title: 'Home' }} />` puts a real title in
the header of the screen configured as `route: 'Home'`. `useNavigation`,
`useRoute`, `useFocusEffect`, `useIsFocused`, `useNavigationState` and
`useScrollToTop` are answered from the screen being photographed instead of
throwing "Couldn't find a navigation object".

Omit `rootLayout` entirely and you get a minimal one — your screen, a header, and
nothing above it. That is right for a screen with no root providers, and the run
says so on every use.

## Seeding what `fetch` cannot reach

The mock backend answers HTTP. Plenty of apps get their data another way, and
those screens photograph empty — convincingly, with no error, because an empty
list is what a fresh install looks like. It is the one failure this tool cannot
see for you.

`config.setup` is a module of yours that runs in the page, in your app's own
module world, **before the first render** (and is awaited, so async seeding
lands before anything mounts):

```js
// shots/setup.ts
import { useSession } from '../src/stores/session'
import { useTasks } from '../src/stores/tasks'

export default async function setup() {
  // An entitlement, so feature-gated screens render their unlocked path.
  useSession.setState({ user: { name: 'Sam' }, entitlements: { pro: true } })

  // A store the screens read directly — SQLite-backed, hydrated on boot, etc.
  // This is also how you switch off an `isInitializing` flag that would
  // otherwise photograph as a skeleton forever.
  useTasks.setState({ tasks: [{ id: '1', title: 'Rendered from the app' }], isInitializing: false })
}
```

Three things it solves, all of which look identical from the outside (an empty
screen):

| | |
|---|---|
| **A root bootstrap that never runs** | The harness mounts one screen, not your app root. If your data is fetched and hydrated by a root lifecycle hook, either point `rootLayout` at the file that runs it, or call it here. |
| **A local database** | `expo-sqlite` is stubbed and every query answers "no rows". Seed the store the screens read, or point `config.stubs` at your own repository/`db.ts` and return fixtures from one layer up — your screens then read their real code paths. |
| **Feature gating** | Content behind a subscription check renders empty even when its data is present. Grant the entitlement here. |

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

**Every icon in the app is gone** — lucide could not be resolved. The run says so
now, loudly, and the fix is almost always `npm install`. (It used to say nothing:
the tool concluded "no lucide", swapped in an empty stub, and every glyph in the
app quietly became nothing.)

**`No matching export … for import "X"`** — a stub is missing a name your app
imports. Every screen bundles into one file, so this fails the whole run even if
only one dev-only screen imports it. Add it yourself with `stubs`, and please
open an issue: the stub should have had it.

**`port 8788 is already in use`** — an interrupted run is still holding it.
`kill $(lsof -ti :8788)`. If you never set `apiPort` yourself, the run moves to
the next free port instead and only mentions it.

**A screen shows an empty state you did not expect** — read the end of the run.
Every API call that no fixture matched is listed there; the empty state is almost
always one of them.

**No header on a tab screen** — its header is declared in the tabs layout, which a
one-screen harness never mounts, while the root layout hides the header for the
whole tab group. Give the screen a `title`.

**The screen now says its own name twice** — the trap on the other side of that
one. If the screen already prints its name as a heading, a `title` puts it in the
bar as well and the frame carries the word twice, once small and once large, with
nothing technically wrong anywhere. Use `header: false` instead: the screen titles
itself. Every run measures the laid-out page and says so when this happens.

## Requirements

Node 20+, and Chromium (`npx playwright install chromium`, ~130MB, once). Your
Expo app needs its own `node_modules` installed — the tool bundles the app *from*
them.

**On pnpm**, `pnpm add -D expo-appstore-shots` prints `Ignored build scripts:
esbuild` and moves on. esbuild's binary is then not set up and the first run
fails somewhere unhelpful. Once:

```sh
pnpm rebuild esbuild
```

or, better, in the app's `package.json`:

```json
{ "pnpm": { "onlyBuiltDependencies": ["esbuild"] } }
```

**Works with:** expo-router (Stack and native tabs) and **React Navigation**
(native-stack, stack, bottom-tabs, drawer, elements); Reanimated 3/4, Gesture
Handler, **@gorhom/bottom-sheet**, FlashList, react-native-svg,
lucide-react-native (any version), **@shopify/react-native-skia**,
**react-native-maps**, **expo-sqlite**, **react-native-fast-confetti**,
**react-native-android-widget**; expo-location / secure-store / haptics /
notifications / constants / clipboard / crypto / device / localization /
task-manager / status-bar / camera / image-picker / media-library / file-system
(both the `File` API and the flat one) / web-browser / auth-session / linking;
react-native-iap, AsyncStorage. Anything else, stub it yourself in three lines
with `config.stubs` — and a native package that reaches for
`react-native/Libraries/…` internals resolves to a no-op instead of ending the
run.

"Works with" means *it bundles and renders*, not that it draws. A Skia canvas, a
map and a home-screen widget have no browser equivalent and are listed under
[What is real, and what is not](#what-is-real-and-what-is-not) — read that before
you trust a frame that contains one.

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
