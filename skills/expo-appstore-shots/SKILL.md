---
name: expo-appstore-shots
description: Render App Store screenshots from an Expo app's own screens (react-native-web + Playwright) — use for any iOS/Android store screenshot, listing image, or marketing frame on an Expo/React Native app.
---

# expo-appstore-shots

Photograph an Expo app's **real screens** for the store — no Mac, no simulator, no
mock-ups. The tool runs the screens under react-native-web against a seeded mock
backend, shoots them with Playwright, and wraps each in a captioned store frame at
the exact size App Store Connect demands.

This is the short procedure. **[AGENTS.md](../../AGENTS.md) is the authority** — it
carries the full walkthrough, the config reference, and the reasoning behind every
step below. Read it before a real run.

## Install

```bash
npm i -D github:tranmani/expo-appstore-shots   # or pnpm add -D / yarn add -D
npx playwright install chromium                # ~130MB, once per machine
```

The tool brings its own web stack. **Do not add `react-dom` or `react-native-web`
to the app** — they are the tool's deps, not the app's. On a bare Linux box a
launch that dies on a missing `.so` wants `npx playwright install-deps chromium`,
or point `CHROME_PATH` at an installed Chrome.

## Procedure

1. **Read the app first.** `npx expo-appstore-shots init --scan` writes
   `shots.config.mjs` (every route) and `shots/fixtures.mjs` (a stub per endpoint).
   That is a first draft, not an answer — confirm by hand: the root layout
   (`rootLayout`, holds providers/theme/header), the 5–6 screens that carry the
   product, the route names (`<Stack.Screen name>`, dynamic segments need `params`),
   the tab bar, and the fetch layer with the **types** its endpoints return.
2. **Stop and ask, once.** The code cannot tell you what the set should *say* —
   which screens, in what order, the story, the caption voice, the look, the
   devices. Offer concrete options taken from their app, with "you decide" last.
   Mean it; if they take it, choose and do not ask again.
3. **Run once with no captions.** Fill `screens` + `rootLayout`, leave `slides`
   empty, run, and **look at the PNGs** — did the screens render at all? Iterate one
   screen with `--screen home --device iphone-6.9`; do not re-shoot the set.
4. **Seed fixtures until the screens look inhabited.** Empty states, permission
   prompts, login walls, onboarding modals are each a fixture or a `runtime.storage`
   flag you have not written. Shape data like the real endpoint's type; simulate a
   returning user. Write only what a real user could plausibly have — never lorem
   ipsum, never a name that reads as a real person, never a fuller list than the
   app's own rules allow.
5. **Write captions, one `slides` entry per shot, in upload order.** A caption must
   describe **what is on its own frame** — a promise the screen does not keep gets
   the listing rejected and lies to the user. Alternate `ground: 'dark'`/`'light'`;
   lead with the screen that shows what the app is *for*.
6. **Look at every frame.** A clean run is not a correct frame. Read the report:
   `✗` = the page threw; `clipped text` / `48 260…` = a native prop
   react-native-web lacks (suspect the web renderer, not an app bug); `N% flat
   colour` = seed more or drop the device; `status bar drawn over "July"` = a tab
   screen missing its header (give it a `title`); `had no fixture` = a route you
   didn't seed; `never requested` = a typo in a fixture path.

## Gotchas that cost hours

- **Units lie silently.** Epoch **seconds** (GTFS, many APIs) vs milliseconds is the
  single most common fixture bug — it renders the wrong hour, it does not error.
- **The tab bar is redrawn.** With expo-router native tabs iOS draws it, so the tool
  redraws it from `tabBar.items`. The status bar is drawn in too, and the typeface
  is **Inter, not SF Pro** (Apple won't license SF) — disclose all three unless you
  pointed `fonts` at the app's own faces.
- **iPad only if the app earns it** — `app.json` says `"supportsTablet": true`
  **and** the layout actually adapts. A stretched phone layout on a 13" canvas is a
  rejection, not a screenshot.
- **6.9" is required.** 6.9" and 6.5" render in the same viewport and differ only in
  output size.

## Store graphics (when asked)

`npx expo-appstore-shots graphics` makes the Play icon (512²), feature graphic
(1024×500) and marketing icon (1024²) from the app's own icon and brand — do not
draw them. Look at the output: the feature graphic wants the **bare mark**, not the
tile; set `promoVideo: true` if the listing has a video so the lockup clears the
stamped play button. See AGENTS.md §8.
