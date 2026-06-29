# Scratch Org 再現

新しい Scratch Org でこのプロジェクトのメタデータを再現するときの手順です。

## 基本方針

- `config/project-scratch-def.json` は Scratch Org 作成用の設定として扱う。
- Dev 組織への deploy 先設定とは分けて考える。
- Scratch Org で再現できない前提が見つかった場合は、設定または docs に残す。
- 個人環境の alias や認証情報をコミットしない。
- Scratch Org は一時環境として扱い、確認が終わったら削除する。
- `manifest/rebuild-scratch-org.xml` は Scratch Org への反映にだけ使う。
- Scratch Org で作成、変更したメタデータを戻す場合は、作業対象を絞った manifest を用意して retrieve / deploy に使う。
- `force-app` 全体 dry-run は、Dev 組織から大きく retrieve した直後や、Scratch Org 用 manifest の対象範囲を見直す場合だけ実行する。

manifest の使い分けは [Scratch Org と manifest の使い分け](salesforce-scratch-org-manifest-workflow.md) を参照します。

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
3. manifest/rebuild-scratch-org.xml deploy
4. Scratch Org ユーザー用 Permission Set assign
5. Apex test
```

現時点の Dev 組織では、Tooling API の `InstalledSubscriberPackage` と `PackageLicense` はどちらも 0 件です。

## 作成前の確認

作成前に次を確認します。

- `sfdx-project.json` の package directory と API version
- `config/project-scratch-def.json` の edition、features、settings
- Dev 組織との差分として明示すべき前提
- Scratch Org に投入する metadata が `force-app/main/default` に揃っているか
- 作成に使う alias と duration

`config/project-scratch-def.json` の `features` は、通常時は Scratch Org 作成に必要な最小限だけを指定します。
主要な標準オブジェクトの再現性を上げる追加 feature は、必要になった時点で目的別に追加します。
ただし、Scratch Org 作成時に Dev Hub 側で許可されているものだけが使えます。
Commerce、Industry、Loyalty、Einstein、Health Cloud、Financial Services Cloud など、契約や追加 package に強く依存する feature は、必要になった時点で個別に追加します。
`AddCustomRelationships` は `30` では Scratch Org 作成時に無効な数量として失敗するため、作成確認済みの `10` にします。
`TransactionFinalizers` は CLI の schema では候補に含まれますが、現在の Dev Hub では Scratch Org 作成時に無効な feature として失敗したため指定しません。

## 一括実行

通常の Scratch Org 準備は、固定の `sf` コマンドとテストデータ投入コマンドを順に実行するだけのスクリプトで行います。
Scratch Org 作成、manifest deploy、Scratch Org ユーザー用 Permission Set assign、標準オブジェクトのテストデータ投入までを順に実行します。
途中で失敗した場合はそこで停止します。
alias、duration、manifest、Permission Set、import plan は `scripts/deployment/scratch-org/scratch-org.json` で定義します。

```sh
node scripts/deployment/scratch-org/rebuild-scratch-org.js
```

途中で失敗した場合は、失敗したステップのスクリプトだけを再実行します。

```sh
node scripts/deployment/scratch-org/scratch-org-create.js
node scripts/deployment/scratch-org/scratch-org-deploy.js
node scripts/deployment/scratch-org/scratch-org-assign-permset.js
node scripts/deployment/scratch-org/scratch-org-import-test-data.js
```

alias、Dev Hub、package install、途中確認などを変える場合は、`scratch-org.json` または次の手順の個別 `sf` コマンドを確認します。

## 作成

Scratch Org を作成します。

```sh
sf org create scratch --definition-file config/project-scratch-def.json --alias scratch-platform-playground --duration-days 7
```

alias は `scripts/deployment/scratch-org/scratch-org.json` で指定します。
Dev Hub を明示する必要がある場合は、確認済みの Dev Hub を `--target-dev-hub` で指定します。

```sh
sf org display --target-org scratch-platform-playground
```

## 反映

Scratch Org へ反映する deploy scope は `manifest/rebuild-scratch-org.xml` で管理します。
Scratch Org 用 manifest で dry-run します。

```sh
sf project deploy start \
    --dry-run \
    --manifest manifest/rebuild-scratch-org.xml \
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
    --manifest manifest/rebuild-scratch-org.xml \
    --target-org scratch-platform-playground \
    --wait 30
```

`manifest/rebuild-scratch-org.xml` は、次の source directory から生成した manifest を検査し、Scratch Org に deploy できる scope として残したものです。

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

Scratch Org 専用 source directory は作りません。
初期反映の正本は `force-app/main/default` と `manifest/rebuild-scratch-org.xml` に寄せ、Scratch Org の機能有効化は `config/project-scratch-def.json` で扱います。
Settings や DuplicateRule を Scratch Org 用にコピーして個別補正すると二重管理になりやすいため、必要な場合は対象 metadata ごとに manifest、scratch definition、または手順 docs で扱います。

External Client App は Dev 組織由来の OAuth link、実行ユーザー、配信状態、consumer key などを含みやすいため、通常の Scratch Org 初期反映には含めません。
Scratch Org で External Client App まで検証する必要が出た場合は、初期反映手順とは別に、org 固有値を含まない方法を個別に設計します。

Scratch Org の作成ユーザーには、ユーザー作成アプリへのアクセス権として `Salesforce_Platform_Playground_User` Permission Set を割り当てます。
スクリプトでは metadata deploy 後に自動実行します。

```sh
sf org assign permset --name Salesforce_Platform_Playground_User --target-org scratch-platform-playground
```

この manifest で反映できる主なメタデータ:

- Apex classes / triggers
- Lightning Web Components
- Object 配下の標準オブジェクト差分、ListView、ValidationRule、WebLink
- Permission Set
- Custom Application（ユーザー作成アプリ）
- FlexiPage
- Flow
- Layout
- Quick Action
- Assignment Rule / Auto Response Rule / Workflow
- Matching Rule
- Role、Report Type、Remote Site Setting など Scratch Org で dry-run 成功した周辺メタデータ

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

`WorkPlan` / `WorkPlanTemplate` / `WorkStep` と、それらの関連リストを含む WorkOrder 周辺 Layout は Field Service feature に依存します。
`FieldService.settings` の `enableWorkOrders=true` だけでは既存 Scratch Org に WorkPlan 系オブジェクトは追加されないため、Scratch Org 作成時点で `config/project-scratch-def.json` の `features` に `FieldService:<ライセンス数>` を指定します。

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
`manifest/rebuild-scratch-org.xml` は Scratch Org 作成後の初期反映用なので、Scratch Org から Dev 組織へ戻す用途には使いません。

## 確認

必要に応じて Apex テストを実行します。

```sh
sf apex run test --test-level RunLocalTests --result-format human --target-org scratch-platform-playground
```

Scratch Org 初期反映対象を変更した場合は、必要に応じて次を確認します。

- `manifest/rebuild-scratch-org.xml` の deploy が成功すること
- Apex `RunLocalTests` が成功すること

通常は `node scripts/deployment/scratch-org/rebuild-scratch-org.js` の実行結果、またはこのページの個別 `sf` コマンドの実行結果で準備内容をまとめます。

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

同じ確認付き削除はスクリプトでも実行できます。

```sh
node scripts/deployment/scratch-org/delete-scratch-org.js
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
