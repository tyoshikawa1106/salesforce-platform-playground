#!/usr/bin/env bash

set -e

if [[ $# -ne 0 ]]; then
    echo "Usage: bash scripts/metadata/destructive/destructive.sh" >&2
    exit 1
fi

sf config get target-org

read -r -p "この組織のメタデータ削除をdry-runしますか？ [y/N]: " answer

if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    echo "メタデータ削除のdry-runを中止しました。"
    exit 0
fi

sf project deploy start \
    --post-destructive-changes manifest/destructiveChanges.xml \
    --wait 30 \
    --dry-run

read -r -p "dry-runが成功しました。実際にメタデータを削除しますか？ [y/N]: " answer

if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    echo "メタデータの削除を中止しました。"
    exit 0
fi

sf project deploy start \
    --post-destructive-changes manifest/destructiveChanges.xml \
    --wait 30
