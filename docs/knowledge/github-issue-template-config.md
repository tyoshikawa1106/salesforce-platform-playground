# GitHub Issue テンプレート設定

`.github/ISSUE_TEMPLATE/config.yml` は、GitHub の Issue 作成画面で Issue テンプレート全体の挙動を設定するファイルです。

例:

```yaml
blank_issues_enabled: true
```

これは、用意した Issue テンプレートだけでなく、テンプレートなしの空 Issue も作成できるようにする設定です。

## 設定の使い分け

`blank_issues_enabled: true` は、テンプレートに当てはまらない相談、調査メモ、作業メモを許可したい場合に向いています。

`blank_issues_enabled: false` は、Issue の入力形式を統一し、必要な情報をテンプレートで必ず集めたい場合に向いています。

プロジェクトの初期段階では `true` にして自由度を残し、運用が安定してきたら `false` を検討すると使いやすいです。
