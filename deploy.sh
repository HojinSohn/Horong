#!/usr/bin/env bash
# Deploy the dashboard to the VPS.
#   ./deploy.sh              deploy frontend only (default)
#   ./deploy.sh finance      deploy one backend service + restart it
#   ./deploy.sh all          deploy frontend + every backend service
set -euo pipefail

HOST="root@horong.taila5421b.ts.net"
SERVICES="finance notes bridge openrouter briefing stocks"

deploy_frontend() {
  echo "==> building frontend"
  (cd frontend && npm run build)
  echo "==> syncing frontend to VPS"
  rsync -az --delete frontend/dist/ "$HOST:/root/hermes-dashboard-frontend/dist/"
}

deploy_service() {
  local svc="$1"
  echo "==> syncing ${svc} to VPS"
  if [ "$svc" = "bridge" ]; then
    # bridge's package is acp_bridge/, not bridge_service/, and unlike the
    # other services its source spans more than one file.
    rsync -az --exclude '__pycache__' bridge/acp_bridge/ "$HOST:/root/hermes-dashboard-bridge/acp_bridge/"
  else
    scp "${svc}/${svc}_service/server.py" "$HOST:/root/hermes-dashboard-${svc}/${svc}_service/server.py"
  fi
  echo "==> restarting ${svc}"
  ssh "$HOST" "systemctl --user restart hermes-dashboard-${svc}"
}

target="${1:-frontend}"

case "$target" in
  frontend)
    deploy_frontend
    ;;
  all)
    deploy_frontend
    for svc in $SERVICES; do deploy_service "$svc"; done
    ;;
  finance|notes|bridge|openrouter|briefing|stocks)
    deploy_service "$target"
    ;;
  *)
    echo "usage: $0 [frontend|all|finance|notes|bridge|openrouter|briefing|stocks]" >&2
    exit 1
    ;;
esac

echo "==> done"
