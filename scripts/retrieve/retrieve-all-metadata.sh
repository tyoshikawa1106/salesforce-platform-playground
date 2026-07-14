#!/usr/bin/env bash

set -e

sf config get target-org

sf project retrieve start --manifest manifest/retrieve-profile.xml
sf project retrieve start --manifest manifest/retrieve-application.xml
sf project retrieve start --manifest manifest/retrieve-organization.xml
sf project retrieve start --manifest manifest/retrieve-translations.xml
