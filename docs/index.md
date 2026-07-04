# Salesforce Platform Playground

## Docs

本プロジェクトの Salesforce DX 開発に関するドキュメントです。

## ドキュメント構成

| ディレクトリ                      | 役割                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| [setup/](#セットアップ)           | 開発ツール導入とプロジェクト側の準備手順を定義する            |
| [development/](#開発運用)         | AI エージェントによる開発時のルール、設定、確認手順を定義する |
| [deployment/](#デプロイ)          | AI エージェントによる Salesforce 組織操作ルールを定義する     |
| [discussions/](#ディスカッション) | AI エージェントによる調査、設計検討、判断過程を整理する       |
| [knowledge/](#ナレッジ)           | ルールとして強制しない概念、設定説明、参考情報を整理する      |

## セットアップ

開発ツール導入とプロジェクト側の準備手順を定義します。

| タイトル                                                          | 概要                                              |
| ----------------------------------------------------------------- | ------------------------------------------------- |
| [インストール (macOS / Homebrew ベース)](setup/macos-homebrew.md) | macOS での開発ツール一式の導入                    |
| [インストール (Windows / winget ベース)](setup/windows-winget.md) | Windows での開発ツール一式の導入                  |
| [プロジェクト](setup/project.md)                                  | npm 依存と Salesforce 組織ログインの手順          |
| [AI エージェントスキル](setup/agent-skills.md)                    | Salesforce 関連 AI エージェントスキルの導入と扱い |

## 開発運用

AI エージェントによる開発時のルール、設定、確認手順を定義します。

| タイトル                                                           | 概要                                  |
| ------------------------------------------------------------------ | ------------------------------------- |
| [AIエージェント開発ルール](development/agent-development-rules.md) | AI エージェントが守る共通開発ルール   |
| [ドキュメント配置ルール](development/documentation-rules.md)       | docs の置き場所、命名、入口更新ルール |
| [Apex 開発ルール](development/apex-rules.md)                       | Apex 実装、テスト、検証の方針         |
| [GitHub 運用ルール](development/github-rules.md)                   | Issue、PR、CI、リリースの運用         |
| [メタデータ開発ルール](development/metadata-rules.md)              | Salesforce メタデータ変更時の確認観点 |
| [テストデータ投入手順](development/test-data-import.md)            | テストデータ投入の手順と注意点        |
| [.gitignore 運用ルール](development/gitignore-rules.md)            | Git 管理対象外にするファイルの考え方  |

## デプロイ

AI エージェントによる Salesforce 組織操作ルールを定義します。

| タイトル                                                                                    | 概要                                            |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [Salesforce 組織反映ルール](deployment/salesforce-org-deploy-rules.md)                      | deploy / validate の実行条件と報告ルール        |
| [Salesforce メタデータ取得ルール](deployment/salesforce-org-metadata-retrieve-rules.md)     | retrieve の実行条件、差分確認、除外判断         |
| [Salesforce メタデータ削除ルール](deployment/salesforce-org-destructive-changes-rules.md)   | destructive changes の実行条件と復旧確認        |
| [Scratch Org 再現ルール](deployment/scratch-org-rebuild-rules.md)                           | Scratch Org 作成、初期反映、確認時の実行ルール  |
| [Scratch Org manifest 運用ルール](deployment/scratch-org-manifest-rules.md)                 | Scratch Org での retrieve / deploy scope の扱い |
| [Scratch Org definition feature ルール](deployment/scratch-org-definition-feature-rules.md) | Scratch Org 作成時 feature / settings の扱い    |

## ディスカッション

AI エージェントによる調査、設計検討、判断過程を整理します。

| タイトル                                                                                                         | 概要                                               |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [Apex Trigger クラス構成](discussions/apex-trigger-class-structure.md)                                           | Trigger と service class の構成検討                |
| [Apex テストデータ作成クラスの命名](discussions/apex-test-data-class-naming.md)                                  | Apex テストデータ作成クラスの命名検討              |
| [DreamHouse 設定差分の扱い](discussions/dreamhouse-configuration-diff-policy.md)                                 | DreamHouse 由来の設定差分の扱い                    |
| [ESLint 10 と Salesforce / LWC ESLint パッケージの互換性](discussions/eslint-10-salesforce-lwc-compatibility.md) | ESLint 10 と Salesforce LWC 関連パッケージの互換性 |
| [Salesforce メタデータの Git 管理候補](discussions/salesforce-metadata-git-management-candidates.md)             | Git 管理するメタデータ候補の検討                   |

## ナレッジ

ルールとして強制しない概念、設定説明、参考情報を整理します。

| タイトル                                                                                                      | 概要                                                |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [Apex アノテーション](knowledge/apex-annotations.md)                                                          | Apex アノテーションの整理                           |
| [ESLint の unmatched glob](knowledge/eslint-unmatched-globs.md)                                               | ESLint glob 警告の背景                              |
| [force-app deployability 棚卸し](knowledge/force-app-deployability-inventory.md)                              | `force-app` 配下の deploy 可否の整理                |
| [GitHub Issue テンプレート設定](knowledge/github-issue-template-config.md)                                    | Issue テンプレート設定の考え方                      |
| [GitHub Projects と Milestones](knowledge/github-projects-and-milestones.md)                                  | Projects と Milestones の基本                       |
| [GitHub Release Notes 設定](knowledge/github-release-notes-config.md)                                         | Release notes 自動生成の設定                        |
| [GitHub 設定ファイル](knowledge/github-config-files.md)                                                       | CI、Dependabot、Release、Issue / PR template の設定 |
| [LWC の画面遷移](knowledge/lwc-navigation.md)                                                                 | Lightning Web Components の navigation              |
| [LWC Jest とアクセシビリティテスト](knowledge/lwc-jest-accessibility-testing.md)                              | LWC Jest と a11y テストの扱い                       |
| [ローカル開発コマンド](knowledge/local-development-commands.md)                                               | ローカルで使う検証、整形、解析コマンド              |
| [npm audit 確認記録](knowledge/npm-audit-review.md)                                                           | `npm audit` の確認結果と見方                        |
| [npm と pre-commit hook](knowledge/npm-and-precommit.md)                                                      | npm scripts と hook の確認観点                      |
| [package.json](knowledge/package-json.md)                                                                     | npm scripts、依存、hook 設定の読み方                |
| [package.xml retrieve の分析ポイント](knowledge/salesforce-package-xml-retrieve-analysis.md)                  | retrieve 結果を分析する観点                         |
| [package.xml のメタデータ一覧](knowledge/salesforce-package-xml-metadata-types.md)                            | package.xml で扱うメタデータ種別                    |
| [Prettier を CI で確認する意味](knowledge/prettier-check-in-ci.md)                                            | Prettier を CI で確認する理由                       |
| [Sales / Service で使う主要な標準オブジェクト](knowledge/sales-and-service-standard-objects.md)               | Sales / Service で使う標準オブジェクト              |
| [Salesforce CLI で主要標準オブジェクトの seed を作る考え方](knowledge/salesforce-cli-standard-object-seed.md) | 標準オブジェクト seed の作成方針                    |
| [Salesforce API version の上げ方](knowledge/salesforce-api-version-upgrade.md)                                | API version 更新時の確認手順                        |
| [Salesforce Code Analyzer](knowledge/salesforce-code-analyzer.md)                                             | Code Analyzer の実行と結果確認                      |
| [Salesforce Code Analyzer のローカル実行環境](knowledge/salesforce-code-analyzer-local-environment.md)        | Code Analyzer 実行に必要なローカルツール            |
| [Salesforce DX 設定ファイル](knowledge/salesforce-dx-config-files.md)                                         | DX project、Scratch Org、forceignore の設定         |
| [Salesforce 公式参考リンク](knowledge/salesforce-official-references.md)                                      | Salesforce 公式ドキュメントへのリンク               |
| [Salesforce 製品別の標準オブジェクト](knowledge/salesforce-standard-objects/index.md)                         | 製品別の標準オブジェクト索引                        |
| [Settings 有効化状況](knowledge/settings-enable-candidates.md)                                                | Settings メタデータの有効化候補                     |
| [エージェントルールと GitHub Actions の使い分け](knowledge/agent-rules-or-github-actions.md)                  | エージェント作業と CI 自動化の境界                  |
| [設定ファイル管理](knowledge/configuration-files.md)                                                          | 設定ファイルの役割と管理方針                        |

ドキュメントの配置方針は [ドキュメント配置ルール](development/documentation-rules.md) に従います。
