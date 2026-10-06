# Santa

Open-source web app for **recurring secret gift exchanges**: a lasting group, one
edition per year, a draw nobody can see, and one wishlist per person per edition.
Secret Santa is one theme; the product is generic.

- **Hosted**: [santa.totophe.com](https://santa.totophe.com)
- **Self-hosting**: a Docker image configured entirely by environment variables.
- **Licence**: MIT.

> **Privacy, honestly stated.** A pairing is known to the giver only — not to
> admins, not to instance admins, not after the exchange. The draw is encrypted
> with a key kept outside the database. The limit of this design: whoever holds
> **both** the database and the encryption key can decrypt the draw. The goal is
> to make peeking impossible by accident, not to resist a determined host.

## Stack

| Part | Tech |
| --- | --- |
| API | NestJS (TypeScript) |
| Web | React + Vite (TypeScript), served as static assets by the API |
| Database | PostgreSQL |
| ORM | Sequelize 7 (forward-only migrations, run at startup) |
| Packaging | One Docker image (`app`) + PostgreSQL (`postgres`) |

Monorepo layout: `apps/api`, `apps/web`, `locales/`, `themes/`, `docs/`.

## Run it locally

Prerequisites: Node 20+ and a PostgreSQL 15+ server.

```bash
npm install
cp .env.example .env            # then edit values (see below)
# generate an encryption key:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# terminal 1 — API (defaults to :3000)
npm run dev --workspace apps/api
# terminal 2 — web dev server with API proxy (:5173)
npm run dev --workspace apps/web
```

In production the API serves the built web app on a single port:

```bash
npm run build
node apps/api/dist/main.js
```

## With Docker

```bash
cp .env.example .env            # set ENCRYPTION_KEY, SMTP_*, MAIL_FROM, APP_URL
docker compose up --build
```

## Configuration

All configuration is via environment variables — see [`.env.example`](./.env.example)
for the full list with defaults. The essentials:

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public base URL, used in emails and QR codes (required) |
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `ENCRYPTION_KEY` | 32 bytes, base64. Encrypts assignments (required) |
| `SMTP_*`, `MAIL_FROM` | Outgoing mail. With no `SMTP_HOST` the app logs emails instead of sending — handy in development |
| `GROUP_CREATION` | `open`, `allowlist` or `admins` (default `admins`) |
| `INSTANCE_ADMINS` | Comma-separated emails that can remove groups |

**Back up the database and the encryption key separately.** Restoring one without
the other loses every draw and the no-repeat history. The app stores a fingerprint
of the key at first start and refuses to start against a different key.

## Health

`GET /healthz` returns `200` when the database is reachable and the key
fingerprint matches.

## Development status

Built against the spec in [`docs/Santa build specs.md`](./docs/Santa%20build%20specs.md),
following its nine-step build order. **Steps 1–7 (the full MVP — what the first
family draw needs) are complete and verified end-to-end against PostgreSQL:**

- Monorepo, Docker, forward-only migrations at startup, `/healthz`.
- Email sign-in (6-digit code + magic link, hashed tokens, rolling session),
  profile, five-language i18n (EN/FR shipped), Santa + Generic themes.
- Groups, editions, invite link + join, participant statuses.
- Wishlists: draft / publish / "Surprise me!", paste-many, import between editions.
- **The draw**: single-loop CSPRNG algorithm with soft no-repeat, AES-256-GCM
  encrypted assignments inserted in shuffled order (no timestamps), press-and-hold
  reveal (the only endpoint returning a recipient — the caller's own), emails E4/E6.
- Private threads (role-only payloads) and group chat (alias-only, no id leak),
  with the open-when-everyone-has-checked gate.
- Admin actions: typed invitations, resend, remove participant, **departure
  repair**, promote/demote with last-admin guard, edition settings, archive.
- Rate limits (Postgres-backed), email suppression, instance-admin page, privacy
  page, and account / group deletion.
- A React PWA-ready web client covering the full happy path (home, create/join,
  edition hub with Home/Wishlists/Chat/People tabs, the hold-to-reveal card).

Tests: property-based draw tests (every group of 3–50 is one loop, no self-draws,
no-repeat honoured/relaxed) plus encryption tests. Run with `npm test`.

**Not yet done** (steps 8–9 and polish): the second-edition "start a new edition"
flow is partially present; NL/DE/ES translations, richer theme illustrations, the
PWA manifest/service worker, and an ESLint config + CI workflow remain.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) — including how to add a language in
three steps.
