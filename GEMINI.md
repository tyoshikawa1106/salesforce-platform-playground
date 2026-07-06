# Gemini CLI Instructions

このファイルは Gemini CLI 向けの指示です。

- 作業前に `AGENTS.md` を読み、そこに書かれたリポジトリ運用ルールを優先する。
- 詳細な実務手順は `docs/development/` と `docs/deployment/` の該当するルール文書を確認する。
- `AGENTS.md` または `docs/` とこのファイルの内容がずれる場合は、`AGENTS.md` と `docs/` を優先する。
- このファイルには Gemini CLI 固有の指示だけを書き、リポジトリ共通ルールは重複させない。
- Salesforce 関連作業では、`.agents/skills/` が存在する場合のみ、必要に応じて該当する `SKILL.md` を検索し、内容を確認してから作業する。
- `.agents/skills/` は Git 管理外のローカル生成物のため、通常のファイル補完や自動探索に出ない場合がある。
- Salesforce 関連作業で skill が必要な場合は、`find .agents/skills -maxdepth 2 -name SKILL.md` などで候補を確認し、該当する `SKILL.md` を明示パスで読む。
