#!/usr/bin/env bash
# Host-side PostgreSQL backup; run with matching PostgreSQL client major version.
set -euo pipefail
umask 077
: "${PGDATABASE:?PGDATABASE required}"
: "${BACKUP_FILE:?Set a new private .dump path}"
if [[ -e "$BACKUP_FILE" ]]; then echo 'Refusing to overwrite backup' >&2; exit 1; fi
if [[ -n "${PGPASSWORD_FILE:-}" ]]; then
  PGPASSWORD="$(cat "$PGPASSWORD_FILE")"; export PGPASSWORD
fi
backup_tmp="${BACKUP_FILE}.partial"
if [[ -e "$backup_tmp" ]]; then echo 'Partial backup exists' >&2; exit 1; fi
trap 'rm -f -- "$backup_tmp"' EXIT
pg_dump --format=custom --no-owner --no-acl > "$backup_tmp"
pg_restore --list "$backup_tmp" >/dev/null
mv -- "$backup_tmp" "$BACKUP_FILE"
echo 'PostgreSQL backup verified; copy PDF document storage separately while writes are frozen.'
