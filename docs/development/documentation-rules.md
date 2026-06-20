# ドキュメント配置ルール

このプロジェクトのドキュメントは、読む頻度と役割に応じて配置します。

## 基本方針

- `AGENTS.md` は、Codex などのエージェントが常に守る短い共通ルールだけを書く。
- `CLAUDE.md`、`GEMINI.md`、`.github/copilot-instructions.md` は各ツール向けの入口にとどめ、共通ルールは `AGENTS.md` に集約する。
- 詳しい手順、判断基準、背景説明は `docs/` 配下に分ける。
- README は入口として簡潔に保ち、詳細は `docs/` へリンクする。
- 同じ内容を複数箇所に長く重複させない。

## 配置

| 場所                              | 用途                                                     |
| --------------------------------- | -------------------------------------------------------- |
| `AGENTS.md`                       | エージェントが常に守る短い共通ルール                     |
| `CLAUDE.md`                       | Claude Code 向けの入口                                   |
| `GEMINI.md`                       | Gemini CLI 向けの入口                                    |
| `.github/copilot-instructions.md` | GitHub Copilot 向けの入口                                |
| `README.md`                       | プロジェクト概要、主要な入口、セットアップの最短導線     |
| `docs/setup/`                     | ローカル環境、ツール導入、組織ログイン、初期セットアップ |
| `docs/development/`               | 開発ルール、実務チェックリスト、設定台帳、確認メモ       |
| `docs/deployment/`                | デプロイ、取得、削除変更、組織再現に関する手順           |
| `docs/discussions/`               | 設計案、課題、見直し内容など、判断過程を整理したメモ     |
| `docs/knowledge/`                 | 他プロジェクトでも使える汎用的な学習メモ                 |

## Discussions の扱い

`docs/discussions/` には、決定済みルールとして固定する前の設計案や判断過程を置きます。

良い例:

- 最初の設計案と、その課題
- 見直した構成案
- 今後の開発で再検討する判断基準

避ける例:

- エージェントとの会話ログそのもの
- 実務で必ず守るルール
- Salesforce や GitHub の一般的な概念説明

決定済みの実務ルールになった内容は `docs/development/` に移すか、要点だけをリンクします。

## Knowledge の扱い

`docs/knowledge/` には、特定リポジトリ固有の運用判断を置きません。

良い例:

- GitHub Issue テンプレート設定の意味
- npm と pre-commit hook の一般的な関係
- Salesforce DX の概念メモ

避ける例:

- このリポジトリだけのブランチ運用判断
- 特定 Dev 組織の設定値
- 今回の Issue だけの作業方針

リポジトリ固有の実務ルール、チェックリスト、設定台帳、確認メモは `docs/development/`、セットアップ手順は `docs/setup/`、デプロイ判断は `docs/deployment/` に置きます。
