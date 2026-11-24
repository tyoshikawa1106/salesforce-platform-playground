# Salesforce Agent Skills のメンテナンス

リポジトリのルートで、作業ブランチに切り替えてから実行します。以下のコマンドは Skills CLI 1.9.0 で確認しています。

## 導入済みのスキルを更新する

```sh
npx --yes skills@1.9.0 update --project
```

対話端末では、取得元から消えたスキルがあると、ローカルから削除するか確認されます。表示された名前と取得元の履歴を確認して選択します。変更前に候補だけを見たい場合は `npx --yes skills@1.9.0 check --project` を使います。

## 取得元の新しいスキルも取り込む

このリポジトリでは [forcedotcom/sf-skills](https://github.com/forcedotcom/sf-skills) の `skills/` 全体を管理しています。全件を同期する回は、上の更新に続いて次のコマンドを実行します。新規スキルや改名後のスキルも取得できます。

```sh
npx --yes skills@1.9.0 add https://github.com/forcedotcom/sf-skills/tree/main/skills \
  --skill '*' --agent codex -y
```

非対話実行では `update` が削除をスキップします。削除候補があった回だけ、`npx --yes skills@1.9.0 remove <旧スキル名> -y` の `<旧スキル名>` を確認済みの名前に置き換えて実行します。

PR では CLI が更新した `.agents/skills/` と `skills-lock.json` を一緒にレビューします。廃止・改名があれば、取得元で確認した経緯や移行先を記録します。取得元の不具合は手編集せず、修正版を次回の更新で取り込みます。
