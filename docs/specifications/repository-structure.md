# Repository Structure

このページは、個別機能の仕様ではなく、リポジトリ全体の構成を理解するための入口です。主要ディレクトリと設定ファイルの場所、役割、編集時の注意点を一覧にし、詳しい手順やルールは関連ドキュメントへ案内します。

秘密情報を含み得る `.env`、`.env.*`、認証ファイル、token、password、client secret、証明書、秘密鍵は管理対象の一覧に含めません。

## 読み方

- リポジトリ全体の構成や、設定ファイルの場所と変更時の確認事項を探す場合は、このページを使う。
- 設定値や挙動を確認する場合は、次の詳細ページを使う。
- セットアップ手順や運用ルールは、`docs/setup/`、`docs/development/`、`docs/deployment/` の該当ページを使う。

## 主要ディレクトリ

| ディレクトリパス | 用途                                                                              | 主な内容                                                                                  | 編集時の注意点                                                                                                       | 関連ドキュメント                                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `force-app/`     | Salesforce source と、その単体テスト支援コードを管理する。                        | `main/default/` の metadata、`test/` の Jest mock と test utility。                       | 組織反映は変更差分と明示した依存 metadata に限定し、`force-app/` 全体を通常開発の deploy scope にしない。            | [メタデータ管理ルール](../development/metadata-rules.md)、[force-app の deploy 対象棚卸し](../knowledge/force-app-deployability-inventory.md)                                                                |
| `manifest/`      | metadata の retrieve、Scratch Org 再現、削除対象の scope を定義する。             | `package.xml`、用途別 retrieve manifest、Scratch Org 再現 manifest、destructive changes。 | manifest ごとの目的と対象 org を確認し、広い retrieve や組織再構築用 scope を通常開発の deploy に流用しない。        | [メタデータ管理ルール](../development/metadata-rules.md)、[Scratch Org manifest 運用ルール](../deployment/scratch-org-manifest-rules.md)                                                                     |
| `scripts/`       | ローカル開発、文書検証、metadata 操作、Scratch Org、テストデータを支援する。      | JavaScript、shell script、anonymous Apex、SOQL、JSON plan。                               | 個人環境の値や秘密情報を固定せず、組織操作を伴う場合は対象 org と実行 scope を確認する。                             | [スクリプトガイド](../../scripts/scripts-guide.md)、[ローカル開発コマンド](../knowledge/local-development-commands.md)、[テストデータ投入手順](../deployment/test-data-import.md)                            |
| `docs/`          | GitHub Pages で公開する、セットアップ、運用、組織操作、仕様、ナレッジを管理する。 | カテゴリ別 Markdown、各カテゴリの `index.md`、Jekyll 設定。                               | 文書の責任に合うカテゴリへ配置し、追加、移動、削除時は索引と相対リンクを更新する。                                   | [ドキュメント配置ルール](../development/documentation-rules.md)、[ドキュメント索引](../index.md)                                                                                                             |
| `config/`        | Salesforce CLI と品質チェックが参照する補助設定を管理する。                       | Scratch Org definition、Code Analyzer のカスタム PMD ruleset。                            | Scratch Org 作成設定と接続組織への deploy 設定を混同せず、品質基準を変更する場合は関連設定と検証コマンドを確認する。 | [Salesforce DX 設定ファイル](../knowledge/salesforce-dx-config-files.md)、[品質チェック設定ファイル](../knowledge/quality-config-files.md)                                                                   |
| `.github/`       | GitHub 上の Issue、PR、CI、依存更新、Release の設定を管理する。                   | GitHub Actions、Dependabot、Issue／PRテンプレート、Release 設定、Copilot 指示。           | GitHub の現在設定と固有運用を確認し、CI の権限を必要最小限に保ち、個人ユーザー名や秘密情報を固定しない。             | [GitHub 運用ルール](../development/github-rules.md)、[リポジトリ固有 GitHub 運用ルール](../development/github-repository-rules.md)、[GitHub 設定ファイル](../knowledge/github-config-files.md)               |
| `export-out/`    | Salesforce CLI の export 結果をローカルに保存する。                               | 出力先の利用方法を示す guide。                                                            | export 結果の CSV、JSON、実データを Git 管理対象にしない。                                                           | [export-out ガイド](../../export-out/export-out-guide.md)                                                                                                                                                    |
| `logs/`          | Apex、Code Analyzer、Bulk API のローカル実行結果を用途別に保存する。              | 出力先ごとの guide。                                                                      | debug log、解析結果、Bulk API 結果などの生成物や組織固有情報を Git 管理対象にしない。                                | [Apex log ガイド](../../logs/apex/apex-log-guide.md)、[Code Analyzer log ガイド](../../logs/code-analyzer/code-analyzer-guide.md)、[Bulk API 結果ガイド](../../logs/data-bulk-results/bulk-results-guide.md) |

## 主要な設定ファイル

### 詳細ページ

| ページ                                                                   | 内容                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| [package.json](../knowledge/package-json.md)                             | npm scripts、依存、フック設定の読み方。                 |
| [Salesforce DX 設定ファイル](../knowledge/salesforce-dx-config-files.md) | `sfdx-project.json`、Scratch Org 設定、`.forceignore`。 |
| [品質チェック設定ファイル](../knowledge/quality-config-files.md)         | ESLint、Jest、Prettier、Code Analyzer、pre-commit。     |
| [GitHub設定ファイル](../knowledge/github-config-files.md)                | CI、Dependabot、リリース、Issue／PRテンプレート。       |

### Salesforce / DX

| ファイル                               | 概要                                                                                                                                     | 変更時の確認                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `sfdx-project.json`                    | Salesforce DX の package directory、プロジェクト名、ログイン URL、API version を定義する。`force-app` を source directory の基準にする。 | API version や package directory を変える場合は、metadata の deploy / retrieve への影響を確認する。 |
| `config/project-scratch-def.json`      | Scratch org 作成時の edition、features、settings を定義する。Salesforce 組織への deploy 先設定ではない。                                 | 組織機能や設定を変える場合は、新規 Scratch org の再現性と既存 Salesforce 組織との差分を確認する。   |
| `scripts/scratch-org/scratch-org.json` | Scratch Org 準備・削除スクリプトで使う alias、duration、manifest、Permission Set、import plan、wait を定義する。                         | 個人専用 alias や秘密情報を入れず、Scratch Org 手順と一致しているか確認する。                       |
| `manifest/rebuild-scratch-org.xml`     | Scratch Org 作成後の初期反映 scope を定義する。                                                                                          | Scratch Org の再現手順と `config/project-scratch-def.json` への影響を確認する。                     |
| `manifest/destructiveChanges.xml`      | Salesforce 組織や Scratch Org から削除する metadata を Salesforce 標準の destructive changes 形式で定義する。                            | 実行前に対象 org、削除 scope、復旧方針を確認する。                                                  |
| `manifest/package*.xml`                | metadata retrieve / 分類 / 作業単位の補助 manifest を管理する。                                                                          | 一時作業用 manifest を恒久的な設定として残していないか確認する。                                    |
| `.forceignore`                         | Salesforce source push / pull / status などで無視するファイルを定義する。                                                                | metadata として送るべきファイルを除外していないか確認する。                                         |
| `scripts/setup/import-plan.json`       | 標準テストデータ用anonymous Apexの実行順序と反復回数を定義する、このリポジトリ独自のplan。                                               | 実データや個人情報を入れず、シード／クリーンアップ用Apexと整合させる。                              |

### npm / 品質チェック

| ファイル                               | 概要                                                                                                                                    | 変更時の確認                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `package.json`                         | npm scripts、devDependencies、overrides、lint-staged の設定を管理する。詳細は [package.json](../knowledge/package-json.md) を参照する。 | 依存や scripts を変えた場合は `package-lock.json` との整合性を確認する。                                 |
| `package-lock.json`                    | npm 依存の解決結果を固定する。                                                                                                          | 手編集しない。`package.json` 変更後に npm で更新された差分を確認する。                                   |
| `.node-version`                        | ローカル実行、CI、docs で前提にする Node.js major version を固定する。                                                                  | `package.json` の `engines.node`、CI の Node version、setup docs と一致しているか確認する。              |
| `eslint.config.js`                     | Aura、LWC、LWC test、Jest mocks 向けの ESLint flat config を定義する。                                                                  | Salesforce / LWC ESLint パッケージの peer dependency と対象パスを確認する。                              |
| `code-analyzer.yml`                    | Salesforce Code Analyzer の engine、rule tag、severity を管理する。ESLint engine は repo の `eslint.config.js` を使う。                 | Code Analyzer と ESLint の設定が重複適用されず、カスタムPMDルールが`Recommended`で選択されるか確認する。 |
| `config/code-analyzer/pmd-ruleset.xml` | ApexDocとTrigger構造をリポジトリ規約に合わせて検査するカスタムPMDルールを定義する。                                                     | 標準ルールとの置換理由、XPath、priorityが`code-analyzer.yml`と整合しているか確認する。                   |
| `jest.config.js`                       | `@salesforce/sfdx-lwc-jest` の標準設定を拡張し、local dev server のパス除外と LWC coverage 対象を定義する。                             | LWC test / coverage の探索対象や除外対象が変わらないか確認する。                                         |
| `jest-sa11y-setup.js`                  | LWC Jest で `@sa11y/jest` の `toBeAccessible()` matcher を登録する。                                                                    | automatic checks を有効化していないか、setup file が Jest config から読まれるか確認する。                |
| `.prettierrc`                          | Apex、XML、LWC HTML などの Prettier 整形ルールを定義する。Apex / LWC / Aura は 4 spaces を前提にする。                                  | 整形対象が広いため、変更後は差分が意図せず広がらないか確認する。                                         |
| `.prettierignore`                      | Prettier の対象外にする生成物、接続情報、local tool ディレクトリを定義する。                                                            | 整形対象に含めるべき source を除外していないか確認する。                                                 |
| `.husky/pre-commit`                    | コミット前に`npm run precommit`を実行する。                                                                                             | フックを変えた場合はステージ済みファイルに対する挙動を確認する。                                         |

### ローカル出力先

| ファイル                                       | 概要                                                                                                    | 変更時の確認                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `export-out/export-out-guide.md`               | Salesforce CLI の export 結果の出力先として `export-out/` を固定する。                                  | CSV / JSON などの export 結果を Git 管理対象にしていないか確認する。     |
| `logs/apex/apex-log-guide.md`                  | Salesforce CLI で取得した Apex debug log の出力先として `logs/apex/` を固定する。                       | Apex debug log の実ファイルを Git 管理対象にしていないか確認する。       |
| `logs/code-analyzer/code-analyzer-guide.md`    | Salesforce Code Analyzer のローカル解析結果の出力先として `logs/code-analyzer/` を固定する。            | `package.json` の Code Analyzer 出力先と `.gitignore` の例外を確認する。 |
| `logs/data-bulk-results/bulk-results-guide.md` | Salesforce CLI で取得した Bulk API 2.0 ingest 結果の出力先として `logs/data-bulk-results/` を固定する。 | Bulk 結果 CSV や実行ログを Git 管理対象にしていないか確認する。          |

### Git / エディタ

| ファイル                  | 概要                                                                                                      | 変更時の確認                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `.gitignore`              | Git 管理対象外にする Salesforce cache、依存、coverage、OS / editor 生成物、秘密情報系ファイルを定義する。 | source、metadata、docs、GitHub 設定を誤って除外していないか確認する。 |
| `.vscode/extensions.json` | このリポジトリで推奨する VS Code 拡張機能を定義する。                                                     | 個人環境専用の拡張や設定を固定しない。                                |
| `.vscode/launch.json`     | Apex Replay Debugger など、このリポジトリで共有する VS Code debug configuration を定義する。              | 個人環境専用のパスやログファイル名を固定しない。                      |
| `.vscode/settings.json`   | このリポジトリで共有する VS Code workspace settings を定義する。                                          | 個人環境専用の設定や秘密情報を含めない。                              |

### GitHub

| ファイル                                    | 概要                                                                                                                       | 変更時の確認                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `docs/_config.yml`                          | GitHub Pages で公開する docs site の Jekyll title、description、theme、URL、baseurl を定義する。                           | GitHub Pages の公開元と repository name / owner の変更に追従しているか確認する。                                                |
| `.github/copilot-instructions.md`           | GitHub Copilot 向けに、このリポジトリの共通ルール指示を示す。                                                              | 共通ルールを重複させず、`AGENTS.md` と `docs/` を優先する案内が残っているか確認する。                                           |
| `.github/workflows/ci.yml`                  | PRと`main`へのプッシュでnpm audit、整形、文書、lint、Salesforce Code Analyzer、スクリプトテスト、LWC単体テストを確認する。 | CIからSalesforce組織へログインせず、metadataのvalidate / deployを実行しない。                                                   |
| `.github/dependabot.yml`                    | npm依存とGitHub Actionsの週次更新、ラベル、コミットメッセージ、グループ化を定義する。                                      | 特定の個人ユーザー名を担当者やレビュー担当者として固定せず、`docs/development/github-repository-rules.md`の固有運用と合わせる。 |
| `.github/release.yml`                       | GitHub Releaseの自動生成リリースノートカテゴリをラベルごとに定義する。                                                     | ラベル体系や日次リリースノート運用を変えた場合はカテゴリも合わせて見直す。                                                      |
| `.github/ISSUE_TEMPLATE/config.yml`         | Issueテンプレート全体の挙動を定義する。                                                                                    | テンプレートなしのIssueを許可するかどうかを運用方針に合わせる。                                                                 |
| `.github/ISSUE_TEMPLATE/01_improvement.yml` | 機能・改善 Issue のフォームを定義する。                                                                                    | 必須項目、初期ラベル、秘密情報への注意書きを確認する。                                                                          |
| `.github/ISSUE_TEMPLATE/02_bug_report.yml`  | 不具合報告 Issue のフォームを定義する。                                                                                    | 再現手順、期待動作、ログ記載時の秘密情報除外を確認する。                                                                        |
| `.github/pull_request_template.md`          | PR 作成時の Issue、変更内容、確認結果、レビュー観点の記入欄を定義する。                                                    | Issue 連携、検証結果、Salesforce 組織操作の記録欄が残っているか確認する。                                                       |

### Agent

| ファイル                    | 概要                                                                                              | 変更時の確認                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                 | Codex などのエージェントが常に守る短い共通ルールを定義する。                                      | 詳細手順を詰め込みすぎず、実務手順はルール文書側で管理する。                                                                |
| `CLAUDE.md`                 | Claude Code 向けに、このリポジトリの共通ルール指示を示す。                                        | 共通ルールを重複させず、`AGENTS.md` と `docs/` を優先する案内が残っているか確認する。                                       |
| `GEMINI.md`                 | Gemini CLI 向けに、このリポジトリの共通ルール指示を示す。                                         | 共通ルールを重複させず、`AGENTS.md` と `docs/` を優先する案内が残っているか確認する。                                       |
| `.gemini/settings.json`     | Gemini CLI が読み込む context file を定義する。                                                   | `GEMINI.md` と `AGENTS.md` を context file として読み込む設定が残っているか確認する。                                       |
| `.cline/skills/`            | Cline 向けに `.agents/skills/` への skill router を置く。                                         | router に共通ルールを重複させず、参照先の `.agents/skills/` と `AGENTS.md` / `docs/` の優先関係が明記されているか確認する。 |
| `.clineignore`              | Cline の自動 context / search から外すローカル生成物、接続情報、credential 系ファイルを定義する。 | source、docs、設定ファイル、テスト、skill 関連ファイルなど作業に必要な文脈を誤って除外していないか確認する。                |
| `.clinerules/repository.md` | Cline 向けに、このリポジトリの共通ルール指示を示す。                                              | 共通ルールを重複させず、`AGENTS.md` と `docs/` を優先する案内が残っているか確認する。                                       |

`.clineignore` は Git 管理対象外を決める `.gitignore` とは役割が異なります。
Cline の自動 context / search に入れると危険またはノイズになりやすいローカル状態、credential、生成物を外すために使い、Salesforce metadata、source、docs、tests、manifest は原則として AI が確認できる状態にします。

## 更新ルール

- 主要ディレクトリまたは設定ファイルを追加、削除、役割変更した場合は、このページも更新する。
- セットアップ手順そのものや GitHub 運用ルールは、このページではなく該当するルール文書側で管理する。
- このページには実値の秘密情報、個人環境の値、接続済み組織の認証情報を書かない。
- メタデータの deploy や Apex test が必要な設定変更では、実行したコマンドと対象組織を作業報告に残す。
