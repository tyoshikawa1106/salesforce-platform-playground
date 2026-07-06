# Salesforce DX Project

## Docs

本プロジェクトの Salesforce DX 開発に関するドキュメントです。

## ドキュメント構成

| ディレクトリ              | 役割                                                          |
| ------------------------- | ------------------------------------------------------------- |
| [setup/](#セットアップ)   | 開発ツール導入とプロジェクト側の準備手順を定義する            |
| [development/](#開発運用) | AI エージェントによる開発時のルール、設定、確認手順を定義する |
| [deployment/](#デプロイ)  | AI エージェントによる Salesforce 組織操作ルールを定義する     |

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

| タイトル                                                           | 概要                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| [AIエージェント開発ルール](development/agent-development-rules.md) | AI エージェントが守る共通開発ルール                     |
| [ドキュメント配置ルール](development/documentation-rules.md)       | docs の置き場所、命名、案内更新ルール                   |
| [Apex 開発ルール](development/apex-rules.md)                       | Apex 実装、テスト、検証の方針                           |
| [GitHub 運用ルール](development/github-rules.md)                   | Issue、PR、CI、リリースの運用                           |
| [メタデータ管理ルール](development/metadata-rules.md)              | Salesforce メタデータの取得・編集・反映・Git 管理の扱い |

## デプロイ

AI エージェントによる Salesforce 組織操作ルールを定義します。

| タイトル                                                                                    | 概要                                            |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [Salesforce 組織操作ルール](deployment/salesforce-org-operation-rules.md)                   | validate / deploy / retrieve / test の実行判断  |
| [CI Salesforce validate ルール](deployment/ci-salesforce-validate-rules.md)                 | GitHub Actions の任意 Salesforce validate 設定  |
| [Salesforce メタデータ削除ルール](deployment/salesforce-org-destructive-changes-rules.md)   | destructive changes の実行条件と復旧確認        |
| [テストデータ投入手順](deployment/test-data-import.md)                                      | テストデータ投入の手順と注意点                  |
| [Scratch Org 再現ルール](deployment/scratch-org-rebuild-rules.md)                           | Scratch Org 作成、初期反映、確認時の実行ルール  |
| [Scratch Org manifest 運用ルール](deployment/scratch-org-manifest-rules.md)                 | Scratch Org での retrieve / deploy scope の扱い |
| [Scratch Org definition feature ルール](deployment/scratch-org-definition-feature-rules.md) | Scratch Org 作成時 feature / settings の扱い    |

ドキュメントの配置方針は [ドキュメント配置ルール](development/documentation-rules.md) に従います。
