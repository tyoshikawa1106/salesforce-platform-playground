# Salesforce メタデータ取得ルール

この文書は、AI エージェントが Salesforce 組織からメタデータを retrieve するときの実行ルールを定義します。

## 実行ルール

- retrieve はタスクに必要なメタデータだけに絞る。
- 取得したメタデータは `force-app/main/default` 配下で確認する。
- 取得後は必ず差分を確認し、不要な自動生成差分や組織固有差分を残さない。
- `.env`、認証ファイル、組織固有の一時ファイルは取得・コミット対象にしない。

## 取得前確認

retrieve 前に次を確認します。

- 対象 Salesforce 組織の alias
- 取得する metadata type と名前
- 既存ファイルへの上書き影響
- Permission Set / Profile など権限系メタデータへの影響

対象組織を確認します。

```sh
sf config get target-org
```

alias だけでは判断できない場合に限り、必要な範囲で `sf org display` を使います。報告には秘密情報、実ユーザー名、org 固有 URL を書きません。

## 取得後確認

取得後は差分を確認します。

```sh
git status --short
git diff --stat
git diff
```

特に次を確認します。

- タスク外の metadata が混ざっていないか。
- 権限系ファイルに広い差分が混ざっていないか。
- 組織固有の ID、URL、ユーザー名、認証情報が入っていないか。
- フォーマットだけの差分が意図せず広がっていないか。

広い manifest で retrieve すると、Salesforce CLI の結果表では `Changed` が多数表示されることがあります。コミット判断では CLI の表示だけでなく、Git の差分を正とします。`git status --short` と `git diff --stat` が空なら、実ファイルの意図しない更新は発生していません。

## package.xml の扱い

`package.xml` は、タスクで明示されていない限り一時的な取得・検証補助として扱います。

コミット対象にする場合は、なぜその manifest がリポジトリに必要かを報告に残します。

## 報告ルール

retrieve を行った場合は次を報告します。

- 対象 Salesforce 組織の alias
- 取得した metadata type と名前
- 追加・更新されたファイル
- 除外した差分があれば、その理由
