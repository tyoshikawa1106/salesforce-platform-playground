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
sf org login web --alias <alias>
```

## 開発コマンド

Salesforce 開発組織に対する操作は、対象と目的を確認してから実行します。

### メタデータの取得

VS Codeで現在接続している組織から、管理対象のメタデータを取得します。表示されたdefault target orgを確認し、`y`または`Y`を入力した場合だけ取得を開始します。詳細は[メタデータ開発ルール](docs/development/metadata-rules.md)を参照してください。

```sh
npm run sf:retrieve
```

### メタデータの削除

`manifest/destructiveChanges.xml`に記載したメタデータをdefault target orgから削除します。対象組織の確認後にdry-runを実行し、成功後の再確認で`y`または`Y`を入力した場合だけ実削除します。詳細は[メタデータ削除ルール](docs/deployment/metadata-deletion-rules.md)を参照してください。

```sh
npm run sf:destructive
```

### 検証・反映・品質確認

`<alias>` は実行前に確認した対象 org alias に置き換えます。

```sh
# Salesforce 開発組織への反映を検証する
npm run sf:validate:dev -- --target-org <alias>

# Salesforce 開発組織へ反映する
npm run sf:deploy:dev -- --target-org <alias>

# Apex テストを実行する
sf apex run test --result-format human --target-org <alias>

# 整形を確認する
npm run prettier:verify

# Aura / LWC JavaScript を lint する
npm run lint -- --no-error-on-unmatched-pattern

# LWC unit test を実行する
npm run test:unit -- -- --runInBand --passWithNoTests

# Salesforce Code Analyzer を実行する
npm run code-analyzer:ci
```

Salesforce 開発組織を初期反映するときは `manifest/rebuild-developer-org.xml` を使います。

## AI エージェントスキル

`forcedotcom/sf-skills` は、Salesforce の GitHub organization が公開している AI エージェント向けスキル集です。Apex、Flow、メタデータ、SOQL、Apex テストなどの Salesforce 関連作業で、実装や確認観点の参考情報として利用します。

```sh
npx skills add forcedotcom/sf-skills
```

このコマンドを実行すると `.agents/skills/` と `skills-lock.json` が生成されます。

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
