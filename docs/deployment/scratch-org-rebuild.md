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

## 作成前の確認

作成前に次を確認します。

- `sfdx-project.json` の package directory と API version
- `config/project-scratch-def.json` の edition、features、settings
- Dev 組織との差分として明示すべき前提
- Scratch Org に投入する metadata が `force-app/main/default` に揃っているか
- 作成に使う alias と duration

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

この manifest で反映できる主なメタデータ:

- Apex classes / triggers
- Lightning Web Components
- Object 配下の標準オブジェクト差分、ListView、ValidationRule、WebLink
- Permission Set
- FlexiPage
- Flow

この manifest で反映しない主なメタデータ:

- 標準 Profile
- 組織固有または機能前提が強い Settings
- 標準 namespace の CustomApplication / AppMenu
- 空の SharingRules
- Translations
- ManagedContentType
- External Client App OAuth 系メタデータ
- SAML SSO など組織固有の認証設定

これらは Dev 組織から取得できても、Scratch Org では標準アプリ参照、未有効化機能、更新不可コンポーネント、実行ユーザーや証明書などの組織固有前提により失敗することがあります。
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
sf project deploy start --dry-run --manifest manifest/scratch-work.xml --target-org salesforce-playground --wait 30
sf project deploy start --manifest manifest/scratch-work.xml --target-org salesforce-playground --wait 30
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
