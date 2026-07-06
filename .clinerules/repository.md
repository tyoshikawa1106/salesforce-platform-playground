# Repository Rules

このファイルは Cline 向けの指示です。

- 作業前に `AGENTS.md` を読み、そこに書かれたリポジトリ運用ルールを優先する。
- 詳細な実務手順は `docs/development/` と `docs/deployment/` の該当するルール文書を確認する。
- `AGENTS.md` または `docs/` とこのファイルの内容がずれる場合は、`AGENTS.md` と `docs/` を優先する。
- このファイルには Cline 固有の指示だけを書き、リポジトリ共通ルールは重複させない。
- 自動 context では `.clineignore` を尊重する。ユーザーの明示依頼があり、かつリポジトリルール上許可される場合を除き、除外対象のローカル状態、生成物、credential、環境ファイルを意図的に読まない。
- Salesforce 関連作業では、必要に応じて `.cline/skills/salesforce-skills/SKILL.md` を使う。`.agents/skills/` が存在する場合のみ、関連する `SKILL.md` を確認する。
