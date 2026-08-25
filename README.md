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

## Status (2026-08-25)

Live on the VPS (`<vps-ip>`), natively installed, `systemd --user`
service (`hermes-gateway`), confirmed surviving a reboot and stable
since (active since 2026-08-23 11:31 UTC, `NRestarts=0`, Discord
reporting `connected` as of the last live check):

- Discord — bot reachable, verified with a real message round trip
  across several service restarts. Working.
- Email — still blocked in production, but **root-caused correctly**
  (an earlier diagnosis in this doc was wrong — see below) and a fix
  is in progress against the real upstream project. The same Gmail
  account/app password used by the old HORONG's `email-connector` is
  configured but the `EMAIL_*` lines in `~/.hermes/.env` are commented
  out with a `#DISABLED_` prefix (not deleted), so it's ready to
  re-enable once the fix lands. See `docs/known-issues.md`.

Not yet done: everything else from the old HORONG project (custom
tools, skills, cron, escalation model, item-match triggers) — none of
it carries over automatically; each would be its own future spec.

## Email fix — in progress, upstream PR to hermes-agent (2026-08-25)

**Corrected root cause** (the original "IMAP fetch hangs indefinitely /
blocking socket read" diagnosis in this project's earlier notes was
wrong — it never hung): `plugins/platforms/email/adapter.py`'s
first-connect logic marks pre-existing mail "seen" only in an
**in-memory Python set**, built from `UID SEARCH ALL`, then immediately
trimmed to the 1000 most recent UIDs. It never touches the server's
real `\Seen` flag, and the set isn't persisted. On a large mailbox
(this account: ~29,000 real unseen messages, ~46,000+ total), every
process restart re-discovers almost the entire backlog as "new" and
fetches it one message at a time — looks identical to a hang from the
outside, but it's real (slow) progress through tens of thousands of
messages, restarted from zero every time the process restarts.

**Fix design**, refined through review before any code was written
(see conversation history — an initial idea to mark the IMAP `\Seen`
flag server-side was rejected: it would mark a human's genuinely
unread mail as read; a follow-up idea to key off a single "highest
processed UID" was also rejected: non-contiguous success/failure,
`UIDVALIDITY` resets, and `\Seen` being mutated as an unrelated side
effect of the existing fetch call all break that):

- A persisted **watermark UID** per mailbox (`{uidvalidity, watermark,
  seen_uids}`, one small JSON file under `get_hermes_home()`) — every
  UID at or below it is guaranteed already handled.
- First connect (or a `UIDVALIDITY` mismatch — IMAP UIDs are only
  meaningful within one `UIDVALIDITY` epoch): read `UIDNEXT` from the
  `SELECT` response (an atomic, single-command read — no `SEARCH ALL`,
  no per-message loop, no `\Seen` mutation) and set the watermark to
  it.
- Polling keeps its existing `UID SEARCH UNSEEN` query unchanged (no
  change to what counts as "new mail," preserving all existing tested
  behavior) and adds one more filter: skip anything at or below the
  watermark.
- The watermark only ever advances through a **strictly contiguous**
  run of successfully-fetched UIDs immediately above it — a UID that
  keeps failing blocks the watermark from passing it (matching the
  existing "retry a failed UID forever" behavior), while later UIDs
  that already succeeded wait in the existing `_seen_uids` set instead
  of being re-fetched.

**Current state:** implemented in a scratch clone of
`NousResearch/hermes-agent` (not this repo — a real external project),
uncommitted. Not yet tested, not yet committed, and explicitly **not
yet opened as a PR** per instruction — this is a paused, in-progress
external contribution, tracked here so the context survives a session
break.

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
