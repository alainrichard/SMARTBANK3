#!/usr/bin/env bash
set -euo pipefail

TITLE="${1:-fix(smartbank3): repository fixes + CI}"
BODY="${2:-This PR contains fixes for build/runtime issues, CI, and containerization. Please review and merge.}"
BASE="${3:-main}"
HEAD="${4:-fix/smartbank3}"

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN not set. Export a PAT to GITHUB_TOKEN and retry." >&2
  exit 1
fi

REMOTE=$(git remote get-url origin 2>/dev/null || true)
if [ -z "$REMOTE" ]; then
  echo "Unable to detect git remote 'origin'" >&2
  exit 1
fi

# parse owner/repo
REPO_FULL=$(echo "$REMOTE" | sed -E 's#.*[:/]([^/]+/[^/.]+)(\.git)?$#\1#')

curl -s -X POST "https://api.github.com/repos/$REPO_FULL/pulls" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "User-Agent: smartbank3-agent" \
  -d "{ \"title\": \"$TITLE\", \"head\": \"$HEAD\", \"base\": \"$BASE\", \"body\": \"$BODY\" }" \
  | jq -r .html_url
