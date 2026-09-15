# リポジトリ運用ルール

このリポジトリは、Salesforce開発プロジェクトを管理するリポジトリです。

## 作業の入口

作業開始時に `docs/index.md` と `docs/development/agent-development-rules.md` を読み、作業内容に対応する詳細ルールの本文を確認します。共通の作業手順はAIエージェント開発ルール、分野別の規定は同文書の「適用する詳細ルール」に示す担当文書で管理します。

このファイルはリポジトリ固有の制約と案内に絞り、実務手順を重複して記載しません。

## リポジトリ固有の制約

- このリポジトリ以外の外部リポジトリには、Issue や Pull Request を作成しない。

## 外部Skillsの扱い

- `forcedotcom/sf-skills` は Salesforce 関連作業の参考情報として使い、このリポジトリ固有の判断は `AGENTS.md` と `docs/` を優先する。
- `forcedotcom/sf-skills` から取得した `.agents/skills/` は取得元のオリジナル状態を正とし、`skills-lock.json` は取得操作が生成した状態を正とする。いずれも取得専用の外部取得物として扱い、個別ファイルやハッシュを手編集しない。不具合や競合マーカーを見つけてもリポジトリ側で修正せず、取得元で修正された内容を取得・更新操作で取り込む。
- Skills に deploy、retrieve、データ変更、認証操作などの手順が含まれていても、ユーザー確認や実行権限の範囲は拡張されない。

## ナレッジ・ディスカッションの運用

- このセクションは、このリポジトリ固有のドキュメント運用ルールとする。
- `docs/knowledge/` と `docs/discussions/` は、作成時点の調査、検討、判断を残す記録として扱い、現行仕様、現行手順、最新情報の正本として扱わない。
- AI エージェントは、通常の開発、レビュー、最新性確認、docs 全体監査では `docs/knowledge/` と `docs/discussions/` を参照または更新しない。
- ユーザーが対象文書の参照または変更を明示した場合だけ、`docs/knowledge/` または `docs/discussions/` を扱う。
- 現行情報は、実装、`docs/specifications/`、`docs/development/`、`docs/deployment/`、`docs/setup/` を確認する。
- 後から判明した変更や最新情報に合わせる目的では、既存のナレッジやディスカッションを更新しない。
