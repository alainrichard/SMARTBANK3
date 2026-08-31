#!/usr/bin/env bash
set -euo pipefail

HOST=${1:-localhost}
PORT=${2:-5432}
USER=${3:-postgres}
DB=${4:-smartbank_db}
FILE=${5:-database/schema.sql}

if [ ! -f "$FILE" ]; then
  echo "Schema file not found: $FILE" >&2
  exit 1
fi

if [ -z "${PGPASSWORD:-}" ]; then
  read -s -p "Enter DB password: " PGPASSWORD
  echo
  export PGPASSWORD
fi

psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -f "$FILE"
