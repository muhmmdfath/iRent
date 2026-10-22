#!/usr/bin/env bash
# Initial setup only, after builds and private config files have been uploaded.
set -euo pipefail
cd /opt/irent/source
compose=(docker compose --env-file /opt/irent/config/compose.env -f deploy/compose.production.yaml)
"${compose[@]}" --profile tools build migrate
"${compose[@]}" up -d db
"${compose[@]}" run --rm migrate
"${compose[@]}" run --rm api node dist/prisma/seed.js
if [ -f /opt/irent/config/admin-bootstrap.env ]; then
  chmod 600 /opt/irent/config/admin-bootstrap.env
  "${compose[@]}" run --rm --user root \
    --volume /opt/irent/config/admin-bootstrap.env:/run/admin.env:ro \
    api node --env-file=/run/admin.env dist/auth/create-admin.js
  # The private local credential copy is retained for the owner.
  rm -- /opt/irent/config/admin-bootstrap.env
fi
"${compose[@]}" up -d api web
install -m 644 deploy/irent-backup.service /etc/systemd/system/irent-backup.service
install -m 644 deploy/irent-backup.timer /etc/systemd/system/irent-backup.timer
systemctl daemon-reload
systemctl enable --now irent-backup.timer
"${compose[@]}" ps
