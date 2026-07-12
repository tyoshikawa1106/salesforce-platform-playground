# ドキュメント

Salesforce DX 開発のセットアップ、運用ルール、組織操作、機能仕様、ナレッジ、検討記録をまとめています。

## ドキュメント構成

| カテゴリ                                    | 内容                                                      |
| ------------------------------------------- | --------------------------------------------------------- |
| [セットアップ](#セットアップ)               | 開発ツールとプロジェクトの準備                            |
| [開発運用](#開発運用)                       | 開発時に守るルールと確認事項                              |
| [Salesforce 組織操作](#salesforce-組織操作) | validate、deploy、retrieve、Scratch Org、テストデータ投入 |
| [機能仕様](specifications/index.md)         | 開発した機能の現在の仕様と仕組み                          |
| [ナレッジ](knowledge/index.md)              | 再利用する解説、調査結果、設定ファイルの読み方            |
| [ディスカッション](discussions/index.md)    | 設計や運用を決めるまでの比較と判断過程                    |

## セットアップ

開発環境を初めて準備するときに参照します。

| タイトル                                                        | 概要                                      |
| --------------------------------------------------------------- | ----------------------------------------- |
| [macOS 開発環境のセットアップ](setup/macos-homebrew-setup.md)   | Homebrew を使った開発ツールの導入         |
| [Windows 開発環境のセットアップ](setup/windows-winget-setup.md) | winget を使った開発ツールの導入           |
| [プロジェクトのセットアップ](setup/project-setup.md)            | npm 依存、Prettier、Salesforce CLI の準備 |
| [AI エージェントスキル](setup/agent-skills.md)                  | Salesforce 関連スキルの導入と扱い         |

## 開発運用

リポジトリで作業するときに守るルールです。

| タイトル                                                            | 概要                                  |
| ------------------------------------------------------------------- | ------------------------------------- |
| [AI エージェント開発ルール](development/agent-development-rules.md) | 作業開始から報告までの共通ルール      |
| [Apex 開発ルール](development/apex-rules.md)                        | Apex の実装、テスト、検証             |
| [GitHub 運用ルール](development/github-rules.md)                    | Issue、PR、CI、リリース               |
| [メタデータ管理ルール](development/metadata-rules.md)               | metadata の取得、編集、反映、Git 管理 |
| [ドキュメント配置ルール](development/documentation-rules.md)        | docs の配置、命名、案内更新           |
| [機能仕様書ルール](development/specification-rules.md)              | 機能仕様の単位、命名、分割、更新      |

## Salesforce 組織操作

Salesforce 組織へ操作を行う前に、目的に合うルールを参照します。

| タイトル                                                                                    | 概要                                         |
| ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [Salesforce 組織操作ルール](deployment/salesforce-org-operation-rules.md)                   | validate、deploy、retrieve、test の実行判断  |
| [CI Salesforce validate ルール](deployment/ci-salesforce-validate-rules.md)                 | GitHub Actions の任意 validate 設定          |
| [Salesforce メタデータ削除ルール](deployment/salesforce-org-destructive-changes-rules.md)   | destructive changes の実行条件と復旧確認     |
| [テストデータ投入手順](deployment/test-data-import.md)                                      | 合成テストデータの投入と cleanup             |
| [Scratch Org 再現ルール](deployment/scratch-org-rebuild-rules.md)                           | Scratch Org の作成、初期反映、確認           |
| [Scratch Org 再現の前提と設定](deployment/scratch-org-rebuild-reference.md)                 | Installed Package、alias、Scratch definition |
| [Scratch Org manifest 運用ルール](deployment/scratch-org-manifest-rules.md)                 | Scratch Org の retrieve / deploy scope       |
| [Scratch Org definition feature ルール](deployment/scratch-org-definition-feature-rules.md) | Scratch Org 作成時の features / settings     |

ドキュメントの配置方針は [ドキュメント配置ルール](development/documentation-rules.md) に従います。
