# Contributing to Santa

Thanks for helping out. Santa aims to stay **small**: any feature should be
explainable to a non-technical family member in one sentence.

## Getting set up

```bash
npm install
npm run build        # builds apps/api and apps/web
npm test             # runs the API test suites
npm run locales:check
```

See the [README](./README.md) for running the app locally.

## Project layout

- `apps/api` — NestJS API (also serves the built web app in production)
- `apps/web` — React + Vite single-page app
- `locales/` — app translations (`en.json`, `fr.json`, …), flat ICU keys
- `themes/` — per-theme palette, wording and (later) illustrations
- `docs/` — the build spec and screen descriptions

## Adding a language

English is the source of truth. CI fails on a missing or orphan key, and a
missing string falls back to English at runtime. To add a language (three steps):

1. **Copy** `locales/en.json` to `locales/<code>.json` (e.g. `locales/it.json`),
   and copy each `themes/<theme>/locales/en.json` to `<code>.json` too.
2. **Translate** every value. Keep the keys unchanged. These are
   [ICU MessageFormat](https://formatjs.io/docs/core-concepts/icu-syntax/)
   strings — keep the `{placeholders}` and plural forms intact. Never split one
   sentence across several keys.
3. **Register** the code: add it to `SUPPORTED_LANGUAGES` in
   `apps/api/src/i18n/i18n.service.ts` (and the matching list in the web app).

Then run `npm run locales:check` to confirm there are no missing or orphan keys.

## Secrecy rules are invariants

The spec lists eleven secrecy rules (see `docs/Santa build specs.md`). A change
that breaks one is a bug whatever else it achieves. In particular: the only
endpoint that returns a recipient is the reveal endpoint, and only the caller's
own recipient; every response is built from an explicit per-viewer DTO; the
recipient's name never appears in a URL, title, email, log, cache or storage.

Please add or keep tests for anything touching the draw, encryption or these
rules.

## Commits & PRs

- Keep changes focused and the build green (`npm run build && npm test`).
- Conventional, present-tense commit messages are appreciated.
