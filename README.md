# Horong-v2

A personal AI agent, self-hosted on a VPS, reachable on Discord (Email
blocked on an upstream bug — see Status).
Built on [Hermes Agent](https://github.com/NousResearch/hermes-agent)
(NousResearch), installed natively — no Docker, no custom backend.

This is a fresh start, not a continuation of the original HORONG's own
FastAPI/Postgres backend and OpenClaw integration (that project's repo
and design history live separately). "Horong-v2" here is just the
agent's name and this repo's name — the old HORONG's memory/items
architecture is not part of this project.

See `docs/superpowers/specs/` for design docs, starting with
`2026-08-21-hermes-agent-setup-design.md`.

## Status (2026-08-21)

Live on the VPS (`<vps-ip>`), natively installed, `systemd --user`
service (`hermes-gateway`), confirmed surviving a reboot:

- Discord — bot reachable, verified with a real message round trip
  across several service restarts.
- Email — blocked on an upstream bug in Hermes's own IMAP fetch code
  (`email/adapter.py`, a blocking socket read that hangs indefinitely),
  reproduced 3 times via `py-spy` stack dumps and still present after a
  full `hermes update` to the latest commit; credentials, network, and
  config were ruled out as the cause. The same Gmail account/app
  password used by the old HORONG's `email-connector` is configured
  but the `EMAIL_*` lines in `~/.hermes/.env` are commented out with a
  `#DISABLED_` prefix (not deleted) so the config is ready for a future
  retry without leaving a background worker thread hung. Deferred. It
  was in this plan's scope and was not delivered — see
  `docs/known-issues.md`.

Not yet done: everything else from the old HORONG project (custom
tools, skills, cron, escalation model, item-match triggers) — none of
it carries over automatically; each would be its own future spec.

## Web dashboard (2026-08-23)

Hermes's built-in web dashboard (`hermes dashboard`) is live as a
persistent `systemd --user` service (`hermes-dashboard`), bound
directly to the VPS's Tailscale IP (`100.109.58.59:9119`) rather than
loopback — reachable from any device on the tailnet, gated behind
Hermes's built-in username/password auth (the `basic` provider).
Credentials live only in `~/.hermes/.env` on the VPS, never in this
repo.

**Pitfall hit and avoided — don't front this with `tailscale serve`:**
a reverse proxy (Tailscale Serve, or any other) rewrites the `Host`
header to the public hostname, which trips Hermes's own
DNS-rebinding guard (`Invalid Host header`) — it only trusts the exact
host it was bound to. The doc-correct pattern for persistent remote
access is binding directly to the Tailscale IP with the built-in
username/password provider, which is what's running now. (An
alternative for occasional, auth-free access: keep it bound to
`127.0.0.1` and reach it via a literal SSH port-forward — `ssh -L
9119:localhost:9119` — which preserves the `Host: localhost` header
that a reverse proxy would otherwise rewrite.)

The dashboard's Files page is locked to `/root/hermes-workspace` via
`HERMES_DASHBOARD_FILES_ROOT` in `~/.hermes/.env` — verified live
(`locked_root` in the API response, and a direct attempt to browse
`/root/.ssh` correctly returns `403 Path outside managed files root`).
`terminal.cwd` was also set to the same directory, but that's a
separate setting controlling the agent's default shell working
directory, not the Files page — see `docs/known-issues.md` #3 for what
each one does and doesn't cover.
