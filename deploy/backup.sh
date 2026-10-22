#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/irent/source
compose=(docker compose --env-file /opt/irent/config/compose.env -f deploy/compose.production.yaml)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
folder="/opt/irent/backups/$stamp"
mkdir -m 700 "$folder"
"${compose[@]}" exec -T db pg_dump -U irent -d irent -Fc > "$folder/database.dump"
tar -czf "$folder/files-and-keys.tar.gz" -C /opt/irent config data/proofs data/media
sha256sum "$folder/database.dump" "$folder/files-and-keys.tar.gz" > "$folder/SHA256SUMS"
printf '%s\n' "$stamp" > /opt/irent/backups/latest
echo "Backup completed: $stamp"
