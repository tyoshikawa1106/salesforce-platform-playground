# AI エージェントスキル

この手順では、Salesforce 関連作業を補助する AI エージェントスキルの導入と扱いを定義します。

このリポジトリでは、AI エージェントスキルを Salesforce 関連知見の補助として使います。ただし、プロジェクト固有の判断や運用ルールは `AGENTS.md` と `docs/` を優先します。

## forcedotcom/sf-skills

`forcedotcom/sf-skills` は、Apex、Flow、メタデータ、SOQL、Apex テストなどを扱う Salesforce 関連の AI エージェントスキル集です。

### 導入

各ユーザーのローカル環境で必要に応じて導入します。

```sh
npx skills add forcedotcom/sf-skills
```

導入すると `.agents/skills/` と `skills-lock.json` が生成されます。
これらはローカル生成物として扱い、Git 管理しません。

## 導入効果

AI エージェントが Apex、Apex テスト、Custom Object、Custom Field、Permission Set、Validation Rule、Flow、SOQL、デプロイ関連の作業で Salesforce 関連知見を参照できる。

## 参照

- https://github.com/forcedotcom/sf-skills
