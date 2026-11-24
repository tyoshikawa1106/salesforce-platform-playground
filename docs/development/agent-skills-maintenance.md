# Salesforce Agent Skills のメンテナンス

このリポジトリでは、[forcedotcom/sf-skills](https://github.com/forcedotcom/sf-skills) の `skills/` 全体を同期します。作業ブランチのリポジトリルートで、次の順に実行します。

```sh
# 1. 導入済みスキルを更新する。削除候補が表示されたら旧名を確認する。
npx --yes skills@1.9.0 update --project

# 2. 取得元に追加されたスキルや改名後のスキルも取り込む。
npx --yes skills@1.9.0 add https://github.com/forcedotcom/sf-skills/tree/main/skills --skill '*' --agent codex -y
```

削除候補がある場合、対話端末では名前を確認して削除を承認します。非対話実行で削除がスキップされた場合は、`npx --yes skills@1.9.0 remove <旧スキル名> -y` の `<旧スキル名>` に確認済みの名前を指定します。

更新された `.agents/skills/` と `skills-lock.json` の差分を一緒にレビューし、PR に含めます。
