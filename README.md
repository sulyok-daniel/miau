# miau-lock

A friendly reminder to lock your screen. Someone left their computer unlocked? Open this page on it. It shows how long
the screen has been unlocked, along with random animal photos and cheeky sayings (in German).

**Live:** https://sulyok-daniel.github.io/miau-lock/

## Features

- Timer "Bildschirm entsperrt seit" with a highscore for the longest unlocked time
- Random photos of cats (default), dogs or capybaras, each with a saying; click, Space or Enter shows the next one
- ASCII mode: animals drawn with text characters instead of photos
- History of the last 50 pictures; a click shows one again
- Settings: fullscreen, effects, dark mode, inverted colors, auto-reload
- Settings, highscore and history are kept in the browser (`localStorage`)

## URL options

| URL | Shows |
|---|---|
| `…/miau-lock/` | cat photos |
| `…/miau-lock/?animal=dog` | dog photos (also `cat`, `capybara`) |
| `…/miau-lock/#dog-ascii` | dogs in ASCII mode |
| `…/miau-lock/#ascii` | cats in ASCII mode |

## How it works

A static page: no build step, no server of its own. The photos come from public APIs.

```
┌─ Browser ─────────────────────┐   ┌─ miau-lock (static files) ────┐   ┌─ Image APIs ──────────┐
│                               │   │                               │   │                       │
│  ┌─────────────────────────┐  │   │  ┌─────────────────────────┐  │   │                       │
│  │ 1 open index.html       │──┼───┼─►│ 2 load animals/*/*.js   │  │   │                       │
│  └─────────────────────────┘  │   │  │   and app.js            │  │   │                       │
│                               │   │  └────────────┬────────────┘  │   │                       │
│                               │   │               ▼               │   │  ┌─────────────────┐  │
│                               │   │  ┌─────────────────────────┐  │   │  │ cataas.com      │  │
│                               │   │  │ 3 ask for a random      │──┼───┼─►│ dog.ceo         │  │
│                               │   │  │   photo                 │  │   │  │ capy.lol        │  │
│                               │   │  └─────────────────────────┘  │   │  └────────┬────────┘  │
│                               │   │                               │   │           │           │
│  ┌─────────────────────────┐  │   │  ┌─────────────────────────┐  │   │           │           │
│  │ 5 show photo, saying    │◄─┼───┼──│ 4 pick a saying         │◄─┼───┼───────────┘           │
│  │   and timer             │  │   │  └─────────────────────────┘  │   │                       │
│  └─────────────────────────┘  │   │                               │   │                       │
│                               │   │                               │   │                       │
└───────────────────────────────┘   └───────────────────────────────┘   └───────────────────────┘
```

## Project structure

```
┌─ miau-lock ───────────────────────────────────────────────────────────────┐
│                                                                           │
│  ┌─ index.html ───────┐   ┌─ app.js ───────────┐   ┌─ style.css ───────┐  │
│  │ page, header icons │   │ timer, sayings,    │   │ look, light/dark, │  │
│  │ and drawers        │   │ history, settings  │   │ effects           │  │
│  └────────────────────┘   └────────────────────┘   └───────────────────┘  │
│                                                                           │
│  ┌─ animals/<name>/ (cat, dog, capybara) ──────────────────────────────┐  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────┐  │  │
│  │  │ animal.js    │  │ sayings.js │  │ phrases.js │  │ arts.js     │  │  │
│  │  │ labels,      │  │ ready-made │  │ building   │  │ ASCII art   │  │  │
│  │  │ photo source │  │ sayings    │  │ blocks     │  │             │  │  │
│  │  └──────────────┘  └────────────┘  └────────────┘  └─────────────┘  │  │
│  │                                                                     │  │
│  │  ┌──────────────┐                                                   │  │
│  │  │ highscores.js│                                                   │  │
│  │  │ record texts │                                                   │  │
│  │  └──────────────┘                                                   │  │
│  │                                                                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─ .github/workflows/pages.yml ───────────────────────────────────────┐  │
│  │ deploys to GitHub Pages and stamps the version into the page        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

The texts are `.js` files rather than `.txt` files, so the page also works when opened straight from disk.

## Run locally

Open `index.html` in a browser. No server or install is needed. The settings drawer then shows "Lokale Version".

## Add an animal

1. Copy `animals/cat/` to `animals/<name>/`.
2. In `animals/<name>/animal.js`, change the name in the paths and in `ANIMALS.<name>`, then adjust the labels and
   `randomPhoto()`.
3. Write the sayings, phrases, highscore texts and ASCII art in the other files.
4. Add `<script src="animals/<name>/animal.js"></script>` to `index.html`, before `app.js`.

The new animal then shows up in the paw menu.

## Deployment

Every push to `main` runs `.github/workflows/pages.yml`:

1. Checks out the repository with its full history.
2. Writes the version into `index.html`: the number of commits on `main`, the commit hash and its date.
3. Deploys the site to GitHub Pages.

The settings drawer shows the result, for example "Version 19 (b21d451) vom 27.11.2026".

This requires Settings -> Pages -> Source set to "GitHub Actions".

## Thanks!

A big thank you to **Sven**, **Jonas** and **Konstantin** for their ideas, help and contributions to miau-lock.

## License

Copyright 2026 Dániel Sulyok. Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

- **Non-commercial use is free:** private use, hobby projects, education, charities. Keep the copyright notice.
- **Commercial use needs a separate license.** Contact me via [GitHub](https://github.com/sulyok-daniel).

Not covered by this license, since they belong to others:

- the photos, loaded from [cataas.com](https://cataas.com), [dog.ceo](https://dog.ceo/dog-api/) and
  [capy.lol](https://capy.lol), under their own terms
- the fonts Lexend and Love Ya Like A Sister, from Google Fonts, under the SIL Open Font License
