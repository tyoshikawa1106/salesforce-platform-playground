#!/usr/bin/env bash

set -e

sf config get target-org

sf project retrieve start --manifest manifest/retrieve-profile.xml
sf project retrieve start --manifest manifest/retrieve-code.xml
sf project retrieve start --manifest manifest/retrieve-shared-resources.xml
sf project retrieve start --manifest manifest/retrieve-application-ui.xml
sf project retrieve start --manifest manifest/retrieve-object-configuration.xml
sf project retrieve start --manifest manifest/retrieve-custom-configuration.xml
sf project retrieve start --manifest manifest/retrieve-automation.xml
sf project retrieve start --manifest manifest/retrieve-access-sharing.xml
sf project retrieve start --manifest manifest/retrieve-integration-api.xml
sf project retrieve start --manifest manifest/retrieve-events-messaging.xml
sf project retrieve start --manifest manifest/retrieve-ui-extensions.xml
sf project retrieve start --manifest manifest/retrieve-auth-security.xml
sf project retrieve start --manifest manifest/retrieve-analytics.xml
sf project retrieve start --manifest manifest/retrieve-email-notification.xml
sf project retrieve start --manifest manifest/retrieve-digital-experience.xml
sf project retrieve start --manifest manifest/retrieve-experience-sites.xml
sf project retrieve start --manifest manifest/retrieve-service.xml
sf project retrieve start --manifest manifest/retrieve-mobile-offline.xml
sf project retrieve start --manifest manifest/retrieve-ai-ml.xml
sf project retrieve start --manifest manifest/retrieve-content-cms.xml
sf project retrieve start --manifest manifest/retrieve-search-knowledge.xml
sf project retrieve start --manifest manifest/retrieve-org-settings.xml
sf project retrieve start --manifest manifest/retrieve-classic-ui.xml
sf project retrieve start --manifest manifest/retrieve-conversation-intelligence.xml
sf project retrieve start --manifest manifest/retrieve-payments.xml
sf project retrieve start --manifest manifest/retrieve-platform-features.xml
sf project retrieve start --manifest manifest/retrieve-translations.xml
