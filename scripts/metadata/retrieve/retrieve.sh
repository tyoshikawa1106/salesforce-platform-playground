#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 0 ]]; then
    echo "Usage: bash scripts/metadata/retrieve/retrieve.sh" >&2
    exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
plan_path="$repo_root/scripts/metadata/retrieve/retrieve-plan.txt"
manifests=()

while IFS= read -r manifest; do
    if [[ -z "$manifest" || "$manifest" == \#* ]]; then
        continue
    fi

    if [[ ! -f "$repo_root/$manifest" ]]; then
        echo "retrieve planのmanifestがありません: $manifest" >&2
        exit 1
    fi

    manifests+=("$manifest")
done < "$plan_path"

if [[ ${#manifests[@]} -eq 0 ]]; then
    echo "retrieve planにmanifestがありません。" >&2
    exit 1
fi

cd "$repo_root"
sf config get target-org

read -r -p "この組織からメタデータを取得しますか？ [y/N]: " answer

if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    echo "メタデータの取得を中止しました。"
    exit 0
fi

for index in "${!manifests[@]}"; do
    manifest="${manifests[$index]}"
    current=$((index + 1))

    echo "[$current/${#manifests[@]}] $(basename "$manifest") を取得します。"
    sf project retrieve start --manifest "$manifest"
done

echo "すべてのメタデータ取得が完了しました。"
