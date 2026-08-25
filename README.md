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

**Current state:** implemented in a local clone of
`NousResearch/hermes-agent` at `~/hermes-agent` on this Mac (not this
repo — a real external project, see "Working on Hermes Agent itself"
below), uncommitted. Not yet tested, not yet committed, and explicitly
**not yet opened as a PR** per instruction — this is a paused,
in-progress external contribution, tracked here so the context
survives a session break.

## Working on Hermes Agent itself (2026-08-25)

Hermes Agent is a large external open-source project
(`NousResearch/hermes-agent`), not something this repo vendors or
forks into its own history (see "Is it possible to have the exact
codebase in repo" — deliberately declined; it'd diverge from every
`hermes update` and blur what this repo is for). It has its own local
clone, separate from `Horong-v2`:

**`/Users/hojinsohn/hermes-agent`** — a normal git repo, currently on
branch `fix/email-mark-seen-server-side` with the Email fix above
still uncommitted.

### Project structure (the parts that matter for customizing)

```
hermes-agent/
├── run_agent.py         # AIAgent — the core conversation loop, tool dispatch
├── cli.py                # HermesCLI — interactive TUI
├── toolsets.py           # which tools are available per surface (hermes-cli, hermes-telegram, ...)
├── hermes_state.py        # SQLite session DB (search, history)
│
├── agent/                # core internals: prompt assembly, context compression, memory
├── tools/                 # built-in tools (file ops, web search, terminal, vision, ...)
│   └── registry.py            # central tool registry — how a new tool gets wired in
│
├── gateway/               # the messaging gateway (this is what runs on the VPS)
│   ├── run.py                 # GatewayRunner — platform lifecycle, message routing, cron
│   ├── config.py               # how platforms get configured (env vars / config.yaml)
│   └── platforms/               # some channel adapters live directly here
│       └── ADDING_A_PLATFORM.md    # the actual guide for extending this
│
├── plugins/
│   ├── platforms/               # most channel adapters live here instead (discord, email, slack, telegram, whatsapp, ...)
│   │   └── email/adapter.py         # the file the Email fix above touches
│   ├── dashboard_auth/           # the basic-auth provider used for the web dashboard
│   ├── memory/                   # memory backends (honcho, mem0, etc.)
│   └── ...                       # browser, cron_providers, image_gen, kanban, etc.
│
├── skills/                # bundled skills (markdown playbooks, copied to ~/.hermes/skills/ on install)
├── optional-skills/        # official but not-on-by-default skills
├── web/                    # the dashboard's frontend (the UI at the Tailscale URL above)
├── tests/                  # test suite — mirrors this structure (tests/gateway/, tests/agent/, etc.)
└── AGENTS.md               # the project's own dev guide, written for AI coding assistants
```

Two things worth internalizing:

1. **Channels split across two places** — `gateway/platforms/` for some
   (Signal, WeChat, WhatsApp Cloud, BlueBubbles...), `plugins/platforms/<name>/adapter.py`
   for others (Discord, Email, Slack, Telegram, WhatsApp...). Both are
   real; check `gateway/platforms/ADDING_A_PLATFORM.md` before assuming
   a pattern.
2. **The plugin path is the intended extension point.** Per that doc: a
   new platform (or most new capabilities generally) should be a plugin
   implementing `BasePlatformAdapter` + `register(ctx)` — "zero changes
   to core Hermes code." The Email fix works within that same existing
   shape, not against it.

### Working loop

- **Branch per change**, matching the project's convention:
  `fix/...`, `feat/...`, etc.
- **Edit and test locally** — `scripts/run_tests.sh` or `pytest tests/ -v`,
  no VPS needed (mirrors the file you touched, e.g.
  `tests/gateway/test_email.py` for the email adapter).
- **Live-test against the real VPS gateway** when needed: `scp` just the
  one changed file over, restart `hermes-gateway`, check `journalctl` —
  no need to redeploy or re-clone the whole thing:
  ```bash
  scp ~/hermes-agent/plugins/platforms/email/adapter.py \
    root@<vps-ip>:/usr/local/lib/hermes-agent/plugins/platforms/email/adapter.py
  ssh horong-vps 'export XDG_RUNTIME_DIR=/run/user/0 && systemctl --user restart hermes-gateway'
  ```
  (Easy to revert — the live install at `/usr/local/lib/hermes-agent`
  is itself a git clone; `git checkout` the file there if a live test
  doesn't pan out.)
- **To actually contribute upstream**: push this clone to a fork on
  GitHub, open the PR from there — `CONTRIBUTING.md` (in the repo root)
  has the exact branch-naming and commit-message conventions
  (Conventional Commits).
- **The VPS's own copy never needs direct edits** — it's a deploy
  target, updated via `hermes update` once something's actually merged
  upstream, or via the one-off `scp` above when test-driving a
  not-yet-merged fix.

### SSH access

`ssh horong-vps` now works as a shortcut (added to `~/.ssh/config`,
`root@<vps-ip>` via the `id_ed25519` key — `id_rsa` is also
present but passphrase-protected and not what actually authenticates).
Same alias works for VS Code's Remote-SSH extension.

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
