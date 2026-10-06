# Deploying Santa with Ansible

Deploys the app to the VM over SSH: installs Docker, drops `compose.prod.yml`,
renders `.env`, and **pulls the published image** `ghcr.io/totophe/santa` (app +
PostgreSQL). It does not build from source on the VM. TLS and the public domain
(`santa.totophe.com`) are handled by the edge VPS — see
[`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Prerequisites

- SSH access to the VM as the `ansible` user (key-based), with **passwordless
  sudo** (the playbook uses `become`). The VM needs outbound internet (to install
  Docker and pull the image from GHCR).
- The image must be published first (push a `vX.Y.Z` tag → `release.yml` builds
  `ghcr.io/totophe/santa`). Pin the version in `vars.yml` (`santa_tag`).
- Set the VM's real IP in `inventory.ini` (placeholder `70.75.0.10`), and
  `app_bind` to the VM's WireGuard IP in `vars.yml`.

## One-time setup

```bash
cd deploy/ansible
./gen-secrets.sh            # creates .secrets.yml (ENCRYPTION_KEY, DB password) — BACK IT UP
# review vars.yml — set app_url, group_creation, instance_admins, and SMTP_* for real email
```

Put your SSH public key on the VM if it isn't already:

```bash
ssh-copy-id ansible@70.75.0.10
```

## Deploy

```bash
cd deploy/ansible
ansible all -m ping                       # verify connectivity first
ansible-playbook deploy.yml
```

Re-running is safe and idempotent; it rebuilds and restarts the stack. The
encryption key in `.secrets.yml` is preserved across runs (never regenerate it —
that would make every past draw undecryptable).

## Notes

- **Email**: with `smtp_host` blank the app logs sign-in codes instead of
  emailing them (`docker compose logs app`) — fine for a smoke test, not for real
  users. Set `smtp_*` in `vars.yml` and `smtp_password` in `.secrets.yml`.
- **Reachability**: this must be run from a machine that can reach the VM on port
  22. The dev container used to build Santa cannot route to `70.75.0.10`.
- **Backups**: back up the Postgres volume (`santa-db`) **and** `.secrets.yml`
  separately. Restoring one without the other loses every draw.
