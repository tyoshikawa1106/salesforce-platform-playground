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

### 利用者向け npm スクリプト一覧

#### 検証・解析

| コマンド                     | 用途                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `npm test`                   | スクリプトテストとLWC unit testを順番に実行する。              |
| `npm run test:scripts`       | リポジトリ運用スクリプトのNode.js testを実行する。             |
| `npm run test:unit`          | LWC unit testを実行する。                                      |
| `npm run test:unit:watch`    | LWC unit testを監視モードで実行する。                          |
| `npm run test:unit:debug`    | LWC unit testをデバッグモードで実行する。                      |
| `npm run test:unit:coverage` | LWC unit testを実行してカバレッジを出力する。                  |
| `npm run lint`               | Aura、LWC、リポジトリ運用スクリプトをESLintで検査する。        |
| `npm run lint:slds`          | LWCをSLDS Linterで検査する。                                   |
| `npm run docs:check`         | Markdownの構造、リンク、索引、安全でないコマンド例を検査する。 |
| `npm run prettier:verify`    | 対象ファイルを書き換えず、フォーマットを確認する。             |
| `npm run prettier`           | リポジトリ全体の対象ファイルを自動整形する。                   |
| `npm run code-analyzer`      | `force-app`をSalesforce Code Analyzerで解析する。              |
| `npm run code-analyzer:ci`   | `force-app`をCI基準で解析し、重要度3以上の検出で失敗する。     |

#### Salesforce 組織操作

| コマンド                     | 用途                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| `npm run sf:retrieve`        | Default Target Orgを確認してメタデータを取得する。                |
| `npm run sf:destructive`     | Default Target Orgを確認し、dry-run成功後にメタデータを削除する。 |
| `npm run sf:test:apex`       | Default Target OrgのApexテストを開始し、完了まで監視する。        |
| `npm run sf:test:flow`       | Default Target OrgのFlowテストを開始し、完了まで監視する。        |
| `npm run setup:data`         | Default Target Orgを確認してテストデータを投入する。              |
| `npm run setup:data:dry-run` | 組織を操作せず、テストデータ投入の実行計画を表示する。            |
| `npm run data:bulk:results`  | `logs/data-bulk-results/`でBulk API処理結果を取得する。           |

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
