#!/usr/bin/env bash
# Uses a disposable database on the private DB service; never mutates live users.
set -euo pipefail
umask 077
cd /opt/irent/source
compose=(docker compose --env-file /opt/irent/config/compose.env -f deploy/compose.production.yaml)
database="irent_qa_password_$(date -u +%Y%m%d%H%M%S)"
[[ "$database" =~ ^irent_qa_password_[0-9]{14}$ ]] || exit 1
environment="/opt/irent/config/$database.env"
python3 - "$database" "$environment" <<'PY'
import os
import sys
from pathlib import Path
values = dict(line.split('=', 1) for line in Path('/opt/irent/config/app.env').read_text().splitlines() if '=' in line)
values['DATABASE_URL'] = values['DATABASE_URL'].rsplit('/', 1)[0] + '/' + sys.argv[1]
values['TEST_DATABASE_URL'] = values['DATABASE_URL']
values['NODE_ENV'] = 'test'
for key in list(values):
    if key.endswith('_WORKER_ENABLED'):
        values[key] = 'false'
Path(sys.argv[2]).write_text('\n'.join(key+'='+value for key,value in values.items())+'\n')
os.chmod(sys.argv[2], 0o600)
PY
"${compose[@]}" exec -T db createdb -U irent "$database"
cleanup() {
  "${compose[@]}" exec -T db dropdb -U irent "$database"
  rm -- "$environment"
}
trap cleanup EXIT
docker run --rm --network irent_default --env-file "$environment" irent-migrate npm run db:deploy
docker run --rm --network irent_default --env-file "$environment" irent-migrate \
  sh -c 'npx tsc -p tsconfig.test.json && node --test dist-test/test/database/password-change.test.js'
