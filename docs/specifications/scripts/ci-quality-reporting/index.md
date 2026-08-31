# 定期品質チェック結果報告スクリプト

## 概要

GitHub Actionsの定期品質チェック結果を受け取り、チェックごとの障害検知Issueを作成、更新、復旧時にクローズするNode.jsスクリプトです。

## 目的・利用場面

定期品質チェックの継続障害を同じIssueへ集約し、後続の成功を復旧記録として残すために使用します。

## 対象実装・メタデータ

| 種別             | パス                                           | 役割                                         |
| ---------------- | ---------------------------------------------- | -------------------------------------------- |
| GitHub Actions   | `.github/workflows/ci.yml`                     | 定期チェック結果と実行情報を環境変数で渡す   |
| Node.js script   | `scripts/ci/report-quality-check.js`           | GitHub Issueの作成、追記、クローズを制御する |
| テストスクリプト | `scripts/ci/test/report-quality-check.node.js` | 結果別のGitHub CLI操作を検証する             |

## 入力

GitHub Actionsから次の環境変数を受け取ります。

| 環境変数         | 用途                                          |
| ---------------- | --------------------------------------------- |
| `NPM_RESULT`     | `Nightly npm checks` jobの結果                |
| `WINDOWS_RESULT` | `Weekly Windows script checks` jobの結果      |
| `GITHUB_ACTOR`   | 新規Issueの担当者                             |
| `GITHUB_SHA`     | Issue本文またはコメントへ記録する対象コミット |
| `RUN_URL`        | GitHub Actions実行ログのURL                   |
| `GH_TOKEN`       | GitHub CLIがIssueを操作するためのtoken        |
| `GH_REPO`        | GitHub CLIの対象リポジトリ                    |

結果は`failure`と`success`だけを処理し、`skipped`、`cancelled`、未定義値はIssueを変更しません。

## 処理内容

1. npmチェックとWindowsスクリプトチェックを別々の監視対象として処理する。
2. `CI: <チェック名>が失敗しています`をタイトル検索条件にしてopen Issueの候補を取得し、完全一致するIssueを検索する。
3. `failure`で対応Issueがなければ、`bug`と`area:testing`ラベル、実行者の担当指定を付けてIssueを作成する。
4. `failure`で対応Issueがあれば、検知日時、対象コミット、結果、実行ログをコメントする。
5. `success`で対応Issueがあれば、復旧確認日時、対象コミット、実行ログをコメントし、`completed`としてクローズする。
6. `success`で対応Issueがなければ、一覧確認だけで終了する。

日時は`YYYY-MM-DD HH:mm:ss JST`形式で記録します。

## 出力・更新対象

- GitHub Issueを作成、コメント、クローズします。
- リポジトリのファイルやSalesforce組織は変更しません。
- GitHub CLIの操作に失敗した場合は原因をGitHub Actionsログへ表示し、終了コード`1`を返します。

## 権限・実行条件

- `.github/workflows/ci.yml`の報告jobは`issues: write`と`contents: read`を使用します。
- GitHub CLIが利用でき、workflowの`GITHUB_TOKEN`と対象リポジトリが設定されている必要があります。
- 通常はGitHub Actionsから実行し、利用者向けのローカル実行入口は設けません。

## エラー処理

- GitHub CLIの起動失敗と非0終了を報告処理の失敗として扱います。
- open Issue一覧がJSON配列でない場合は、既存Issueの有無を推測せず停止します。
- 一方のチェック処理で例外が発生した場合は、後続チェックを処理せず報告jobを失敗させます。

## 関連コンポーネント

- [CIメタデータ検証ルール](../../../deployment/ci-metadata-validation-rules.md)
- `.github/workflows/ci.yml`

## テスト・確認観点

`scripts/ci/test/report-quality-check.node.js`で、対象外結果、初回失敗、継続失敗、復旧、対応Issueなし、JSON不正、GitHub CLI失敗、JST日時を確認します。

```sh
node --test scripts/ci/test/report-quality-check.node.js
```

## 制約・注意事項

- 同一性はIssueタイトルの完全一致で判定します。
- GitHub検索の候補から、Issueタイトルが完全一致するものだけを更新対象にします。
- `skipped`と`cancelled`は成功または失敗とみなさず、既存Issueへ記録しません。
- Issue本文とコメントにはworkflowから渡されたコミットと実行URLを記録します。

## 既知の差異・確認事項

- 状態: 未確認
- Node.jsテストではGitHub CLI操作を模擬しています。GitHub Actions上でのIssue作成、継続失敗の追記、復旧クローズはworkflowの実行結果で確認します。
