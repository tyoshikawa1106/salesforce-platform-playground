# Salesforce Platform Playground

Salesforce Platform / Apex / Salesforce metadata を学ぶための Salesforce DX プロジェクトです。

このリポジトリでは、Apex だけでなく Custom Object、Custom Field、Permission Set、Flow、Validation Rule なども扱い、メタデータで新しい Dev 組織へ再現できる状態を目指します。

## ドキュメント

- [Docs](https://tyoshikawa1106.github.io/salesforce-platform-playground/)

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

詳細は [GitHub 運用ルール](docs/development/github-rules.md) を参照します。

## 技術スタック

- Salesforce DX
- Salesforce CLI
- Apex
- Salesforce metadata
- Node.js / npm
- Prettier
- ESLint
- LWC Jest

## 動作環境

ローカルで開発するには、以下が必要です。

- Git
- Node.js
- npm
- Salesforce CLI
- Dev 組織

## セットアップ手順

最初は、リポジトリを clone して依存関係を入れ、Dev 組織へログインします。

```sh
# リポジトリを取得して作業ディレクトリへ移動する
git clone https://github.com/tyoshikawa1106/salesforce-platform-playground.git
cd salesforce-platform-playground

# package-lock.json に固定された依存関係をインストールする
npm ci

# Dev 組織へログインする
sf org login web --set-default --alias dev
```

詳しくは [ローカル開発環境](docs/setup/local-development.md) を参照してください。

## 確認方法

Dev 組織に対する操作は、対象と目的を確認してから実行します。

```sh
npm run sf:validate:dev
npm run sf:deploy:dev
sf apex run test --result-format human
```

Dev 組織への標準 validate / deploy は `manifest/deployable-dev.xml` を使います。
詳しくは [Dev 組織デプロイ](docs/deployment/dev-org-deploy.md) を参照してください。

現在の Dev 組織には source tracking がないため、`sf project deploy preview` は標準の確認手段にしません。

## Salesforce 公式 skills

Salesforce 公式の `forcedotcom/sf-skills` は補助情報として利用します。導入方針は [Salesforce 公式 skills](docs/setup/sf-skills.md) を参照します。

## 参考サイト

| 用途                    | サイト                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Salesforce DX           | [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev)                        |
| Salesforce CLI          | [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli)                                                           |
| Salesforce CLI コマンド | [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference) |
| Apex                    | [Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode)                                 |
| Metadata API            | [Metadata API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta)                         |
| Agent Skills            | [forcedotcom/sf-skills](https://github.com/forcedotcom/sf-skills)                                                                |
| GitHub CLI              | [GitHub CLI Manual](https://cli.github.com/manual/)                                                                              |
