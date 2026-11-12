#!/usr/bin/env bash
# Daily logical backup of the operational database.
#
# On the Mint node the database runs as container `citybus-postgres`; the dump is written to
# /srv/backups/citybus and rotated (14 daily, 8 weekly). Run from cron:
#   15 3 * * *  /srv/citybus/scripts/backup.sh >> /var/log/citybus-backup.log 2>&1
set -euo pipefail

CONTAINER="${CITYBUS_DB_CONTAINER:-citybus-postgres}"
DB_USER="${CITYBUS_DB_USER:-citybus}"
DB_NAME="${CITYBUS_DB_NAME:-citybus}"
TARGET_DIR="${CITYBUS_BACKUP_DIR:-/srv/backups/citybus}"

mkdir -p "$TARGET_DIR/daily" "$TARGET_DIR/weekly"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$TARGET_DIR/daily/citybus-$STAMP.sql.gz"

docker exec "$CONTAINER" pg_dump --no-owner --clean --if-exists -U "$DB_USER" "$DB_NAME" | gzip -9 > "$FILE"
test -s "$FILE"

# Verify the dump is readable before trusting it.
gunzip -t "$FILE"

if [ "$(date -u +%u)" = "7" ]; then
  cp "$FILE" "$TARGET_DIR/weekly/"
fi

find "$TARGET_DIR/daily" -name 'citybus-*.sql.gz' -mtime +14 -delete
find "$TARGET_DIR/weekly" -name 'citybus-*.sql.gz' -mtime +56 -delete

echo "backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
