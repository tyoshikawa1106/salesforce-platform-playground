# AI エージェントスキル

この手順では、Salesforce 関連の参考情報として使う AI エージェントスキルの導入と扱いを定義します。
プロジェクト固有の判断や運用ルールは `AGENTS.md` と `docs/` を優先します。

## forcedotcom/sf-skills

`forcedotcom/sf-skills` は、Apex、Flow、メタデータ、SOQL、Apex テストなどを扱う Salesforce 関連の AI エージェントスキル集です。

### 導入

各ユーザーのローカル環境で必要に応じて導入します。

```sh
npx skills add forcedotcom/sf-skills
```

導入すると `.agents/skills/` と `skills-lock.json` が生成されます。
これらはローカル生成物として扱い、Git 管理しません。

## 実行環境ごとの扱い

- ローカル作業では、`.agents/skills/` が存在する場合に限り、Salesforce 関連の参考情報として参照する。
- `.agents/skills/` が存在しない場合も、作業を止めず、`AGENTS.md` と `docs/` を優先して進める。
- sf-skills が必要な場合だけ、この手順に従ってローカル環境へ導入する。

## 導入効果

AI エージェントが Apex、Apex テスト、Custom Object、Custom Field、Permission Set、Validation Rule、Flow、SOQL、デプロイ関連の作業で Salesforce 関連の参考情報を参照できる。

## 参照

- https://github.com/forcedotcom/sf-skills
