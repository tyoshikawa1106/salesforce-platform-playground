# Salesforce DX Project

## ドキュメント

- [Docs](docs/index.md)

## 開発ルール

| 対象               | 形式                      |
| ------------------ | ------------------------- |
| 作業ブランチ       | `feature/...`             |
| Codex 作業ブランチ | `codex/...`               |
| コミットメッセージ | `<type>: <日本語summary>` |
| PR title           | `<type>: <日本語summary>` |

`type` は変更内容に合わせて以下から選びます。

| type       | 用途                   |
| ---------- | ---------------------- |
| `feat`     | 機能追加               |
| `fix`      | 不具合修正             |
| `docs`     | ドキュメント変更       |
| `test`     | テスト追加、修正       |
| `refactor` | 振る舞いを変えない整理 |
| `style`    | 見た目や整形の変更     |
| `ci`       | CI 設定の変更          |
| `chore`    | その他の保守作業       |
| `revert`   | 変更の取り消し         |

## 技術スタック

- Salesforce DX
- Salesforce CLI
- Node.js 24
- Prettier
- ESLint
- SLDS Linter
- LWC Jest
- Salesforce Code Analyzer

## 開発環境

ローカルで開発するには、以下が必要です。

- Salesforce 開発組織
- Salesforce CLI
- Git
- Node.js 24
- npm
- OpenJDK
- Python 3.10 以上

## セットアップ手順

作業ディレクトリで依存関係をインストールし、Salesforce 開発組織へログインします。

```sh
# package-lock.json に固定された依存関係をインストールする
npm ci

# Salesforce 開発組織へログインする
sf org login web --alias <alias> --set-default --browser chrome
```

## 開発コマンド

Salesforce 開発組織に対する操作は、対象と目的を確認してから実行します。

### Salesforce 組織操作

#### メタデータ操作

Default Target Org の情報と組織種別を確認してから、メタデータを取得します。

```sh
npm run sf:retrieve
```

Default Target Orgの情報と組織種別を確認し、接続組織が承認された場合だけdry-runを実行します。dry-runが成功すると、同じ対象組織とmanifestで実削除します。本番環境とDeveloper Editionではdry-run前に追加確認を行います。

```sh
npm run sf:destructive
```

#### Salesforce 組織テスト

Default Target Org の Apex テストを開始し、完了まで監視して結果とカバレッジを取得します。

```sh
npm run sf:test:apex
```

Default Target Org の Flow テストを開始し、完了まで監視して結果とカバレッジを取得します。

```sh
npm run sf:test:flow
```

#### 最新レコードのエクスポートと項目定義の確認

次のクエリで対象オブジェクトのラベルとAPI名を取得できる。

```sh
# テーブル形式表示
sf data query --use-tooling-api --query "SELECT Label, QualifiedApiName, DataType, Length, Precision, Scale FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Account' ORDER BY QualifiedApiName"
# CSV形式表示
sf data query --use-tooling-api --query "SELECT Label, QualifiedApiName, DataType, Length, Precision, Scale FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Account' ORDER BY QualifiedApiName" --result-format csv
# CSV形式表示 (対象組織を指定)
sf data query --use-tooling-api --query "SELECT Label, QualifiedApiName, DataType, Length, Precision, Scale FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Account' ORDER BY QualifiedApiName" --result-format csv --target-org <alias>
# CSVファイルエクスポート
sf data query --use-tooling-api --query "SELECT Label, QualifiedApiName, DataType, Length, Precision, Scale FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Account' ORDER BY QualifiedApiName" --result-format csv --output-file export-out/account-fields.csv
```

`scripts/record-export/config/fields.txt` に、取得するAPI名を出力順に1行ずつ記載します。

```text
Id
Name
CreatedDate
```

項目の登録値をプレビュー用途で取得。空欄は新しいレコードからまとめて補完し、残りは検索可能な項目をOR条件で検索します。
出力形式は `export-out/` に項目順の縦型CSVで出力します。

```sh
# 項目の登録値をプレビュー用途で取得
npm run sf:export:record-fields-preview -- --object Account
```

直近2000件のレコードを取得。空項目の値もそのまま表示。
出力形式は `export-out/` に項目順の横型CSVで出力します。

```sh
npm run sf:export:records -- --object Account --record-limit 2000
```

指定日より前に作成されたレコードだけを取得・補完します（日本時間・当日を含まない。未指定は最新から取得）。

```sh
npm run sf:export:record-fields-preview -- --object Account --created-before 2026-10-01
npm run sf:export:records -- --object Account --record-limit 2000 --created-before 2026-10-01
```

個人取引先など、指定したレコードタイプだけを取得・補完の対象にします（`<ID>` を置き換え）。

```sh
# 項目登録値のプレビュー用1レコード取得
npm run sf:export:record-fields-preview -- --object Account --record-type-id <ID>
# 直近レコードを取得
npm run sf:export:records -- --object Account --record-limit 2000 --record-type-id <ID>
```

出力先を指定して実行します。縦型は項目ごと、横型は全項目が揃ったレコードごとに `.partial.csv` を更新します。

```sh
# 出力先を指定して実行
npm run sf:export:record-fields-preview -- --object Account --output export-out/account-preview.csv
npm run sf:export:records -- --object Account --record-limit 2000 --output export-out/account-records.csv
# 中断時は表示された再開コマンドを実行（以下は既定条件の例）
npm run sf:export:record-fields-preview -- --object Account --output export-out/account-preview.csv --resume
npm run sf:export:records -- --object Account --record-limit 2000 --output export-out/account-records.csv --resume
```

#### テストデータ操作

組織を操作せず、テストデータ投入の実行計画を表示します。

```sh
npm run setup:data:dry-run
```

Default Target Org の情報と組織種別を確認してから、テストデータを投入します。

```sh
npm run setup:data
```

完了した Bulk API 2.0 のジョブ ID を指定し、Default Target Org の処理結果を `logs/data-bulk-results/` で取得します。`--` より後ろの引数が Salesforce CLI へ渡されます。

```sh
npm run data:bulk:results -- --job-id <job-id>
```

### ローカルテスト

リポジトリ運用スクリプトと LWC unit test を順番に実行します。

```sh
npm test
```

リポジトリ運用スクリプトの Node.js test を実行します。

```sh
npm run test:scripts
```

LWC unit test を実行します。

```sh
npm run test:unit
```

ファイル変更を監視し、関連する LWC unit test を自動再実行します。

```sh
npm run test:unit:watch
```

Node.js デバッガを接続できる状態で、LWC unit test を直列実行します。

```sh
npm run test:unit:debug
```

LWC unit test を実行してカバレッジを出力します。

```sh
npm run test:unit:coverage
```

### コードとドキュメントの検査

Aura、LWC、リポジトリ運用スクリプトを ESLint で検査します。

```sh
npm run lint
```

LWC を SLDS Linter で検査します。

```sh
npm run lint:slds
```

Markdown の構造、リンク、索引、安全でないコマンド例を検査します。

```sh
npm run docs:check
```

対象ファイルを書き換えず、フォーマットを確認します。

```sh
npm run prettier:verify
```

リポジトリ全体の対象ファイルを自動整形します。全体を整形する必要がある場合だけ実行します。

```sh
npm run prettier
```

### Salesforce Code Analyzer

`force-app` を推奨ルールで解析し、結果をローカル確認用のファイルへ出力します。

```sh
npm run code-analyzer
```

`force-app` を CI 基準で解析し、重要度 3 以上の検出で失敗します。

```sh
npm run code-analyzer:ci
```

### ローカル生成ログの削除

`logs/` 配下に生成された Git の ignore 対象ファイルを一括削除します。必要なログを別の場所へ退避してから実行します。削除したファイルは復元できません。

```sh
git clean -fdX logs
```

`-X` によって ignore 対象だけを削除するため、Git 管理している各ログガイドは残ります。

### ProfileからPermission Setへの変換

ProfileをPermission Setへ変換するためのmetadataを生成します。

```sh
npm run sf:convert:profile
```

## AI エージェントスキル

`forcedotcom/sf-skills` は、Salesforce の GitHub organization が公開している AI エージェント向けスキル集です。Apex、Flow、メタデータ、SOQL、Apex テストなどの Salesforce 関連作業で、実装や確認観点の参考情報として利用します。

Skills 本体は `.agents/skills/`、取得元と内容の識別情報は `skills-lock.json` で Git 管理しているため、追加の導入作業は不要です。プロジェクト固有の判断と実行条件は `AGENTS.md` と `docs/` を優先します。

## 参考サイト

| サイト                   | リンク                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Salesforce DX            | [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev)           |
| Salesforce CLI           | [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli)                                              |
| Lightning Web Components | [Lightning Web Components Developer Guide](https://developer.salesforce.com/docs/platform/lwc/guide)                |
| Lightning Component      | [Lightning Component Reference](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide) |
| Lightning Design System  | [Lightning Design System](https://www.lightningdesignsystem.com/)                                                   |
| Apex                     | [Apex Developer Guide](https://developer.salesforce.com/docs/atlas.ja-jp.apexcode.meta/apexcode)                    |
| SOQL and SOSL            | [SOQL and SOSL Reference](https://developer.salesforce.com/docs/atlas.ja-jp.soql_sosl.meta/soql_sosl)               |
| Metadata API             | [Metadata API Developer Guide](https://developer.salesforce.com/docs/atlas.ja-jp.api_meta.meta/api_meta)            |
| Salesforce Code Analyzer | [Salesforce Code Analyzer](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide)           |
| Data Loader              | [Data Loader Guide](https://developer.salesforce.com/docs/atlas.ja-jp.260.0.dataLoader.meta/dataLoader/)            |
| Salesforce Sample Apps   | [Salesforce Developers Sample Apps](https://github.com/trailheadapps)                                               |
| Agent Skills             | [forcedotcom/sf-skills](https://github.com/forcedotcom/sf-skills)                                                   |
