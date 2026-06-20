# 設定ファイル管理

このページは、このリポジトリで管理している設定ファイルの一覧と役割をまとめます。

秘密情報を含み得る `.env`、`.env.*`、認証ファイル、token、password、client secret、証明書、秘密鍵は管理対象の一覧に含めません。

## Salesforce / DX

| ファイル                          | 概要                                                                                                                                     | 変更時の確認                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `sfdx-project.json`               | Salesforce DX の package directory、プロジェクト名、ログイン URL、API version を定義する。`force-app` を正本の source directory とする。 | API version や package directory を変える場合は、metadata の deploy / retrieve への影響を確認する。 |
| `config/project-scratch-def.json` | Scratch org 作成時の edition、features、settings を定義する。Dev 組織への deploy 先設定ではない。                                        | 組織機能や設定を変える場合は、新規 Scratch org の再現性と既存 Dev 組織との差分を確認する。          |
| `.forceignore`                    | Salesforce source push / pull / status などで無視するファイルを定義する。                                                                | metadata として送るべきファイルを除外していないか確認する。                                         |

## npm / 品質チェック

| ファイル            | 概要                                                                                                    | 変更時の確認                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `package.json`      | npm scripts、devDependencies、overrides、lint-staged の設定を管理する。                                 | 依存や scripts を変えた場合は `package-lock.json` との整合性を確認する。    |
| `package-lock.json` | npm 依存の解決結果を固定する。                                                                          | 手編集しない。`package.json` 変更後に npm で更新された差分を確認する。      |
| `eslint.config.js`  | Aura、LWC、LWC test、Jest mocks 向けの ESLint flat config を定義する。                                  | Salesforce / LWC ESLint パッケージの peer dependency と対象パスを確認する。 |
| `code-analyzer.yml` | Salesforce Code Analyzer の engine 設定を管理する。ESLint engine は repo の `eslint.config.js` を使う。 | Code Analyzer と ESLint の設定が重複適用されないか確認する。                |
| `jest.config.js`    | `@salesforce/sfdx-lwc-jest` の標準設定を拡張し、local dev server のパスを除外する。                     | LWC test の探索対象や除外対象が変わらないか確認する。                       |
| `.prettierrc`       | Apex、XML、LWC HTML などの Prettier 整形ルールを定義する。Apex / LWC / Aura は 4 spaces を前提にする。  | 整形対象が広いため、変更後は差分が意図せず広がらないか確認する。            |
| `.prettierignore`   | Prettier の対象外にする生成物、接続情報、local tool ディレクトリを定義する。                            | 整形対象に含めるべき source を除外していないか確認する。                    |
| `.husky/pre-commit` | commit 前に `npm run precommit` を実行する。                                                            | hook を変えた場合は staged files に対する挙動を確認する。                   |

## Git / エディタ

| ファイル                  | 概要                                                                                                      | 変更時の確認                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `.gitignore`              | Git 管理対象外にする Salesforce cache、依存、coverage、OS / editor 生成物、秘密情報系ファイルを定義する。 | source、metadata、docs、GitHub 設定を誤って除外していないか確認する。 |
| `.vscode/extensions.json` | このリポジトリで推奨する VS Code 拡張機能を定義する。                                                     | 個人環境専用の拡張や設定を固定しない。                                |

## GitHub

| ファイル                                    | 概要                                                                                                            | 変更時の確認                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `.github/copilot-instructions.md`           | GitHub Copilot 向けに、このリポジトリの共通ルール入口を示す。                                                   | 共通ルールを重複させず、`AGENTS.md` と `docs/` を正とする導線が残っているか確認する。   |
| `.github/workflows/ci.yml`                  | pull request と `main` push で npm install、audit、format check、lint、LWC unit test を実行する CI を定義する。 | GitHub Actions は品質確認に寄せ、Issue / Project などの運用 metadata 自動化を混ぜない。 |
| `.github/dependabot.yml`                    | npm 依存の weekly update、ラベル、commit message、grouping を定義する。                                         | 特定の個人ユーザー名を assignee や reviewer として固定しない。                          |
| `.github/release.yml`                       | GitHub Release の自動生成 changelog category をラベルごとに定義する。                                           | ラベル体系を変えた場合は category も合わせて見直す。                                    |
| `.github/ISSUE_TEMPLATE/config.yml`         | Issue template 全体の挙動を定義する。                                                                           | blank issue を許可するかどうかを運用方針に合わせる。                                    |
| `.github/ISSUE_TEMPLATE/01_improvement.yml` | 機能・改善 Issue のフォームを定義する。                                                                         | 必須項目、初期ラベル、秘密情報への注意書きを確認する。                                  |
| `.github/ISSUE_TEMPLATE/02_bug_report.yml`  | 不具合報告 Issue のフォームを定義する。                                                                         | 再現手順、期待動作、ログ記載時の秘密情報除外を確認する。                                |
| `.github/pull_request_template.md`          | PR 作成時の Issue、変更内容、確認結果、レビュー観点の記入欄を定義する。                                         | Issue 連携、検証結果、Salesforce 組織操作の記録欄が残っているか確認する。               |

## Agent

| ファイル    | 概要                                                         | 変更時の確認                                                                                |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `AGENTS.md` | Codex などのエージェントが常に守る短い共通ルールを定義する。 | 詳細手順を詰め込みすぎず、実務手順は `docs/development/` または `docs/deployment/` に置く。 |
| `CLAUDE.md` | Claude Code 向けに、このリポジトリの共通ルール入口を示す。   | 共通ルールを重複させず、`AGENTS.md` と `docs/` を正とする導線が残っているか確認する。       |
| `GEMINI.md` | Gemini CLI 向けに、このリポジトリの共通ルール入口を示す。    | 共通ルールを重複させず、`AGENTS.md` と `docs/` を正とする導線が残っているか確認する。       |

## 更新ルール

- 設定ファイルを追加、削除、または役割変更した場合は、このページも更新する。
- セットアップ手順そのものは `docs/setup/`、GitHub 運用ルールは `docs/development/github-rules.md` に置く。
- このページには実値の秘密情報、個人環境の値、接続済み組織の認証情報を書かない。
- メタデータの deploy や Apex test が必要な設定変更では、実行したコマンドと対象組織を作業報告に残す。
