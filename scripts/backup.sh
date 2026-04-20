#!/bin/bash
BACKUP_DIR="/opt/partywall/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="partywall_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

mysqldump -u root -p123456 -P 3316 -h 127.0.0.1 partywall 2>/dev/null | gzip > "$BACKUP_DIR/$FILENAME"

if [ "${PIPESTATUS[0]}" -eq 0 ]; then
  echo "[$(date)] OK: $FILENAME ($(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1))"
  find "$BACKUP_DIR" -name '*.sql.gz' -mtime +30 -delete
else
  echo "[$(date)] ERROR: fallo el backup"
  rm -f "$BACKUP_DIR/$FILENAME"
  exit 1
fi
