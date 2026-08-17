#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 0 ]]; then
    echo "Usage: bash scripts/metadata/retrieve/retrieve.sh" >&2
    exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
# 責務別manifestの実行順
manifests=(
    "manifest/retrieve-profile.xml"
    "manifest/retrieve-code.xml"
    "manifest/retrieve-shared-resources.xml"
    "manifest/retrieve-application-ui.xml"
    "manifest/retrieve-object-configuration.xml"
    "manifest/retrieve-custom-configuration.xml"
    "manifest/retrieve-automation.xml"
    "manifest/retrieve-access-sharing.xml"
    "manifest/retrieve-integration-api.xml"
    "manifest/retrieve-events-messaging.xml"
    "manifest/retrieve-ui-extensions.xml"
    "manifest/retrieve-auth-security.xml"
    "manifest/retrieve-analytics.xml"
    "manifest/retrieve-email-notification.xml"
    "manifest/retrieve-digital-experience.xml"
    "manifest/retrieve-experience-sites.xml"
    "manifest/retrieve-service.xml"
    "manifest/retrieve-mobile-offline.xml"
    "manifest/retrieve-ai-ml.xml"
    "manifest/retrieve-content-cms.xml"
    "manifest/retrieve-search-knowledge.xml"
    "manifest/retrieve-org-settings.xml"
    "manifest/retrieve-classic-ui.xml"
    "manifest/retrieve-conversation-intelligence.xml"
    "manifest/retrieve-payments.xml"
    "manifest/retrieve-platform-features.xml"
    "manifest/retrieve-translations.xml"
)

for manifest in "${manifests[@]}"; do
    if [[ ! -f "$repo_root/$manifest" ]]; then
        echo "retrieve対象のmanifestがありません: $manifest" >&2
        exit 1
    fi
done

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
