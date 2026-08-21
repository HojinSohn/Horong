# Horong-v2

A personal AI agent, self-hosted on a VPS, reachable on Discord and Email.
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
  retry without leaving a background worker thread hung. Deferred, not
  part of this project's initial scope.

Not yet done: everything else from the old HORONG project (custom
tools, skills, cron, escalation model, item-match triggers) — none of
it carries over automatically; each would be its own future spec.
