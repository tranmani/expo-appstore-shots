# Setting this up in a repo you have never seen

You are an AI agent. A developer has asked you to produce App Store screenshots
for their Expo app. This file is the procedure. Follow it in order; each step
tells you what to look for and what to do when it is not there.

The goal is screenshots of the **real screens**. Do not fall back to drawing
mock-ups, and do not ship a frame you have not looked at.

---

## 0. Prerequisites — install these before anything else

The developer's machine has an Expo app and probably nothing else on this list.
Check each one and install what is missing. None of it touches their app's
runtime dependencies.

| What | Check | Install |
|---|---|---|
| Node 20+ | `node -v` | Ask the developer; do not install a Node version manager unprompted. |
| The app's own deps | `ls node_modules` in the app | `npm install` / `pnpm install` / `yarn` — match the lockfile that is there. |
| This tool | — | `npm install --save-dev expo-appstore-shots` (or `pnpm add -D`, `yarn add -D`) |
| Chromium | `npx playwright install --dry-run chromium` | `npx playwright install chromium` (~130MB, once per machine) |

On a bare Linux box, Chromium also needs system libraries. If the launch fails
with a missing `.so`, run `npx playwright install-deps chromium` (needs sudo), or
point `CHROME_PATH` at a Chrome that is already installed:

```bash
CHROME_PATH=/usr/bin/google-chrome npx expo-appstore-shots
```

Nothing else is required. There is no Python, no ImageMagick, no Xcode, no Mac.

---

## 1. Read the app before you configure it

Find, in this order:

1. **The root layout** — usually `app/_layout.tsx` or `src/app/_layout.tsx`. This
   is `rootLayout` in the config. It holds the providers, the theme and the
   header; mounting a screen without it gives you an unstyled screen.
2. **The screens worth showing.** `ls app/**/*.tsx`. Pick the ones that carry the
   product: the main list, the thing the app is *for*, the payoff screen. Skip
   settings, legal, and empty states.
3. **Route names.** Look at `<Stack.Screen name="…">` in the root layout — that
   exact string is `route` for the screen. A screen with a dynamic segment
   (`item/[id].tsx`) needs `params: { id: '…' }`.
4. **The tab bar.** If the app uses `expo-router/unstable-native-tabs`, iOS draws
   the bar and this tool must redraw it: copy the labels out of the tabs layout
   into `tabBar.items`, and tag each tab screen with `tab: '<id>'`. If the app
   draws its own JS tab bar, leave `tabBar` out — it will render on its own.
5. **The API.** Find the fetch layer (`src/lib/api.ts` or similar) and list the
   endpoints the chosen screens call, with the **types** they return. Those types
   are the contract for your fixtures.
6. **Anything that touches hardware directly** — a keychain wrapper, a device-key
   module, an analytics client. Those need a `stubs` or `redirect` entry.

## 2. Write the config, then run it once with no captions

`npx expo-appstore-shots init`, fill in `screens` and `rootLayout`, leave
`slides` empty, and run it. Every screen is shot uncaptioned. **Look at the
PNGs.** You are checking that the screens rendered at all, not that they are
pretty.

## 3. Seed the fixtures until the screens look inhabited

The first run usually produces empty states: no data, a permission prompt, a
login wall. Each of those is a fixture you have not written yet.

- **Empty list** → add the route to `shots/fixtures.mjs`, with data shaped like
  the real endpoint's type.
- **Permission prompt / "turn on location"** → the app is checking something the
  stub does not cover. Most of it is already handled; if not, seed
  `runtime.storage` or `runtime.secureStore`.
- **Onboarding or a terms modal** → seed the flag it reads in `runtime.storage`.
  You are simulating a returning user, which is who the screenshots are for.
- **Wrong times on a board** → check the units. Epoch **seconds** (GTFS, many
  APIs) versus milliseconds is the single most common fixture bug, and it does
  not error — it silently renders the wrong hour.

Write data a real user could plausibly have. Never lorem ipsum, never a name
that suggests a real person, and never a fuller list than the app's own rules
allow (if a feature only shows results within 250m, do not seed five).

## 4. Write the captions

One `slides` entry per screenshot, in upload order. A caption must describe
**what is on its own screenshot**. A promise the screen does not keep is worse
than no caption: it is the fastest way to get a listing rejected, and it is a
lie to the user.

Alternate `ground: 'dark'` / `'light'` so the set has rhythm. Lead with the
screen that shows what the app is *for*.

## 5. Verify before you hand it over

- Open every frame and look at it. Blank screens and clipped text are obvious in
  the image and invisible in the logs.
- The run prints `! device/screen: <error>` for anything the page threw. Zero of
  those, or explain each one.
- Sizes and alpha are already correct by construction, but if the developer asks:
  the iPhone slot is 1290×2796 and PNG colour type must be 2 (no alpha).
- Tell the developer plainly what is *not* the app: the seeded data, the redrawn
  tab bar, the substituted font.

## 6. What to say when you are done

Where the frames are, what each one shows, what you seeded, and anything you
noticed while doing it — a truncated label, an empty state, a screen that does
not hold up. You have just looked at every important screen of their app at 3×
zoom. That is worth reporting.

---

## Reference: the pieces

| File | Job |
|---|---|
| `shots.config.mjs` | Screens, devices, captions, the phone's state. |
| `shots/fixtures.mjs` | What the backend answers. Route table + optional WebSocket script. |
| `.shots/` | Build artifacts and raw screens. Git-ignore it. |
| `appstore/` | The frames to upload. |

Devices: `iphone-6.9` (1290×2796, required), `iphone-6.5` (1284×2778),
`ipad-13` (2064×2752), `ipad-12.9` (2048×2732). Only ship iPad frames if the app
actually declares `"supportsTablet": true` **and** its layout adapts — a
stretched phone layout on a 13" canvas is a rejection, not a screenshot.
