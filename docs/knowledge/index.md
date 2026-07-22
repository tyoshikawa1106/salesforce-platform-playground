# ナレッジ

Salesforce DX 開発で再利用する解説、調査結果、設定ファイルの読み方を分野別にまとめています。

## AI エージェントとローカル開発

| タイトル                                                                           | 概要                                                      |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [エージェントルールと GitHub Actions の使い分け](agent-rules-or-github-actions.md) | 判断を伴う運用と自動化の分担                              |
| [AI エージェントスキルでできること](agent-skills-capabilities.md)                  | Salesforce 関連スキルの役割と適用範囲                     |
| [Codex の認証操作と実行制御](codex-execution-control.md)                           | 既存認証と新規認証の境界、実行制御設定の使い分け          |
| [ローカル開発コマンド](local-development-commands.md)                              | 状態確認、整形、lint、test、Salesforce CLI の主要コマンド |

## Apex と LWC

| タイトル                                                                         | 概要                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [Apex アノテーション](apex-annotations.md)                                       | 実行方式や公開範囲に影響するアノテーション             |
| [Apex Cursors の設計と使い分け](apex-cursors.md)                                 | Cursor 2 種類と Queueable、Batch Apex の選択基準       |
| [Apex API version 50.0-67.0 の主要追加点](apex-features.md)                      | API version ごとの主要な Apex 機能差分                 |
| [LWC Jest とアクセシビリティテスト](lwc-jest-accessibility-testing.md)           | Jest と `@sa11y/jest` による確認方法                   |
| [LWC の画面遷移](lwc-navigation.md)                                              | コンポーネント内遷移と URL を伴う遷移の使い分け        |
| [Salesforce VS Code の LWC 補完設定と診断](salesforce-vscode-lwc-diagnostics.md) | `jsconfig.json`、TypeScript 警告、`LWC1702` の切り分け |

## 品質チェックと npm

| タイトル                                                                                     | 概要                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [ESLint の unmatched glob](eslint-unmatched-globs.md)                                        | 対象ファイルがない glob の扱い              |
| [npmとpre-commitフック](npm-and-precommit.md)                                                | Husky、lint-staged、Prettierの実行関係      |
| [npm audit 確認記録](npm-audit-review.md)                                                    | audit 結果の確認観点と判断基準              |
| [package.json](package-json.md)                                                              | npm scripts、依存、実行環境の定義           |
| [CI で Prettier を確認する意味](prettier-check-in-ci.md)                                     | formatter を CI で確認する目的              |
| [品質チェック設定ファイル](quality-config-files.md)                                          | formatter、lint、test、Code Analyzer の設定 |
| [Salesforce Code Analyzer](salesforce-code-analyzer.md)                                      | 静的解析の役割と導入方法                    |
| [Salesforce Code Analyzer のローカル実行環境](salesforce-code-analyzer-local-environment.md) | Node.js、Java、Python の前提                |
| [SLDS Linter](slds-linter.md)                                                                | LightningコンポーネントのSLDS準拠確認       |

## GitHub

| タイトル                                                           | 概要                                    |
| ------------------------------------------------------------------ | --------------------------------------- |
| [GitHub 設定ファイル](github-config-files.md)                      | Actions、Dependabot、テンプレートの構成 |
| [GitHub Issue テンプレート設定](github-issue-template-config.md)   | Issue 作成画面の設定                    |
| [GitHub Projects と Milestones](github-projects-and-milestones.md) | 進捗管理と期限管理の使い分け            |
| [GitHubリリースノート設定](github-release-notes-config.md)         | 自動生成リリースノートの設定            |

## Salesforce DX とメタデータ

| タイトル                                                                                            | 概要                                       |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [force-app の deploy 対象棚卸し](force-app-deployability-inventory.md)                              | 標準 deploy scope に含める metadata の判断 |
| [Salesforce API version の上げ方](salesforce-api-version-upgrade.md)                                | API version 更新時の確認手順               |
| [Salesforce CLI で主要標準オブジェクトの seed を作る考え方](salesforce-cli-standard-object-seed.md) | 関連データを投入する方式の選択             |
| [Salesforce DX 設定ファイル](salesforce-dx-config-files.md)                                         | DX と Scratch Org の設定                   |
| [Salesforce 公式参考リンク](salesforce-official-references.md)                                      | 公式ドキュメントとサンプルへの入口         |
| [package.xml のメタデータ一覧](salesforce-package-xml-metadata-types.md)                            | manifest の分類と metadata type            |
| [package.xml による retrieve の分析ポイント](salesforce-package-xml-retrieve-analysis.md)           | 広い retrieve 結果の確認観点               |
| [Salesforce Settings の有効化状況](salesforce-settings-enable-status.md)                            | Settings の状態分類と有効化候補の扱い      |

## 標準オブジェクト

| タイトル                                                                              | 概要                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------- |
| [Sales / Service で使う主要な標準オブジェクト](sales-and-service-standard-objects.md) | Sales Cloud と Service Cloud の早見表 |
| [Salesforce 製品別の標準オブジェクト](salesforce-standard-objects/index.md)           | 製品領域ごとの標準オブジェクト一覧    |
