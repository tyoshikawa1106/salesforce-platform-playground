# Salesforce Code Analyzer

この文書は、Salesforce Code Analyzer が何をするものか、ローカル環境や CI にどう導入するかを整理します。

## 何をするものか

Salesforce Code Analyzer は、Salesforce CLI、VS Code、GitHub Actions などから実行できる静的解析ツールです。

Apex、Visualforce、Flow、Lightning components、JavaScript、TypeScript、CSS、HTML などを解析し、次のような問題を早めに見つけるために使います。

- セキュリティ上の懸念
- パフォーマンス上の懸念
- コーディング規約やベストプラクティス違反
- 重複コード
- JavaScript 依存ライブラリの脆弱性

Code Analyzer は deploy や Apex test の代わりではありません。コード品質とセキュリティの確認を補助するゲートとして使います。

## 主な構成

Code Analyzer は複数の engine をまとめて扱います。

| engine      | 役割                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| `pmd`       | Apex や Visualforce などの静的解析。AppExchange 向け PMD ルールも含む。 |
| `eslint`    | JavaScript / TypeScript / LWC などの ESLint 解析。                      |
| `flow`      | Salesforce Flow のセキュリティ監査。                                    |
| `cpd`       | ファイル間の重複コード検出。                                            |
| `retire-js` | JavaScript 依存ライブラリの既知脆弱性検出。                             |
| `regex`     | 正規表現ベースの独自ルール検出。                                        |
| `sfge`      | Apex の複雑なセキュリティ解析を行う Salesforce Graph Engine。           |

## 導入前提

基本前提は Salesforce CLI です。

追加で、使う engine に応じて次が必要です。

- Node.js: Salesforce CLI を npm で入れる場合は Node.js 20 以降。
- Java JDK 11 以降: `pmd`、`cpd`、`sfge` を使う場合。
- Python 3.10 以降: `flow` を使う場合。

Java や Python を入れない運用にする場合は、使わない engine を `code-analyzer.yml` で無効化します。

## インストール

Code Analyzer は Salesforce CLI plugin として提供されます。

Code Analyzer v5 では JIT plugin として動作するため、`sf code-analyzer rules` などを初めて実行したときに、未導入なら Salesforce CLI が plugin を自動導入します。

手動で入れる場合:

```sh
sf plugins install @salesforce/plugin-code-analyzer
```

確認:

```sh
sf plugins
sf code-analyzer --help
sf code-analyzer rules
```

更新する場合は、同じ install コマンドを再実行します。

## 基本的な使い方

利用可能なルールを確認する:

```sh
sf code-analyzer rules
```

`force-app` を推奨ルールで解析する:

```sh
sf code-analyzer run --rule-selector Recommended --target force-app
```

結果をファイルに出力する:

```sh
sf code-analyzer run --rule-selector Recommended --target force-app --output-file logs/code-analyzer/local.json
```

`--output-file` の拡張子に応じて、HTML、JSON、CSV、XML、SARIF などの形式で出力できます。
このリポジトリでは、再生成できる解析結果を Git 管理しないため、出力先は `.gitignore` の `logs/code-analyzer/` に揃えます。
標準の npm script は `logs/code-analyzer/local.json` に出力します。

severity を指定して CI で失敗させたい場合:

```sh
sf code-analyzer run --rule-selector Recommended --target force-app --severity-threshold 3
```

このリポジトリの CI 相当チェックは、結果を `logs/code-analyzer/ci.json` に出力します。

```sh
npm run code-analyzer:ci
```

## ルールの選び方

`--rule-selector` で実行するルールを選びます。

| 目的                                     | 例                                                   |
| ---------------------------------------- | ---------------------------------------------------- |
| 推奨ルール全体                           | `--rule-selector Recommended`                        |
| ESLint の推奨ルール                      | `--rule-selector eslint:Recommended`                 |
| PMD の全ルール                           | `--rule-selector pmd`                                |
| セキュリティ系                           | `--rule-selector all:Security`                       |
| severity 2 以上の security / performance | `--rule-selector "all:(Security,Performance):(1,2)"` |

`eslint` だけを指定すると ESLint engine の全ルール対象になります。通常は `eslint:Recommended` のように、推奨ルールに絞るかどうかを明示します。

## 設定ファイル

Code Analyzer の設定ファイルは、通常 workspace root に `code-analyzer.yml` または `code-analyzer.yaml` として置きます。

このリポジトリでは `config/code-analyzer/pmd-ruleset.xml` にカスタム PMD ruleset を置きます。標準ルールを suppression や `disabled` で隠さず、リポジトリ規約と衝突する標準ルールから `Recommended` タグを外し、次の置換ルールへ同タグを付けます。

| 標準ルール            | 置換ルール                  | リポジトリ固有の判定                                                                 |
| --------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `ApexDoc`             | `ApexDocWithoutProperties`  | `reportProperty=false` とし、プロパティは `//`、公開契約は ApexDoc で検査する        |
| `AvoidLogicInTrigger` | `TriggerDelegatesToHandler` | Trigger context 分岐と handler 呼び出しを許可し、SOQL、DML、代入、業務処理を拒否する |

標準ルールは `Upstream` タグと rule 名を指定すれば実行できます。

CLI コマンドは現在のフォルダにある設定ファイルを自動で読み込みます。別の場所に置く場合は `--config-file` を指定します。

設定ファイルでは、次のようなことを調整できます。

- engine の挙動
- rule の severity や tag
- 特定ファイルやパターンの ignore
- suppression
- 独自ルール

LWC / Aura の ESLint 設定をリポジトリ側の `eslint.config.js` に寄せる場合は、次のような設定を検討します。

```yaml
engines:
    eslint:
        auto_discover_eslint_config: true
        disable_lwc_base_config: true
```

これは Code Analyzer の ESLint engine に、リポジトリの ESLint 設定を自動検出させ、Code Analyzer 側の LWC base config との重複適用を避けるための設定です。

## CI で使う場合

CI では次の用途があります。

- pull request の静的解析
- security / performance ルールの gate
- HTML や SARIF などのレポート生成
- AppExchange Security Review 向けの scan report 生成

ただし CI に入れると、ローカルでは見えていなかった Java / Python / plugin version の差で失敗することがあります。まずローカルで実行できる状態を作り、必要な engine と rule selector を絞ってから CI に入れます。

## 参考リンク

- [Salesforce Code Analyzer: Get Started](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide)
- [Salesforce Code Analyzer: Overview](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/code-analyzer.html)
- [Salesforce Code Analyzer: Engines](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/engines.html)
- [Salesforce Code Analyzer: Use CLI Commands to Analyze Your Code](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/analyze.html)
- [Salesforce Code Analyzer: Customize the Configuration](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/config-custom.html)
- [forcedotcom/code-analyzer](https://github.com/forcedotcom/code-analyzer)
