# Salesforce Agent Skills のメンテナンス

[forcedotcom/sf-skills](https://github.com/forcedotcom/sf-skills) の `main` にある `skills/` 全体を、プロジェクトの `.agents/skills/` に同期します。以下は Skills CLI 1.9.0 で確認した手順です。リポジトリのルートで、同期用の作業ブランチから実行します。

## 1. 更新候補を確認する

```sh
git status --short --branch
npx --yes skills@1.9.0 check --project
```

`has an update` は導入済みスキルの更新候補、`deleted upstream` は取得元で見つからなかった削除候補です。更新候補やローカル変更を検出すると、`check` は終了コード 1 を返します。スキル本体やロックファイルに作業中の変更があれば先に内容を確認します。接続エラーで照合が完了しなかった場合は、再実行して結果を確認します。

## 2. 削除候補がある場合だけ旧名を削除する

取得元のコミット履歴や変更履歴で、各候補の廃止・改名・移行先を確認します。削除候補がなければ手順 3 に進みます。

対話端末では次を実行し、削除確認に表示された名前が確認済みの一覧と一致したら承認します。

```sh
npx --yes skills@1.9.0 update --project
```

非対話実行では削除確認がスキップされます。その場合は `npx --yes skills@1.9.0 remove <確認済みの旧名...> -y` のプレースホルダーを**その回に確認した名前**に置き換えます。削除・改名の根拠と移行先を PR に記録します。

## 3. 新規・改名分を含む全スキルを取得する

```sh
npx --yes skills@1.9.0 add https://github.com/forcedotcom/sf-skills/tree/main/skills \
  --skill '*' --agent codex -y
```

`--skill '*'` は取得元の全スキル、`--agent codex` はプロジェクトの Codex を指定します。**手順 1 で「最新」と表示されても、この全件取得は実行します。** 取得元に新しいスキルだけが追加された場合、導入済みスキルのチェックでは検出できません。

機能別にコミットする場合は、先に `add` の `--skill` にそのグループの名前を並べ、スキル本体と CLI が生成した `skills-lock.json` を一緒にコミットします。最後に上の全件取得で、追加漏れと取得元の記録を揃えます。

全件取得後に `npx --yes skills@1.9.0 check --project` を再実行し、更新・削除候補が残っていないことを確認します。PR では `.agents/skills/` と `skills-lock.json` の差分を一緒にレビューします。

取得元の不具合や競合マーカーは PR に記録し、取得元での修正を次の同期で取り込みます。スキル本体やロックのハッシュは手編集しません。
