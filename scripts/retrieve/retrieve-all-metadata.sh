#!/usr/bin/env bash

set -euo pipefail

usage() {
    echo "Usage: npm run sf:retrieve:all -- [--dry-run] [--from <stage> | --only <stage>]"
    echo "Stages: profile, application, organization, translations"
}

dry_run=false
from_stage=""
only_stage=""

stages=(
    "profile"
    "application"
    "organization"
    "translations"
)

manifests=(
    "manifest/retrieve-profile.xml"
    "manifest/retrieve-application.xml"
    "manifest/retrieve-organization.xml"
    "manifest/retrieve-translations.xml"
)

is_valid_stage() {
    local candidate="$1"
    local stage

    for stage in "${stages[@]}"; do
        if [[ "$candidate" == "$stage" ]]; then
            return 0
        fi
    done

    return 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            dry_run=true
            shift
            ;;
        --from)
            if [[ $# -lt 2 ]]; then
                echo "Error: --from requires a stage." >&2
                usage >&2
                exit 1
            fi
            from_stage="$2"
            shift 2
            ;;
        --only)
            if [[ $# -lt 2 ]]; then
                echo "Error: --only requires a stage." >&2
                usage >&2
                exit 1
            fi
            only_stage="$2"
            shift 2
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

if [[ -n "$from_stage" && -n "$only_stage" ]]; then
    echo "Error: --from and --only cannot be used together." >&2
    usage >&2
    exit 1
fi

if [[ -n "$from_stage" ]] && ! is_valid_stage "$from_stage"; then
    echo "Error: unknown stage for --from: $from_stage" >&2
    usage >&2
    exit 1
fi

if [[ -n "$only_stage" ]] && ! is_valid_stage "$only_stage"; then
    echo "Error: unknown stage for --only: $only_stage" >&2
    usage >&2
    exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

selected_manifests=()

if [[ -n "$only_stage" ]]; then
    for index in "${!stages[@]}"; do
        if [[ "${stages[$index]}" == "$only_stage" ]]; then
            selected_manifests+=("${manifests[$index]}")
            break
        fi
    done
elif [[ -n "$from_stage" ]]; then
    include_manifest=false
    for index in "${!stages[@]}"; do
        if [[ "${stages[$index]}" == "$from_stage" ]]; then
            include_manifest=true
        fi
        if [[ "$include_manifest" == true ]]; then
            selected_manifests+=("${manifests[$index]}")
        fi
    done
else
    selected_manifests=("${manifests[@]}")
fi

for manifest in "${selected_manifests[@]}"; do
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

for manifest in "${selected_manifests[@]}"; do
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
