# Salesforce Platform Playground

## ドキュメント

Salesforce DX 開発に関するこのプロジェクト固有のメモを置きます。

## 構成

- `setup/`: ローカルツール、組織ログイン、環境セットアップ。
- `development/`: Apex やメタデータ変更時の実務チェック。
- `deployment/`: デプロイ、取得、削除変更、新規組織への再現に関するメモ。
- `discussions/`: 設計案、課題、見直し内容など、判断過程を整理したメモ。
- `knowledge/`: Salesforce Platform の概念を学ぶためのメモ。

## セットアップ

- [ローカル開発環境](setup/local-development.md)
- [Salesforce 公式 skills](setup/sf-skills.md)

## 主要ドキュメント

- [変更チェックリスト](development/change-checklist.md)
- [Apex 開発ルール](development/apex-rules.md)
- [メタデータ開発ルール](development/metadata-rules.md)
- [force-app deployability 棚卸し](development/force-app-deployability-inventory.md)
- [GitHub 運用ルール](development/github-rules.md)

## 開発運用

- [ドキュメント配置ルール](development/documentation-rules.md)
- [設定ファイル管理](development/configuration-files.md)
- [npm と pre-commit hook](development/npm-and-precommit.md)
- [CI で Prettier を確認する意味](development/prettier-check-in-ci.md)
- [Salesforce CLI テストデータインポート](development/test-data-import.md)
- [Salesforce CLI で主要標準オブジェクトの seed を作る考え方](development/salesforce-cli-standard-object-seed.md)
- [Settings 有効化状況](development/settings-enable-candidates.md)
- [.gitignore 運用メモ](development/gitignore-rules.md)
- [LWC Jest とアクセシビリティテスト](development/lwc-jest-accessibility-testing.md)
- [Salesforce Code Analyzer](development/salesforce-code-analyzer.md)
- [Salesforce API version の上げ方](development/salesforce-api-version-upgrade.md)
- [Salesforce メタデータの Git 管理候補](development/salesforce-metadata-git-management-candidates.md)
- [package.xml のメタデータ一覧](development/salesforce-package-xml-metadata-types.md)
- [package.xml retrieve の分析ポイント](development/salesforce-package-xml-retrieve-analysis.md)

## デプロイ

- [Dev 組織デプロイ](deployment/dev-org-deploy.md)
- [メタデータ取得ルール](deployment/retrieve-rules.md)
- [削除変更ルール](deployment/destructive-changes.md)
- [Scratch Org 再現](deployment/scratch-org-rebuild.md)
- [Scratch Org と manifest の使い分け](deployment/salesforce-scratch-org-manifest-workflow.md)
- [Scratch Org definition の feature 設定](deployment/salesforce-scratch-org-definition-features.md)

## 調査記録

- [npm audit 確認メモ](development/npm-audit-review.md)

## ナレッジ

- [エージェントルールと GitHub Actions の使い分け](knowledge/agent-rules-or-github-actions.md)
- [GitHub Projects と Milestones](knowledge/github-projects-and-milestones.md)
- [GitHub Issue テンプレート設定](knowledge/github-issue-template-config.md)
- [GitHub Release notes 設定](knowledge/github-release-notes-config.md)
- [ESLint の unmatched glob](knowledge/eslint-unmatched-globs.md)
- [LWC の画面遷移](knowledge/lwc-navigation.md)
- [Apex アノテーション](knowledge/apex-annotations.md)
- [Sales / Service で使う主要な標準オブジェクト](knowledge/sales-and-service-standard-objects.md)
- [Salesforce 製品別の標準オブジェクト](knowledge/salesforce-standard-objects/index.md)
- [Salesforce 公式参考リンク](knowledge/salesforce-official-references.md)

## 検討記録

- [Apex Trigger クラス構成](discussions/2026-06-19-apex-trigger-class-structure.md)
- [ESLint 10 と Salesforce / LWC ESLint パッケージの互換性](discussions/2026-06-20-eslint-10-salesforce-lwc-compatibility.md)
- [DreamHouse 設定差分の扱い](discussions/2026-06-20-dreamhouse-configuration-diff-policy.md)
- [Apex テストデータ作成クラスの命名](discussions/2026-06-22-test-fixture-factory-naming.md)

ドキュメントの配置方針は [ドキュメント配置ルール](development/documentation-rules.md) に従います。
