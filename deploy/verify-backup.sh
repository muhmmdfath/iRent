#!/usr/bin/env bash
# Restore a backup to a newly created disposable DB, never to the live DB.
set -euo pipefail
cd /opt/irent/source
compose=(docker compose --env-file /opt/irent/config/compose.env -f deploy/compose.production.yaml)
stamp=$(cat /opt/irent/backups/latest)
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 1
folder="/opt/irent/backups/$stamp"
sha256sum --check "$folder/SHA256SUMS"
database="irent_restore_check_$(date -u +%Y%m%d%H%M%S)"
[[ "$database" =~ ^irent_restore_check_[0-9]{14}$ ]] || exit 1
"${compose[@]}" exec -T db createdb -U irent "$database"
trap '"${compose[@]}" exec -T db dropdb -U irent "$database"' EXIT
"${compose[@]}" exec -T db pg_restore -U irent --dbname "$database" \
  --exit-on-error --no-owner --no-privileges < "$folder/database.dump"
"${compose[@]}" exec -T db psql -U irent -d "$database" -Atc \
  'SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM bookings), (SELECT count(*) FROM items);'
echo 'Backup restored successfully into disposable database.'
