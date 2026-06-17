# Salesforce 公式 Skills

Salesforce 公式の `forcedotcom/sf-skills` は、Apex、Flow、メタデータ、SOQL、Apex テストなどを扱う agent skills 集です。

このリポジトリでは、`sf-skills` を公式知見の補助として使います。ただし、プロジェクト固有の判断や運用ルールは `AGENTS.md` と `docs/` を優先します。

## 導入

各ユーザーのローカル環境で必要に応じて導入します。

```sh
npx skills add forcedotcom/sf-skills
```

導入すると `.agents/skills/` と `skills-lock.json` が生成されます。
これらはローカル生成物として扱い、Git 管理しません。

## 使い方の方針

- Apex、Apex テスト、Custom Object、Custom Field、Permission Set、Validation Rule、Flow、SOQL、デプロイ関連の作業で参照する。
- skill の内容をそのままリポジトリのルールとして扱わない。
- `AGENTS.md` と `docs/` のリポジトリ固有ルールを優先し、`sf-skills` は Salesforce 公式知見の裏取りとして使う。
- 実際にこのプロジェクトで採用した手順は、必要に応じて `docs/development/` または `docs/deployment/` に残す。

## 参照

- https://github.com/forcedotcom/sf-skills
