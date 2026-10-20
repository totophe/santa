# Deployment architecture (hosted instance)

```
          https://santa.totophe.com
                     │  (TLS terminated here)
                     ▼
        ┌─────────────────────────┐
        │   Edge VPS  (Talos)     │   public reverse proxy
        │   - TLS / Let's Encrypt │
        │   - WireGuard peer      │
        └────────────┬────────────┘
                     │  WireGuard tunnel
                     ▼
        ┌─────────────────────────┐
        │   App VM  (this repo)   │   private, no public IP
        │   docker compose:       │
        │     app  (ghcr image)   │ ← listens :3000 (HTTP)
        │     postgres            │
        └─────────────────────────┘
```

## Who owns what

- **Talos** — creates the VM, runs the **edge VPS**, and the **WireGuard** link
  between edge and VM. On the edge: terminate TLS for `santa.totophe.com` and
  reverse-proxy to the VM over WireGuard.
- **This project (app layer on the VM)** — the container image, the compose
  stack, `.env`, migrations (run at startup), backups of the DB + encryption key.

## The contract Talos needs from us

- The app serves plain **HTTP on port 3000** on the VM (TLS is the edge's job).
- Proxy to `http://<vm-wireguard-ip>:3000`. Set standard forwarded headers:
  `X-Forwarded-For` and `X-Forwarded-Proto: https`. The app runs with
  `TRUST_PROXY=true` so it reads the real client IP (used by the per-IP sign-in
  rate limit) — so the edge must set `X-Forwarded-For` correctly.
- Health endpoint for the proxy / uptime checks: `GET /healthz` → 200.
- Only HTTP(S) is needed — the chat uses 15s polling, **no WebSockets**.
- Cookies are `Secure` (because `APP_URL` is https) and `SameSite=Lax`; the edge
  must preserve them and the Host header.

## What we need from Talos

- The VM's **WireGuard IP** → set `APP_BIND` in the `.env` to bind the app to
  that interface (so it isn't exposed on the LAN), or a firewall rule limiting
  :3000 to the WG peer.
- SSH access to the VM with sudo, and outbound internet on the VM (to pull the
  image from GHCR).

## Image & release flow

- CI (`.github/workflows/ci.yml`) gates every PR: locale check, type-check,
  tests, build.
- `.github/workflows/release.yml` builds and pushes `ghcr.io/totophe/santa` on a
  `vX.Y.Z` tag (`:X.Y.Z`, `:X.Y`, `:latest`) and `:main` on main.
- The VM runs that image — it does **not** build from source — via
  `deploy/compose.prod.yml`. (The maintainer's own deploy automation lives in a
  private IaC repo; the compose file plus a `.env` is all you need to self-host.)

## Deploy / upgrade (docker compose)

On the VM, with `compose.prod.yml` and a `.env` next to it (see `.env.example`
for the full list — at minimum `APP_URL`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD`,
`DATABASE_URL`, the `SMTP_*` settings, and `INSTANCE_ADMINS`):

```bash
# pin a version with the image tag, e.g. SANTA_TAG=v1.2.3 in .env
docker compose -f compose.prod.yml --env-file .env pull
docker compose -f compose.prod.yml --env-file .env up -d
curl -fsS localhost:3000/healthz   # expect 200
```

Upgrades = push a new `vX.Y.Z` tag (CI publishes the image), bump the tag in
`.env`, then re-pull and `up -d`. Migrations run automatically at container
startup.

> Back up the database **and** the `ENCRYPTION_KEY` together — each is useless
> without the other.
