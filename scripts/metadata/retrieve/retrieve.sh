#!/usr/bin/env bash

set -e

sf config get target-org

read -r -p "この組織からメタデータを取得しますか？ [y/N]: " answer

if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    echo "メタデータの取得を中止しました。"
    exit 0
fi

echo "[1/27] retrieve-profile.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-profile.xml
echo "[2/27] retrieve-code.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-code.xml
echo "[3/27] retrieve-shared-resources.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-shared-resources.xml
echo "[4/27] retrieve-application-ui.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-application-ui.xml
echo "[5/27] retrieve-object-configuration.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-object-configuration.xml
echo "[6/27] retrieve-custom-configuration.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-custom-configuration.xml
echo "[7/27] retrieve-automation.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-automation.xml
echo "[8/27] retrieve-access-sharing.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-access-sharing.xml
echo "[9/27] retrieve-integration-api.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-integration-api.xml
echo "[10/27] retrieve-events-messaging.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-events-messaging.xml
echo "[11/27] retrieve-ui-extensions.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-ui-extensions.xml
echo "[12/27] retrieve-auth-security.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-auth-security.xml
echo "[13/27] retrieve-analytics.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-analytics.xml
echo "[14/27] retrieve-email-notification.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-email-notification.xml
echo "[15/27] retrieve-digital-experience.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-digital-experience.xml
echo "[16/27] retrieve-experience-sites.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-experience-sites.xml
echo "[17/27] retrieve-service.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-service.xml
echo "[18/27] retrieve-mobile-offline.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-mobile-offline.xml
echo "[19/27] retrieve-ai-ml.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-ai-ml.xml
echo "[20/27] retrieve-content-cms.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-content-cms.xml
echo "[21/27] retrieve-search-knowledge.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-search-knowledge.xml
echo "[22/27] retrieve-org-settings.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-org-settings.xml
echo "[23/27] retrieve-classic-ui.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-classic-ui.xml
echo "[24/27] retrieve-conversation-intelligence.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-conversation-intelligence.xml
echo "[25/27] retrieve-payments.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-payments.xml
echo "[26/27] retrieve-platform-features.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-platform-features.xml
echo "[27/27] retrieve-translations.xml を取得します。"
sf project retrieve start --manifest manifest/retrieve-translations.xml

echo "すべてのメタデータ取得が完了しました。"
