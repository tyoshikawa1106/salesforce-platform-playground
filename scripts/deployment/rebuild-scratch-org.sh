#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

# Scratch Org を作成する。
sf org create scratch --definition-file config/project-scratch-def.json --alias scratch-platform-playground --duration-days 7

# Scratch Org 初期反映用 manifest を反映する。
sf project deploy start --manifest manifest/rebuild-scratch-org.xml --target-org scratch-platform-playground --wait 30

# Scratch Org の実行ユーザーに playground 用 Permission Set を付与する。
sf org assign permset --name Salesforce_Platform_Playground_User --target-org scratch-platform-playground
