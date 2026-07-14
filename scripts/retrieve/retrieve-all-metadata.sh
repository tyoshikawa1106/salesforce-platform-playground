#!/usr/bin/env bash

set -euo pipefail

usage() {
    echo "Usage: npm run sf:retrieve:all [-- --dry-run]"
}

dry_run=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            dry_run=true
            shift
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        *)
            echo "Error: unsupported argument: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

manifests=(
    "manifest/retrieve-first.xml"
    "manifest/retrieve-second.xml"
    "manifest/retrieve-third.xml"
)

for manifest in "${manifests[@]}"; do
    if [[ ! -f "$manifest" ]]; then
        echo "Error: manifest not found: $manifest" >&2
        exit 1
    fi
done

if ! command -v sf >/dev/null 2>&1; then
    echo "Error: sf command not found." >&2
    exit 1
fi

config_json="$(sf config get target-org --json)"
target_org="$(
    printf '%s\n' "$config_json" |
        sed -n 's/^[[:space:]]*"value": "\([^"]*\)",[[:space:]]*$/\1/p' |
        head -n 1
)"

if [[ -z "$target_org" ]]; then
    echo "Error: target-org is not configured. Select a default org in VS Code first." >&2
    exit 1
fi

echo "Target org: $target_org"

for manifest in "${manifests[@]}"; do
    command=(
        sf project retrieve start
        --manifest "$manifest"
        --target-org "$target_org"
    )

    if [[ "$dry_run" == true ]]; then
        printf 'Dry run:'
        printf ' %q' "${command[@]}"
        printf '\n'
        continue
    fi

    echo "Retrieving: $manifest"
    "${command[@]}"
done
