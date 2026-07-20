# Repository Structure

## ルート

| パス                  | 種別     | 用途                                                                    |
| --------------------- | -------- | ----------------------------------------------------------------------- |
| `.cline/`             | フォルダ | Cline向けのSalesforce skill routerを管理する。                          |
| `.clinerules/`        | フォルダ | Cline固有のリポジトリ指示を管理する。                                   |
| `.gemini/`            | フォルダ | Gemini CLIの設定を管理する。                                            |
| `.github/`            | フォルダ | GitHub Actions、Issue、PR、Dependabot、Releaseの設定を管理する。        |
| `.husky/`             | フォルダ | Git hookを管理する。                                                    |
| `.vscode/`            | フォルダ | VS Codeの推奨拡張機能、debug、workspace設定を管理する。                 |
| `config/`             | フォルダ | Scratch OrgとCode Analyzerの補助設定を管理する。                        |
| `docs/`               | フォルダ | セットアップ、開発ルール、組織操作、仕様、ナレッジを管理する。          |
| `export-out/`         | フォルダ | Salesforce CLIのexport結果をローカルに出力する。                        |
| `force-app/`          | フォルダ | Salesforce metadataとLWCテスト支援コードを管理する。                    |
| `logs/`               | フォルダ | Apex、Code Analyzer、Bulk APIのローカル出力先を管理する。               |
| `manifest/`           | フォルダ | metadataのretrieve、Scratch Org再現、削除scopeを管理する。              |
| `scripts/`            | フォルダ | 文書検証、metadata操作、Scratch Org、テストデータを支援する。           |
| `.clineignore`        | ファイル | Clineの自動contextからローカル状態、credential、生成物を除外する。      |
| `.forceignore`        | ファイル | Salesforce source操作で無視するファイルを定義する。                     |
| `.gitattributes`      | ファイル | Gitで共有するテキストファイルの改行コードを定義する。                   |
| `.gitignore`          | ファイル | Git管理から除外するローカル状態、生成物、秘密情報系ファイルを定義する。 |
| `.node-version`       | ファイル | ローカル開発とCIで使用するNode.jsのmajor versionを固定する。            |
| `.prettierignore`     | ファイル | Prettierの整形対象から生成物やretrieve後のmetadataを除外する。          |
| `.prettierrc`         | ファイル | Prettierの整形ルールとpluginを定義する。                                |
| `AGENTS.md`           | ファイル | AIエージェントが常に守るリポジトリ運用ルールを定義する。                |
| `CLAUDE.md`           | ファイル | Claude Codeに`AGENTS.md`と関連ルールを案内する。                        |
| `GEMINI.md`           | ファイル | Gemini CLIに`AGENTS.md`と関連ルールを案内する。                         |
| `README.md`           | ファイル | プロジェクト概要、セットアップ、主要コマンドへの入口を示す。            |
| `code-analyzer.yml`   | ファイル | Salesforce Code Analyzerのengineとruleを定義する。                      |
| `eslint.config.js`    | ファイル | Aura、LWC、Jest向けのESLint設定を定義する。                             |
| `jest-sa11y-setup.js` | ファイル | LWC Jestにアクセシビリティmatcherを登録する。                           |
| `jest.config.js`      | ファイル | LWC Jestのmock、coverage、setup fileを定義する。                        |
| `package-lock.json`   | ファイル | npm依存関係の解決結果を固定する。                                       |
| `package.json`        | ファイル | npm script、依存関係、lint-stagedを定義する。                           |
| `sfdx-project.json`   | ファイル | Salesforce DXのpackage directory、API version、login URLを定義する。    |

## AIエージェント・エディタ

| パス                                       | 種別     | 用途                                                                   |
| ------------------------------------------ | -------- | ---------------------------------------------------------------------- |
| `.cline/skills/`                           | フォルダ | Clineから利用するskill routerを格納する。                              |
| `.cline/skills/salesforce-skills/SKILL.md` | ファイル | 必要に応じてローカルの`.agents/skills/`を参照するようClineへ案内する。 |
| `.clinerules/repository.md`                | ファイル | Clineにリポジトリルールの参照順を示す。                                |
| `.gemini/settings.json`                    | ファイル | Gemini CLIが読み込むcontext fileを定義する。                           |
| `.husky/pre-commit`                        | ファイル | commit前に`npm run precommit`を実行する。                              |
| `.vscode/extensions.json`                  | ファイル | VS Codeの推奨拡張機能を定義する。                                      |
| `.vscode/launch.json`                      | ファイル | Apex Replay Debuggerなどのdebug設定を定義する。                        |
| `.vscode/settings.json`                    | ファイル | VS Codeのworkspace設定を定義する。                                     |

## GitHub

| パス                                        | 種別     | 用途                                                        |
| ------------------------------------------- | -------- | ----------------------------------------------------------- |
| `.github/ISSUE_TEMPLATE/`                   | フォルダ | IssueフォームとIssue作成画面の設定を格納する。              |
| `.github/ISSUE_TEMPLATE/01_improvement.yml` | ファイル | 改善Issueの入力項目と初期ラベルを定義する。                 |
| `.github/ISSUE_TEMPLATE/02_bug_report.yml`  | ファイル | 不具合Issueの入力項目と初期ラベルを定義する。               |
| `.github/ISSUE_TEMPLATE/config.yml`         | ファイル | Issueテンプレート全体の挙動を定義する。                     |
| `.github/workflows/`                        | フォルダ | GitHub Actions workflowを格納する。                         |
| `.github/workflows/ci.yml`                  | ファイル | PRと`main`へのpushで実行するCIを定義する。                  |
| `.github/copilot-instructions.md`           | ファイル | GitHub Copilotにリポジトリルールの参照順を示す。            |
| `.github/dependabot.yml`                    | ファイル | npm依存とGitHub Actionsの定期更新を定義する。               |
| `.github/pull_request_template.md`          | ファイル | PR本文のIssue、変更内容、確認結果、レビュー観点を定義する。 |
| `.github/release.yml`                       | ファイル | GitHub Releaseの自動生成カテゴリを定義する。                |

## config

| パス                                   | 種別     | 用途                                                       |
| -------------------------------------- | -------- | ---------------------------------------------------------- |
| `config/code-analyzer/`                | フォルダ | Code Analyzerの追加設定を格納する。                        |
| `config/code-analyzer/pmd-ruleset.xml` | ファイル | ApexDocとTrigger構造を検査するカスタムPMD ruleを定義する。 |
| `config/project-scratch-def.json`      | ファイル | Scratch Orgのedition、feature、settingを定義する。         |

## docs

| パス                   | 種別       | 用途                                                                          |
| ---------------------- | ---------- | ----------------------------------------------------------------------------- |
| `docs/deployment/`     | フォルダ   | Salesforce組織のvalidate、deploy、retrieve、削除、Scratch Org手順を管理する。 |
| `docs/development/`    | フォルダ   | 開発、GitHub、metadata、Apex、文書の運用ルールを管理する。                    |
| `docs/discussions/`    | フォルダ   | 設計や運用を決めるまでの比較と判断過程を管理する。                            |
| `docs/knowledge/`      | フォルダ   | Salesforce DX開発で再利用する解説と調査結果を管理する。                       |
| `docs/setup/`          | フォルダ   | 開発環境を初めて準備するときの手順を管理する。                                |
| `docs/specifications/` | フォルダ   | リポジトリ構成と独自開発機能の現行仕様を管理する。                            |
| `docs/_config.yml`     | ファイル   | GitHub PagesのJekyll設定を定義する。                                          |
| `docs/index.md`        | ファイル   | docs全体のカテゴリ索引を提供する。                                            |
| `docs/*/index.md`      | ファイル群 | 各docsカテゴリの索引を提供する。                                              |

## ローカル出力先

| パス                                           | 種別     | 用途                                      |
| ---------------------------------------------- | -------- | ----------------------------------------- |
| `export-out/export-out-guide.md`               | ファイル | `export-out/`の利用方法を示す。           |
| `logs/apex/`                                   | フォルダ | Apex debug logのローカル出力先。          |
| `logs/apex/apex-log-guide.md`                  | ファイル | Apex debug logの出力方法を示す。          |
| `logs/code-analyzer/`                          | フォルダ | Code Analyzer結果のローカル出力先。       |
| `logs/code-analyzer/code-analyzer-guide.md`    | ファイル | Code Analyzer結果の出力方法を示す。       |
| `logs/data-bulk-results/`                      | フォルダ | Bulk API 2.0 ingest結果のローカル出力先。 |
| `logs/data-bulk-results/bulk-results-guide.md` | ファイル | Bulk API結果の出力方法を示す。            |

## force-app

### パッケージ構成

| パス                      | 種別     | 用途                                             |
| ------------------------- | -------- | ------------------------------------------------ |
| `force-app/main/`         | フォルダ | Salesforceへ反映するsource packageを格納する。   |
| `force-app/main/default/` | フォルダ | metadata typeごとのSalesforce sourceを格納する。 |
| `force-app/test/`         | フォルダ | LWC Jestで共有するmockとtest utilityを格納する。 |

### main/defaultのmetadataフォルダ

| パス                                                       | 用途                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `force-app/main/default/apexEmailNotifications/`           | Apex例外メールの通知設定を管理する。                   |
| `force-app/main/default/appMenus/`                         | App Launcherとモバイルのアプリメニューを管理する。     |
| `force-app/main/default/applications/`                     | Lightningアプリと標準アプリの定義を管理する。          |
| `force-app/main/default/assignmentRules/`                  | LeadとCaseの割り当てルールを管理する。                 |
| `force-app/main/default/autoResponseRules/`                | LeadとCaseの自動返信ルールを管理する。                 |
| `force-app/main/default/classes/`                          | Apex classを管理する。                                 |
| `force-app/main/default/cleanDataServices/`                | データクレンジングサービスの設定を管理する。           |
| `force-app/main/default/communities/`                      | Experience CloudのCommunity設定を管理する。            |
| `force-app/main/default/duplicateRules/`                   | 重複ルールを管理する。                                 |
| `force-app/main/default/entitlementProcesses/`             | Entitlement Processを管理する。                        |
| `force-app/main/default/escalationRules/`                  | Caseのエスカレーションルールを管理する。               |
| `force-app/main/default/externalClientApps/`               | External Client Appの定義を管理する。                  |
| `force-app/main/default/extlClntAppGlobalOauthSets/`       | External Client Appのglobal OAuth設定を管理する。      |
| `force-app/main/default/extlClntAppOauthPolicies/`         | External Client AppのOAuth policyを管理する。          |
| `force-app/main/default/extlClntAppOauthSecuritySettings/` | External Client AppのOAuth security設定を管理する。    |
| `force-app/main/default/extlClntAppOauthSettings/`         | External Client AppのOAuth設定を管理する。             |
| `force-app/main/default/extlClntAppPolicies/`              | External Client Appのpolicyを管理する。                |
| `force-app/main/default/flexipages/`                       | Lightning Record Page、Home Page、App Pageを管理する。 |
| `force-app/main/default/flowDefinitions/`                  | Flowの有効version情報を管理する。                      |
| `force-app/main/default/flows/`                            | Flowの処理定義を管理する。                             |
| `force-app/main/default/homePageLayouts/`                  | Salesforce ClassicのHome Page Layoutを管理する。       |
| `force-app/main/default/iframeWhiteListUrlSettings/`       | iframeで許可するURL設定を管理する。                    |
| `force-app/main/default/layouts/`                          | ObjectのPage Layoutを管理する。                        |
| `force-app/main/default/lwc/`                              | Lightning Web Componentsを管理する。                   |
| `force-app/main/default/managedContentTypes/`              | Salesforce CMSのcontent typeを管理する。               |
| `force-app/main/default/matchingRules/`                    | 重複判定に使用するmatching ruleを管理する。            |
| `force-app/main/default/milestoneTypes/`                   | Entitlement Managementのmilestone typeを管理する。     |
| `force-app/main/default/notificationTypeConfig/`           | Salesforce通知typeの有効化設定を管理する。             |
| `force-app/main/default/objects/`                          | Object、Field、Record Typeなどのmetadataを管理する。   |
| `force-app/main/default/permissionsetgroups/`              | Permission Set Groupを管理する。                       |
| `force-app/main/default/permissionsets/`                   | Permission Setを管理する。                             |
| `force-app/main/default/profilePasswordPolicies/`          | Profileごとのpassword policyを管理する。               |
| `force-app/main/default/profileSessionSettings/`           | Profileごとのsession設定を管理する。                   |
| `force-app/main/default/profiles/`                         | Profileと権限設定を管理する。                          |
| `force-app/main/default/quickActions/`                     | Global ActionとObject Actionを管理する。               |
| `force-app/main/default/remoteSiteSettings/`               | Apex calloutで許可するRemote Siteを管理する。          |
| `force-app/main/default/reportTypes/`                      | Custom Report Typeを管理する。                         |
| `force-app/main/default/roles/`                            | Role hierarchyを管理する。                             |
| `force-app/main/default/samlssoconfigs/`                   | SAML Single Sign-On設定を管理する。                    |
| `force-app/main/default/settings/`                         | Salesforce組織機能の有効化設定を管理する。             |
| `force-app/main/default/sharingRules/`                     | Owner-basedとcriteria-basedのsharing ruleを管理する。  |
| `force-app/main/default/topicsForObjects/`                 | Objectで利用できるTopic設定を管理する。                |
| `force-app/main/default/transactionSecurityPolicies/`      | Transaction Security Policyを管理する。                |
| `force-app/main/default/translations/`                     | Custom Labelやmetadataの翻訳を管理する。               |
| `force-app/main/default/triggers/`                         | Apex Triggerを管理する。                               |
| `force-app/main/default/workflows/`                        | Workflow Rule、Field Updateなどを管理する。            |

### テスト支援

| パス                                                | 種別       | 用途                                                    |
| --------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `force-app/test/jest-mocks/`                        | フォルダ   | LWC Jestで共有するmodule mockを格納する。               |
| `force-app/test/jest-mocks/lightning/`              | フォルダ   | `lightning/*` moduleのmockを格納する。                  |
| `force-app/test/jest-mocks/lightning/*.js`          | ファイル群 | Lightning Data Service関連のJest mockを提供する。       |
| `force-app/test/jest-utils/`                        | フォルダ   | LWC Jestで共有するtest utilityを格納する。              |
| `force-app/test/jest-utils/objectRecordSearch/`     | フォルダ   | `objectRecordSearch`向けのmockとtest helperを格納する。 |
| `force-app/test/jest-utils/objectRecordSearch/*.js` | ファイル群 | Apex mockとtest helperを提供する。                      |

## manifest

| パス                               | 種別       | 用途                                                                             |
| ---------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| `manifest/destructiveChanges.xml`  | ファイル   | Salesforce組織から削除するmetadataを定義する。                                   |
| `manifest/package.xml`             | ファイル   | Apex、Aura、LWC、静的リソース、Flowを手動取得するscopeを定義する。               |
| `manifest/rebuild-scratch-org.xml` | ファイル   | Scratch Org作成後に初期反映するmetadataを定義する。                              |
| `manifest/retrieve-*.xml`          | ファイル群 | 取得対象metadata typeの全体catalogと、責務別に分割したretrieve scopeを定義する。 |

## scripts

| パス                                          | 種別       | 用途                                                                        |
| --------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `scripts/apex/`                               | フォルダ   | ローカルから実行するanonymous Apexを格納する。                              |
| `scripts/apex/test-data/`                     | フォルダ   | 合成テストデータの作成、削除、補正処理を格納する。                          |
| `scripts/apex/test-data/*.apex`               | ファイル群 | 標準Objectと対象機能の合成テストデータを操作する。                          |
| `scripts/docs/`                               | フォルダ   | Markdownと外部リンクの検証scriptを格納する。                                |
| `scripts/docs/check-docs.js`                  | ファイル   | Markdown構造、索引、内部リンクを検証する。                                  |
| `scripts/docs/check-external-links.js`        | ファイル   | Markdown内の外部リンクを検証する。                                          |
| `scripts/docs/markdown-files.js`              | ファイル   | 検証対象のMarkdownファイルを列挙する。                                      |
| `scripts/docs/test/`                          | フォルダ   | docs検証scriptのNode.js testを格納する。                                    |
| `scripts/docs/test/*.node.js`                 | ファイル群 | docs検証scriptの振る舞いを確認する。                                        |
| `scripts/metadata/`                           | フォルダ   | Salesforce metadata操作scriptを格納する。                                   |
| `scripts/metadata/destructive/`               | フォルダ   | metadata削除scriptを格納する。                                              |
| `scripts/metadata/destructive/destructive.sh` | ファイル   | destructive changesのdry-runと実削除を実行する。                            |
| `scripts/metadata/retrieve/`                  | フォルダ   | metadata retrieve scriptを格納する。                                        |
| `scripts/metadata/retrieve/retrieve.sh`       | ファイル   | 責務別manifestを順に使用してmetadataを取得する。                            |
| `scripts/scratch-org/`                        | フォルダ   | Scratch Orgの作成、初期化、削除処理を格納する。                             |
| `scripts/scratch-org/setup.js`                | ファイル   | Scratch Org作成からmetadata反映、権限、データ投入までを実行する。           |
| `scripts/scratch-org/delete.js`               | ファイル   | 設定されたScratch Orgを削除する。                                           |
| `scripts/scratch-org/scratch-org.json`        | ファイル   | Scratch Org scriptのalias、期間、manifest、Permission Set、waitを定義する。 |
| `scripts/scratch-org/internal-*.js`           | ファイル群 | Scratch Org処理の各手順と共通処理を実装する。                               |
| `scripts/scratch-org/test/`                   | フォルダ   | Scratch Org scriptのNode.js testを格納する。                                |
| `scripts/scratch-org/test/*.node.js`          | ファイル群 | Scratch Org scriptのcommand生成と実行制御を確認する。                       |
| `scripts/setup/`                              | フォルダ   | テストデータ投入のplanと実行scriptを格納する。                              |
| `scripts/setup/import-plan.json`              | ファイル   | anonymous Apexの実行順序と反復回数を定義する。                              |
| `scripts/setup/import-test-data.js`           | ファイル   | import planに従って合成テストデータを投入する。                             |
| `scripts/soql/`                               | フォルダ   | 調査とテストデータ確認に使用するSOQLを格納する。                            |
| `scripts/soql/object-queries/`                | フォルダ   | Object別の調査用SOQLを格納する。                                            |
| `scripts/soql/object-queries/**/*.soql`       | ファイル群 | Account、Case、Opportunityの調査queryを提供する。                           |
| `scripts/soql/test-data-check-queries/`       | フォルダ   | 合成テストデータの確認用SOQLを格納する。                                    |
| `scripts/soql/test-data-check-queries/*.soql` | ファイル群 | Objectごとの投入結果を確認する。                                            |
| `scripts/scripts-guide.md`                    | ファイル   | scripts配下の用途と実行方法を案内する。                                     |
