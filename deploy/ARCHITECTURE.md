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

- The VM's **WireGuard IP** → set `app_bind` in `vars.yml` to bind the app to
  that interface (so it isn't exposed on the LAN), or a firewall rule limiting
  :3000 to the WG peer.
- SSH as `ansible@<vm>` with passwordless sudo, and outbound internet on the VM
  (to pull the image from GHCR).

## Image & release flow

- CI (`.github/workflows/ci.yml`) gates every PR: locale check, type-check,
  tests, build.
- `.github/workflows/release.yml` builds and pushes `ghcr.io/totophe/santa` on a
  `vX.Y.Z` tag (`:X.Y.Z`, `:X.Y`, `:latest`) and `:main` on main.
- The VM deploy (`deploy/ansible/deploy.yml`) pulls that image — it does **not**
  build from source — via `deploy/compose.prod.yml`.

## Deploy / upgrade

```bash
cd deploy/ansible
./gen-secrets.sh                 # once; BACK UP .secrets.yml
# edit vars.yml: app_bind (WG IP), smtp_*, santa_tag (pin a version)
ansible all -m ping
ansible-playbook deploy.yml      # pulls image, renders .env, compose up, waits /healthz
```

Upgrades = push a new tag (CI publishes the image), bump `santa_tag`, re-run the
playbook. Migrations run automatically at container startup.
