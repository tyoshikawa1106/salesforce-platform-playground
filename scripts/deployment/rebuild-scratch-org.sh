#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

# Scratch Org を作成する。
sf org create scratch --definition-file config/project-scratch-def.json --alias scratch-platform-playground --duration-days 7

# Scratch Org 初期反映用 manifest が deploy 可能か確認する。
sf project deploy start --dry-run --manifest manifest/rebuild-scratch-org.xml --target-org scratch-platform-playground --wait 30

# 同じ manifest を Scratch Org に反映する。
sf project deploy start --manifest manifest/rebuild-scratch-org.xml --target-org scratch-platform-playground --wait 30

# Scratch Org の実行ユーザーに playground 用 Permission Set を付与する。
sf org assign permset --name Salesforce_Platform_Playground_User --target-org scratch-platform-playground

# Scratch Org 上で Apex ローカルテストを実行する。
sf apex run test --test-level RunLocalTests --result-format human --target-org scratch-platform-playground --wait 30

# 再現確認用の Scratch Org を削除する。
sf org delete scratch --target-org scratch-platform-playground --no-prompt
