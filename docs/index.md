# ドキュメント

このディレクトリには、Salesforce DX 開発に関するこのプロジェクト固有のメモを置きます。

## 構成

- `setup/`: ローカルツール、組織ログイン、環境セットアップ。
- `development/`: Apex やメタデータ変更時の実務チェック。
- `deployment/`: デプロイ、取得、削除変更、新規組織への再現に関するメモ。
- `discussions/`: 設計案、課題、見直し内容など、判断過程を整理したメモ。
- `knowledge/`: Salesforce Platform の概念を学ぶためのメモ。

## セットアップ

- [ローカル開発環境](setup/local-development.md)
- [Salesforce 公式 skills](setup/sf-skills.md)

## 開発

- [ドキュメント配置ルール](development/documentation-rules.md)
- [GitHub 運用ルール](development/github-rules.md)
- [開発チェックリスト](development/checklist.md)
- [Apex 開発ルール](development/apex-rules.md)
- [設定ファイル管理](development/configuration-files.md)
- [.gitignore 運用メモ](development/gitignore-rules.md)
- [npm audit 確認メモ](development/npm-audit-review.md)

## ナレッジ

- [エージェントルールと GitHub Actions の使い分け](knowledge/agent-rules-or-github-actions.md)
- [GitHub Projects と Milestones](knowledge/github-projects-and-milestones.md)
- [GitHub Issue テンプレート設定](knowledge/github-issue-template-config.md)
- [npm と pre-commit hook](knowledge/npm-and-precommit.md)
- [Salesforce 公式参考リンク](knowledge/salesforce-official-references.md)

## ディスカッション

- [Apex Trigger クラス構成](discussions/2026-06-19-apex-trigger-class-structure.md)
- [ESLint 10 と Salesforce / LWC ESLint パッケージの互換性](discussions/2026-06-20-eslint-10-salesforce-lwc-compatibility.md)

ドキュメントの配置方針は [ドキュメント配置ルール](development/documentation-rules.md) に従います。
