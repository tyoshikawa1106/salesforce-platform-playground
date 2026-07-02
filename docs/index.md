# Salesforce Platform Playground

## ドキュメント

Salesforce DX 開発に関するこのプロジェクト固有のメモを置きます。

## 構成

| タイトル       | 概要                                                   |
| -------------- | ------------------------------------------------------ |
| `setup/`       | ローカルツール、組織ログイン、環境セットアップ         |
| `development/` | Apex やメタデータ変更時の実務チェック                  |
| `deployment/`  | デプロイ、取得、削除変更、新規組織への再現に関するメモ |
| `discussions/` | 設計案、課題、見直し内容など、判断過程を整理したメモ   |
| `knowledge/`   | Salesforce Platform の概念を学ぶためのメモ             |

## セットアップ

| タイトル                                                                     | 概要                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------- |
| [ローカル開発環境](setup/local-development.md)                               | Salesforce CLI とローカル作業環境の基本  |
| [macOS / Homebrew 開発環境](setup/macos-homebrew-development-environment.md) | macOS での Homebrew ベースのセットアップ |
| [Windows / winget 開発環境](setup/windows-winget-development-environment.md) | Windows での winget ベースのセットアップ |
| [Salesforce 公式 skills](setup/sf-skills.md)                                 | Salesforce 公式 skills の導入と扱い      |

## 主要ドキュメント

| タイトル                                                                           | 概要                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------- |
| [変更チェックリスト](development/change-checklist.md)                              | 変更前後に確認する標準チェック        |
| [Apex 開発ルール](development/apex-rules.md)                                       | Apex 実装、テスト、検証の方針         |
| [メタデータ開発ルール](development/metadata-rules.md)                              | Salesforce メタデータ変更時の確認観点 |
| [force-app deployability 棚卸し](development/force-app-deployability-inventory.md) | `force-app` 配下の deploy 可否の整理  |
| [GitHub 運用ルール](development/github-rules.md)                                   | Issue、PR、CI、リリースの運用         |

## 開発運用

| タイトル                                                                                                        | 概要                                   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [開発コマンド一覧](development/development-commands.md)                                                         | ローカルで使う検証、整形、解析コマンド |
| [ドキュメント配置ルール](development/documentation-rules.md)                                                    | docs の置き場所、命名、入口更新ルール  |
| [設定ファイル管理](development/configuration-files.md)                                                          | 設定ファイルの役割と管理方針           |
| [npm と pre-commit hook](development/npm-and-precommit.md)                                                      | npm scripts と hook の確認観点         |
| [CI で Prettier を確認する意味](development/prettier-check-in-ci.md)                                            | Prettier を CI で確認する理由          |
| [Salesforce CLI テストデータインポート](development/test-data-import.md)                                        | テストデータ投入の手順と注意点         |
| [Salesforce CLI で主要標準オブジェクトの seed を作る考え方](development/salesforce-cli-standard-object-seed.md) | 標準オブジェクト seed の作成方針       |
| [Settings 有効化状況](development/settings-enable-candidates.md)                                                | Settings メタデータの有効化候補        |
| [.gitignore 運用メモ](development/gitignore-rules.md)                                                           | Git 管理対象外にするファイルの考え方   |
| [LWC Jest とアクセシビリティテスト](development/lwc-jest-accessibility-testing.md)                              | LWC Jest と a11y テストの扱い          |
| [Salesforce Code Analyzer](development/salesforce-code-analyzer.md)                                             | Code Analyzer の実行と結果確認         |
| [Salesforce API version の上げ方](development/salesforce-api-version-upgrade.md)                                | API version 更新時の確認手順           |
| [Salesforce メタデータの Git 管理候補](development/salesforce-metadata-git-management-candidates.md)            | Git 管理するメタデータ候補             |
| [package.xml のメタデータ一覧](development/salesforce-package-xml-metadata-types.md)                            | package.xml で扱うメタデータ種別       |
| [package.xml retrieve の分析ポイント](development/salesforce-package-xml-retrieve-analysis.md)                  | retrieve 結果を分析する観点            |

## デプロイ

| タイトル                                                                                           | 概要                                       |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [Dev 組織デプロイ](deployment/dev-org-deploy.md)                                                   | Dev 組織への deploy と検証手順             |
| [メタデータ取得ルール](deployment/retrieve-rules.md)                                               | retrieve の対象、確認、差分管理            |
| [削除変更ルール](deployment/destructive-changes.md)                                                | destructive changes の扱い                 |
| [Scratch Org 再現](deployment/scratch-org-rebuild.md)                                              | Scratch Org の再現手順                     |
| [Scratch Org と manifest の使い分け](deployment/salesforce-scratch-org-manifest-workflow.md)       | Scratch Org と manifest deploy の使い分け  |
| [Scratch Org definition の feature 設定](deployment/salesforce-scratch-org-definition-features.md) | Scratch Org definition の feature 設定方針 |

## レビュー

| タイトル                                              | 概要                         |
| ----------------------------------------------------- | ---------------------------- |
| [npm audit 確認メモ](development/npm-audit-review.md) | `npm audit` の確認結果と見方 |

## ナレッジ

| タイトル                                                                                           | 概要                                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [エージェントルールと GitHub Actions の使い分け](knowledge/agent-rules-or-github-actions.md)       | エージェント作業と CI 自動化の境界     |
| [GitHub Projects と Milestones](knowledge/github-projects-and-milestones.md)                       | Projects と Milestones の基本          |
| [GitHub Issue テンプレート設定](knowledge/github-issue-template-config.md)                         | Issue テンプレート設定の考え方         |
| [GitHub Release notes 設定](knowledge/github-release-notes-config.md)                              | Release notes 自動生成の設定           |
| [ESLint の unmatched glob](knowledge/eslint-unmatched-globs.md)                                    | ESLint glob 警告の背景                 |
| [LWC の画面遷移](knowledge/lwc-navigation.md)                                                      | Lightning Web Components の navigation |
| [Apex アノテーション](knowledge/apex-annotations.md)                                               | Apex アノテーションの整理              |
| [Sales / Service で使う主要な標準オブジェクト](knowledge/sales-and-service-standard-objects.md)    | Sales / Service で使う標準オブジェクト |
| [Salesforce 製品別の標準オブジェクト](knowledge/salesforce-standard-objects/index.md)              | 製品別の標準オブジェクト索引           |
| [Salesforce Code Analyzer のローカル環境](knowledge/salesforce-code-analyzer-local-environment.md) | Code Analyzer のローカル環境メモ       |
| [Salesforce 公式参考リンク](knowledge/salesforce-official-references.md)                           | Salesforce 公式ドキュメントへのリンク  |

## ディスカッション

| タイトル                                                                                                         | 概要                                               |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [Apex Trigger クラス構成](discussions/apex-trigger-class-structure.md)                                           | Trigger と service class の構成検討                |
| [ESLint 10 と Salesforce / LWC ESLint パッケージの互換性](discussions/eslint-10-salesforce-lwc-compatibility.md) | ESLint 10 と Salesforce LWC 関連パッケージの互換性 |
| [DreamHouse 設定差分の扱い](discussions/dreamhouse-configuration-diff-policy.md)                                 | DreamHouse 由来の設定差分の扱い                    |
| [Apex テストデータ作成クラスの命名](discussions/test-fixture-factory-naming.md)                                  | Apex テストデータ作成クラスの命名検討              |

ドキュメントの配置方針は [ドキュメント配置ルール](development/documentation-rules.md) に従います。
