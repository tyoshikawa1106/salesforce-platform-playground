# AI エージェントスキル

この手順では、Salesforce 関連の参考情報として参照する AI エージェントスキルの配置と扱いを定義します。
プロジェクト固有の判断や運用ルールは `AGENTS.md` と `docs/` を優先します。

## forcedotcom/sf-skills

`forcedotcom/sf-skills` は、Apex、Flow、メタデータ、SOQL、Apex テストなどを扱う Salesforce 関連の AI エージェントスキル集です。

### 配置

`.agents/skills/` と `skills-lock.json` は Git 管理されているため、リポジトリを取得した環境で追加導入せずに参照できます。

Skills 本体と lock file は外部取得物として扱い、リポジトリのフォーマット処理や文書検証では変更しません。

### 更新

Skills を更新する場合は、`.agents/skills/` と `skills-lock.json` の対応を揃え、両方の差分を Pull Request でレビューしてから取り込みます。Skills の個別ファイルや `skills-lock.json` のハッシュを手編集しません。不具合や競合マーカーを見つけた場合もリポジトリ側では修正せず、取得元の内容として報告します。

## 参照時の扱い

- Salesforce 関連作業では、`.agents/skills/` から作業に対応する `SKILL.md` を参照する。
- プロジェクト固有の判断、承認境界、検証条件は `AGENTS.md` と `docs/` を優先する。
- Skills に deploy、retrieve、データ変更、認証操作などの手順が含まれていても、それ自体を実行承認として扱わない。

## 参照できる作業

AI エージェントが Apex、Apex テスト、Custom Object、Custom Field、Permission Set、Validation Rule、Flow、SOQL、デプロイ関連の作業で Salesforce 関連の参考情報を参照できる。

## 外部リンク

- https://github.com/forcedotcom/sf-skills
