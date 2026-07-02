# Repository Rules

このファイルは Cline 向けの入口です。

- 作業前に `AGENTS.md` を読み、そこに書かれたリポジトリ運用ルールを優先する。
- 詳細な実務手順は `docs/development/` と `docs/deployment/` の関連ページを確認する。
- `AGENTS.md` または `docs/` とこのファイルの内容がずれる場合は、`AGENTS.md` と `docs/` を正とする。
- このファイルには Cline 固有の入口だけを書き、リポジトリ共通ルールは重複させない。
- 自動 context では `.clineignore` を尊重する。ユーザーの明示依頼があり、かつリポジトリルール上許可される場合を除き、除外対象のローカル状態、生成物、credential、環境ファイルを意図的に読まない。
- Salesforce 関連作業では、必要に応じて `.cline/skills/salesforce-skills/SKILL.md` を使い、関連する `.agents/skills/` 配下の `SKILL.md` を確認する。
