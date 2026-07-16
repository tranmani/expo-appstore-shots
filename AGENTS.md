# Setting this up in a repo you have never seen

You are an AI agent. A developer has asked you to produce App Store screenshots
for their Expo app. This file is the procedure. Follow it in order; each step
tells you what to look for and what to do when it is not there.

The goal is screenshots of the **real screens**. Do not fall back to drawing
mock-ups, and do not ship a frame you have not looked at.

## For AI agents / skills

A ready-to-use, agent-agnostic skill ships in this package at
[`skills/expo-appstore-shots/SKILL.md`](skills/expo-appstore-shots/SKILL.md) — the
same procedure as this file, distilled for auto-discovery. This AGENTS.md stays the
authority; the skill points back to it. How each ecosystem loads it:

- **Claude Code** — copy or symlink `skills/expo-appstore-shots/` into the project's
  or user's `.claude/skills/`; it loads `.claude/skills/<name>/SKILL.md`.
- **Gemini CLI** — reference the skill file from `GEMINI.md`, or point the agent at
  `skills/expo-appstore-shots/SKILL.md` directly.
- **OpenAI Codex / GPT and other AGENTS.md-aware agents** — nothing to install; they
  already read this file, so this pointer suffices.

See [`skills/README.md`](skills/README.md) for the per-agent install commands. The
rest of this document is the full procedure.

Two steps are not optional. **Step 2**: once you have read the app, stop and ask
the developer what the set should say — the code cannot tell you that, and the
cheapest time to be wrong about it is before you have made six frames. **Step 7**:
open every frame and look at it, because a clean run is not a correct frame.

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

The tool brings its own web stack. **Do not add `react-dom` or `react-native-web`
to the app** — they are this tool's dependencies, not the app's, and a DOM package
sitting in a native app's tree is something Metro can trip over.

On a bare Linux box, Chromium also needs system libraries. If the launch fails
with a missing `.so`, run `npx playwright install-deps chromium` (needs sudo), or
point `CHROME_PATH` at a Chrome that is already installed:

```bash
CHROME_PATH=/usr/bin/google-chrome npx expo-appstore-shots
```

Nothing else is required. There is no Python, no ImageMagick, no Xcode, no Mac.

### pnpm, and monorepos

pnpm's default layout is strict: a package can only import what it declares. If
the tool's own dependencies come back unresolvable — `playwright`, `esbuild`,
`pngjs` — the install did not link them, which is usually one of:

- **Installed from a git URL rather than npm.** `pnpm add -D expo-appstore-shots`
  from the registry. A git dependency records the dep graph without building it.
- **A workspace.** Install the tool in the *app's* package (`apps/mobile`), not at
  the workspace root, so it lands next to the app it photographs.
- **`node-linker=hoisted`.** Works, but re-install after adding the tool
  (`rm -rf node_modules && pnpm install`) rather than expecting an incremental add
  to link it.

Confirm with `npx expo-appstore-shots --help`. If that runs, the install is sound.

---

## 1. Read the app before you configure it

**Start with `npx expo-appstore-shots init --scan`.** It reads `app.json`, walks
the router directory, parses the tabs layout and greps the fetch layer, then
writes a `shots.config.mjs` listing *every* route and a `shots/fixtures.mjs` with
a stub per endpoint it saw. That is a first draft, not an answer — it cannot know
which five screens sell the app. Cut it down and put real data in the fixtures.

Then confirm each of these by hand, because the scan guesses and you should not:

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

## 2. Now stop, and ask.

You have read the app. You know what screens exist, what the tabs are and what
the API answers. What you do **not** know is what this listing is supposed to say
— and none of it is inferable from the code. Guessing it and producing six
finished frames means the developer's first chance to disagree comes *after* all
the work, which is the expensive place to disagree.

So before you write a single caption: **ask, once, in a single message.** Offer
concrete options taken from what you actually found in *their* app — never
generic ones — and make the last option "you decide".

Ask about these five, and nothing else:

| | Offer them |
|---|---|
| **Screens** | The 5–6 you would pick, named, in order, each with one line on why it earns a slot. Say which you are leaving out. |
| **Story** | What the set argues, in one sentence. Usually there are two or three honest readings of the same app — offer them; they are not interchangeable. |
| **Caption voice** | Short and declarative? Benefit-led? Or none at all, letting the screens speak? Show one caption written each way, for the same screen, so the difference is visible rather than described. |
| **Look** | Caption ground colour and light/dark. Take the colours from the app's own theme file; do not invent a palette. |
| **Devices** | 6.9" is required. iPad only if `app.json` says `"supportsTablet": true` **and** the layout actually adapts — a stretched phone layout on a 13" canvas is a rejection, not a screenshot. |

Then, as the final option, plainly:

> **Or say "you decide" and I will pick all of the above and show you the
> frames.** Changing any of it afterwards is cheap — one screen re-shoots in
> seconds with `--screen <id>`.

Mean that offer. If they take it, choose confidently and do not ask again — an
agent that asks for permission at every step is worse than one that never asked.
The point of the question is to be wrong *before* the work, not to move the
decision onto them.

**Do not ask about anything you can find out yourself.** Route names, the tab
labels, which endpoints a screen calls, what the theme colours are — those are in
the repo. Reading them is your job. This question is only for the things that
live in the developer's head.

## 3. Three traps, before you lose an hour to them

**A tab screen has no header unless you ask for one.** A tab's header is declared
in `(tabs)/_layout.tsx` — a navigator this tool does not mount — and the root
layout usually sets `headerShown: false` for the whole group. So a tab screen
renders at `y = 0`, with the status bar printed over its first row of content,
and nothing about that looks like an error. Give every tab screen a `title`, or
`header: false` if it draws its own. The run warns you if you forget.

**react-native-web does not implement every native prop.** The one that bites is
`adjustsFontSizeToFit`: on a device it shrinks a number until it fits its tile, and
in a plain browser it does nothing, so the number overflows and is truncated to
`48 260…`. This tool shims that specific prop, but others may be missing. **When a
frame looks wrong, suspect the web renderer before you report an app bug** — you
are looking at the app's code through react-native-web, not at the app.

**Fixture routes are matched most-specific-first.** `GET /bookings/today-count`
beats `GET /bookings/:id` no matter which you declare first, so you can write them
in any order.

## 4. Write the config, then run it once with no captions

Fill in `screens` and `rootLayout`, leave `slides` empty, and run it. Every screen
is shot uncaptioned. **Look at the PNGs.** You are checking that the screens
rendered at all, not that they are pretty.

Iterating on one screen? Do not re-shoot the set:

```bash
npx expo-appstore-shots --screen home --device iphone-6.9
```

## 5. Seed the fixtures until the screens look inhabited

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

## 6. Write the captions

One `slides` entry per screenshot, in upload order. A caption must describe
**what is on its own screenshot**. A promise the screen does not keep is worse
than no caption: it is the fastest way to get a listing rejected, and it is a
lie to the user.

Alternate `ground: 'dark'` / `'light'` so the set has rhythm. Lead with the
screen that shows what the app is *for*.

## 7. Verify before you hand it over

**Open every frame and look at it.** This is not optional and nothing replaces it.
A clean run is not a correct frame: every check below exists because a run once
reported success and handed over a polished 1290×2796 PNG that was not shippable.

The run tells you what it can. Read the report at the end:

| Line | Means |
|---|---|
| `✗ device/screen: …` | The page **threw**. The screen did not render. Fix, or explain each one. |
| `! … clipped text — "48 260…"` | Text is cut off. Usually a native prop react-native-web lacks, not an app bug. |
| `! … N% of the frame is one flat colour` | Dead space: the list ran out of data before the screen ran out of room. Seed more, or drop the device. |
| `! … the status bar is drawn over "July"` | Content is under the chrome. Usually the missing-header trap above. |
| `! … had no fixture` | A route the app called and you did not seed. The empty state in the frame is this. |
| `! … fixture(s) were never requested` | The mirror image, and almost always a **typo in a fixture path**. |
| `! … lucide has no icon "BarChart3"` | A renamed icon, rendering as a hole in the tab bar. Take the suggestion. |

Then check by eye what no tool can:

- Sizes and alpha are correct by construction, but if the developer asks: the
  iPhone slot is 1290×2796 and PNG colour type must be 2 (no alpha).
- Tell the developer plainly what is *not* the app: the seeded data, the redrawn
  tab bar, and the font — unless you pointed `fonts` at the app's own faces, in
  which case say that you did.

## 8. If the listing ships in more than one language

The store shows a different screenshot set per localization, and the right set is
not the base set with translated captions pasted over it — it is the **app itself
rendered in that language**. Reviewers and users in a store region expect the
chrome to be in their language too: the nav titles, the section headers, the
buttons, the pluralised counts. You get all of that for free, because you are
photographing the real screens; you just have to put the app into the language
first.

Do not fork the config. Keep `shots.config.mjs` as the default language, and add
one thin `shots.<lang>.config.mjs` per extra language that imports the base and
overrides **only** what changes:

1. **The app's own language.** This is the whole point of the section. Flip the
   app into the target language so the UI it draws is genuinely localised. A
   locale-aware app reads the device locale, so set `runtime.locale`. But **most
   apps persist the user's language choice** — a returning user picked it once and
   it lives in storage — and such an app ignores the device locale entirely. So
   also seed the key the app reads (an AsyncStorage key like `app.lang`) in
   `runtime.storage`. Setting `locale` alone and getting an English screen back is
   this trap, not a bug: find the key in the app's language code and seed it too.
2. **`slides`** — the captions, translated. This is the marketing copy.
3. **`outDir`** — a per-language folder (`appstore/en`, `appstore/nl`), so each
   set uploads into the localization it belongs to and nothing overwrites.
4. **Screen `params` that carry human text** — a room name, a thread title, a
   header passed in rather than fetched. Override just those screens by mapping
   over `base.screens`; leave the rest inherited.
5. **`api.fixtures`, but only if the seeded content is human-readable text.** App
   *generated* strings — interpolated counts, button labels, section headers —
   localise on their own from step 1, so they need no second fixtures file. Only
   the **free text a person wrote** — chat messages, post bodies, user handles —
   has to differ per language, or an English screen shows Dutch content. Factor
   the language-varying strings into a shared builder (`fixtures.base.mjs`
   exporting `makeFixtures(strings)`) plus a thin string table per language
   (`fixtures.mjs`, `fixtures.nl.mjs`), and point each config's `api.fixtures` at
   the matching one. **Do not translate proper nouns** — place names, station
   codes, numbers stay as they are.

Everything else — `rootLayout`, the screen modules, `tabBar`, `frame`, `devices`
— is inherited untouched. Because the paths in the base config are resolved
relative to whichever config file loaded them, the sibling `shots.nl.config.mjs`
resolves them exactly as the base did.

```js
// shots.nl.config.mjs — Dutch. Everything not named here is the base config.
import base from './shots.config.mjs'

export default {
  ...base,
  outDir: 'appstore/nl',
  runtime: {
    ...base.runtime,
    locale: 'nl-NL',
    storage: { ...base.runtime.storage, 'app.lang': 'nl' }, // the persisted choice
  },
  // Only screens whose params carry human text; the rest stay as inherited.
  screens: base.screens.map((s) =>
    s.id === 'room' ? { ...s, params: { ...s.params, title: 'Perron 3' } } : s,
  ),
  api: { fixtures: 'shots/fixtures.nl.mjs' }, // human-readable seeded content only
  slides: [
    { screen: 'home', headline: 'Alles op één perron.', ground: 'dark', file: '01-home.png' },
    // …one per screenshot, in upload order, translated.
  ],
}
```

Run it once per language — `npx expo-appstore-shots shots.nl.config.mjs` (the first
`.mjs` argument is the config it loads) — **verify each set by eye the same way as
§7**, and upload each `outDir` into the matching App Store Connect / Play Console
localization. The payoff is the point: every set is the real localised app, not a
translation laid over one language's screens.

## 9. If they need the store graphics too

Publishing on Play needs a **512×512 icon** and a **1024×500 feature graphic** before
the listing will go live; App Store Connect wants a **1024×1024 marketing icon**. When
somebody asks you for one of those, do not draw it — `npx expo-appstore-shots graphics`
makes all three from the app's own icon and the brand already in the config.

Add a `graphics` block and run it. Then **look at what came out**, exactly as with the
frames:

- The icon should be the app's real tile, full-bleed, corners untouched (both stores
  mask it themselves — round it yourself and it gets rounded twice).
- The feature graphic should show the **bare mark** on the brand ground. If it shows a
  hard-edged square of white floating in the middle, the app has no bare mark and the
  tile was used instead — the run says so. Find the transparent one (`logo-mark.png`,
  or a mark inside the app's own logo component) and point `graphics.mark` at it.

Two failure modes to take seriously, because no store rejects them — the author finds
out from the listing:

- Play **crops** the feature graphic. A long app name is the usual casualty. The run
  measures the real laid-out box and warns.
- A listing with a promo video gets a **play button stamped over the centre** of the
  feature graphic. Set `promoVideo: true` and the composition stacks out of its way.

If the app has neither a wordmark you can copy nor a one-line description, **ask** —
this is the store listing, and inventing a tagline for somebody's product is not your
call.

## 10. What to say when you are done

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
| `appstore/graphics/` | The Play icon, feature graphic and marketing icon (`graphics`). |

Devices: `iphone-6.9` (1290×2796, required), `iphone-6.5` (1284×2778),
`ipad-13` (2064×2752), `ipad-12.9` (2048×2732). Only ship iPad frames if the app
actually declares `"supportsTablet": true` **and** its layout adapts — a
stretched phone layout on a 13" canvas is a rejection, not a screenshot.

6.9" and 6.5" are rendered in the **same viewport** and differ only in output
size, which is why the run says `5 screens × 2 viewports → 3 device sizes`. Two
viewports, three folders. That is not a bug.

### Options worth knowing

| In the config | Does |
|---|---|
| `fonts: { Lato: 'assets/fonts/Lato.ttf' }` | Loads the app's **real** typefaces, so the screen is set in them. Without it everything falls back to one substituted face, which you then have to disclose. |
| `screens[].runtime` | Overrides `storage` / `secureStore` / `clock` / `colorScheme` / `coords` for one screen. This is how the same module is shot in two states — a calendar in agenda view *and* in month view. |
| `runtime.colorScheme: 'dark'` | Shoots dark mode. Nearly free, and dark frames sell. |
| `screens[].scroll` | `'top'` (default), `'end'`, a pixel offset, or a `testID` to scroll to. Warns if the screen has nothing that scrolls. |
| `screens[].title` / `header` | See the tab-screen trap above. |
| `tabBar.style` | `'capsule'` (expo-router native tabs, iOS 26) or `'bar'` (React Navigation's flat JS bar). Pick the one the app actually ships. |
