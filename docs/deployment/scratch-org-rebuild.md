# Scratch Org 再現

新しい Scratch Org でこのプロジェクトのメタデータを再現するときの手順です。

## 基本方針

- `config/project-scratch-def.json` は Scratch Org 作成用の設定として扱う。
- Dev 組織への deploy 先設定とは分けて考える。
- Scratch Org で再現できない前提が見つかった場合は、設定または docs に残す。
- 個人環境の alias や認証情報をコミットしない。
- Scratch Org は一時環境として扱い、確認が終わったら削除する。
- `manifest/scratch-org-rebuild.xml` は Scratch Org への反映にだけ使う。
- Scratch Org で作成、変更したメタデータを戻す場合は、作業対象を絞った manifest を用意して retrieve / deploy に使う。
- `force-app` 全体 dry-run は、Dev 組織から大きく retrieve した直後や、Scratch Org 用 manifest の対象範囲を見直す場合だけ実行する。

manifest の使い分けは [Scratch Org と manifest の使い分け](../knowledge/salesforce-scratch-org-manifest-workflow.md) を参照します。

## 前提

Scratch Org の作成には Dev Hub が必要です。

```sh
sf org list
```

Dev Hub が未設定の場合は、利用する Dev Hub を確認してからログインまたは指定します。
このリポジトリの通常開発で使う Dev 組織とは別の前提として扱います。

## Installed Package の確認

Dev 組織の installed package は Scratch Org に自動では引き継がれません。
必要な package がある場合は、Scratch Org 作成後、metadata deploy より前に `sf package install` で明示的にインストールします。

現 Dev 組織の package は Tooling API で確認します。

```sh
sf data query \
    --use-tooling-api \
    --query "SELECT SubscriberPackage.Name, SubscriberPackage.NamespacePrefix, SubscriberPackageVersion.Name FROM InstalledSubscriberPackage" \
    --target-org salesforce-platform-playground
```

Package License が残っていないかも確認します。

```sh
sf data query \
    --query "SELECT NamespacePrefix, Status, AllowedLicenses, UsedLicenses FROM PackageLicense" \
    --target-org salesforce-platform-playground
```

package が必要な場合は、`04t...` の Package Version Id を確認し、次の順序で反映します。

```sh
sf package install --package 04tXXXXXXXXXXXXXXX --target-org scratch-platform-playground --wait 30 --publish-wait 30
```

```text
1. Scratch Org 作成
2. 必要 package install
3. manifest/scratch-org-rebuild.xml deploy
4. scratch-org/main/default deploy
5. 必要に応じて scratch-org/generated deploy
6. Apex test
```

現時点の Dev 組織では、Tooling API の `InstalledSubscriberPackage` と `PackageLicense` はどちらも 0 件です。

## 作成前の確認

作成前に次を確認します。

- `sfdx-project.json` の package directory と API version
- `config/project-scratch-def.json` の edition、features、settings
- Dev 組織との差分として明示すべき前提
- Scratch Org に投入する metadata が `force-app/main/default` に揃っているか
- 作成に使う alias と duration

## 自動再現

通常の再現確認はスクリプトで実行します。
Scratch Org 作成、manifest deploy、`scratch-org/main/default` deploy、client credentials policy 生成と deploy、Apex `RunLocalTests`、Scratch Org 削除までを順に実行します。

```sh
node scripts/deployment/rebuild-scratch-org.js
```

alias や Dev Hub を明示する場合:

```sh
node scripts/deployment/rebuild-scratch-org.js \
    --alias scratch-platform-playground \
    --target-dev-hub salesforce-platform-playground \
    --duration-days 7
```

package install が必要な場合は、metadata deploy より前に入れる package version id を渡します。

```sh
node scripts/deployment/rebuild-scratch-org.js --package 04tXXXXXXXXXXXXXXX
```

調査のため Scratch Org を残す場合だけ `--keep-org` を付けます。
`--skip-create` で既存 alias を使う場合、スクリプトはその org を自動削除しません。

## 作成

Scratch Org を作成します。

```sh
sf org create scratch --definition-file config/project-scratch-def.json --alias scratch-platform-playground --duration-days 7
```

alias は個人環境の値なので、必要に応じて各自のローカルで変えます。
Dev Hub を明示する必要がある場合は、確認済みの Dev Hub を `--target-dev-hub` で指定します。

```sh
sf org display --target-org scratch-platform-playground
```

## 反映

Scratch Org へ反映する deploy scope は `manifest/scratch-org-rebuild.xml` で管理します。
Scratch Org 用 manifest で dry-run します。

```sh
sf project deploy start \
    --dry-run \
    --manifest manifest/scratch-org-rebuild.xml \
    --target-org scratch-platform-playground \
    --wait 30
```

Dev 組織から大きく retrieve した直後や、Scratch Org 用 manifest の対象範囲を見直す場合だけ、`force-app` 全体 dry-run で失敗範囲を確認します。

```sh
sf project deploy start --dry-run --source-dir force-app --target-org scratch-platform-playground --wait 30
```

dry-run が成功したら、同じ scope で反映します。

```sh
sf project deploy start \
    --manifest manifest/scratch-org-rebuild.xml \
    --target-org scratch-platform-playground \
    --wait 30
```

`manifest/scratch-org-rebuild.xml` は、次の source directory から生成した manifest を検査し、Scratch Org に deploy できる scope として残したものです。

- `force-app/main/default/classes`
- `force-app/main/default/triggers`
- `force-app/main/default/lwc`
- `force-app/main/default/objects`
- `force-app/main/default/permissionsets`
- `force-app/main/default/flexipages`
- `force-app/main/default/flows`
- `force-app/main/default/apexEmailNotifications`
- `force-app/main/default/assignmentRules`
- `force-app/main/default/autoResponseRules`
- `force-app/main/default/cleanDataServices`
- `force-app/main/default/homePageLayouts`
- `force-app/main/default/iframeWhiteListUrlSettings`
- `force-app/main/default/layouts`
- `force-app/main/default/matchingRules`
- `force-app/main/default/milestoneTypes`
- `force-app/main/default/quickActions`
- `force-app/main/default/remoteSiteSettings`
- `force-app/main/default/reportTypes`
- `force-app/main/default/roles`
- `force-app/main/default/transactionSecurityPolicies`
- `force-app/main/default/workflows`

External Client App は、Scratch Org へ反映できる範囲だけを `scratch-org/main/default` に分けます。
Dev 組織由来の OAuth link、実行ユーザー、配信状態、consumer key などをそのまま使わないため、`force-app/main/default` とは別 source directory として扱います。

```sh
sf project deploy start \
    --dry-run \
    --source-dir scratch-org/main/default \
    --target-org scratch-platform-playground \
    --wait 30
```

dry-run が成功したら、同じ scope で反映します。

```sh
sf project deploy start \
    --source-dir scratch-org/main/default \
    --target-org scratch-platform-playground \
    --wait 30
```

`scratch-org/main/default` は、External Client App 本体、基本ポリシー、OAuth Settings、Global OAuth 設定、OAuth Security 設定、Scratch Org で dry-run 成功する OAuth policy、DuplicateRule、Settings の deploy 可能な subset だけを含みます。
client credentials flow の実行ユーザーに依存する OAuth policy は、Scratch Org の username を差し込んで生成します。

先に `manifest/scratch-org-rebuild.xml` と `scratch-org/main/default` を反映し、`Salesforce_API_Playground_Integration` Permission Set と External Client App の OAuth Settings が存在する状態にします。

```sh
node scripts/deployment/generate-client-credentials-policy.js scratch-platform-playground
```

生成された source を dry-run します。

```sh
sf project deploy start \
    --dry-run \
    --source-dir scratch-org/generated/client-credentials/main/default \
    --target-org scratch-platform-playground \
    --wait 30
```

dry-run が成功したら、同じ scope で反映します。

```sh
sf project deploy start \
    --source-dir scratch-org/generated/client-credentials/main/default \
    --target-org scratch-platform-playground \
    --wait 30
```

`scratch-org/generated/` は Scratch Org ごとの値を含む生成物なので Git 管理しません。

DuplicateRule は Dev 組織から取得したままの `sortOrder=1` では Scratch Org の標準 DuplicateRule と衝突します。
`scratch-org/main/default/duplicateRules` では `sortOrder=2` に補正した source を使います。

Settings は `force-app/main/default/settings` 全体をそのまま反映しません。
`scratch-org/main/default/settings` には Scratch Org で dry-run と実 deploy が成功した Settings だけを置きます。

この manifest で反映できる主なメタデータ:

- Apex classes / triggers
- Lightning Web Components
- Object 配下の標準オブジェクト差分、ListView、ValidationRule、WebLink
- Permission Set
- FlexiPage
- Flow
- Layout
- Quick Action
- Assignment Rule / Auto Response Rule / Workflow
- Matching Rule
- Role、Report Type、Remote Site Setting など Scratch Org で dry-run 成功した周辺メタデータ
- `scratch-org/main/default` の External Client App / DuplicateRule / Settings subset

この manifest で反映しない主なメタデータ:

- 標準 Profile
- 組織固有または機能前提が強い Settings
- 標準 namespace の CustomApplication / AppMenu
- 空の SharingRules
- Translations
- ManagedContentType
- External Client App OAuth 系メタデータのうち、OAuth link や配信状態に依存するもの
- Settings のうち、未有効化機能、証明書、EmailTemplate、Data Cloud、Territory などの前提で Scratch Org deploy に失敗するもの
- SAML SSO など組織固有の認証設定
- Dev 組織から取得したままの DuplicateRule

これらは Dev 組織から取得できても、Scratch Org では標準アプリ参照、未有効化機能、更新不可コンポーネント、実行ユーザーや証明書などの組織固有前提により dry-run で失敗することがあります。
必要なものだけを個別に有効化、設定、または Scratch Org 用のメタデータへ分離します。

## 変更の取り込み

Scratch Org で作成、変更したメタデータを戻す場合は、`force-app` 全体を retrieve しません。
作業対象を絞った manifest を用意し、その manifest で retrieve します。

```sh
sf project retrieve start --manifest manifest/scratch-work.xml --target-org scratch-platform-playground
```

retrieve 後は Git 差分を確認し、対象外の標準メタデータや組織固有設定が混ざっていないことを確認します。

```sh
git status
git diff
```

Dev 組織へ反映する場合も、同じ作業対象 manifest で dry-run してから deploy します。

```sh
sf project deploy start --dry-run --manifest manifest/scratch-work.xml --target-org salesforce-platform-playground --wait 30
sf project deploy start --manifest manifest/scratch-work.xml --target-org salesforce-platform-playground --wait 30
```

`manifest/scratch-work.xml` は作業単位の manifest です。
必要に応じてファイル名を作業内容に合わせます。
作業対象 manifest は、Scratch Org で実際に変更する予定のメタデータだけを含めます。
`manifest/scratch-org-rebuild.xml` は Scratch Org 作成後の初期反映用なので、Scratch Org から Dev 組織へ戻す用途には使いません。

## 確認

必要に応じて Apex テストを実行します。

```sh
sf apex run test --test-level RunLocalTests --result-format human --target-org scratch-platform-playground
```

Scratch Org 初期反映対象を変更した場合は、少なくとも次を確認します。

- `manifest/scratch-org-rebuild.xml` の deploy が成功すること
- `scratch-org/main/default` の deploy が成功すること
- client credentials policy 生成と `scratch-org/generated/client-credentials/main/default` の deploy が成功すること
- Apex `RunLocalTests` が成功すること
- 確認後に Scratch Org が削除されること

通常は `node scripts/deployment/rebuild-scratch-org.js` の実行結果でこの確認をまとめます。

組織をブラウザで確認する場合:

```sh
sf org open --target-org scratch-platform-playground -b chrome
```

## 削除

確認が終わったら Scratch Org を削除します。
削除前に、必要な metadata や確認結果がリポジトリ側に反映されているか確認します。

対象の alias、状態、有効期限を確認します。

```sh
sf org list
sf org display --target-org scratch-platform-playground
```

対話確認付きで削除します。

```sh
sf org delete scratch --target-org scratch-platform-playground
```

自動化や明示的に削除対象を確認済みの場合は、確認プロンプトを省略できます。

```sh
sf org delete scratch --target-org scratch-platform-playground --no-prompt
```

削除後に一覧から消えたことを確認します。

```sh
sf org list
```

削除対象の alias は個人環境の値です。
複数の Scratch Org がある場合は、`sf org list` で `Type`、`Alias`、`Username`、`Expires` を見て、削除対象を取り違えないようにします。

## 作業報告

Scratch Org 再現を確認した場合は次を報告します。

- 作成に使った scratch definition
- Scratch Org の alias
- 実行した deploy / test
- 再現できなかった metadata や組織設定
- docs または metadata に反映すべき差分
