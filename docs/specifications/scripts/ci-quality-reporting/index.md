# 定期品質チェック結果報告スクリプト

## 機能の用途

GitHub Actionsの定期品質チェック結果を受け取り、チェックごとの障害検知Issueを作成、更新、復旧時にクローズするNode.jsスクリプトです。

定期品質チェックの継続障害を同じIssueへ集約し、後続の成功を復旧記録として残すために使用します。

## 対象実装

| 種別             | パス                                                                                     | 役割                                         |
| ---------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| GitHub Actions   | [ci.yml](../../../../.github/workflows/ci.yml)                                           | 定期チェック結果と実行情報を環境変数で渡す   |
| Node.js script   | [report-quality-check.js](../../../../scripts/ci/report-quality-check.js)                | GitHub Issueの作成、追記、クローズを制御する |
| テストスクリプト | [report-quality-check.node.js](../../../../scripts/ci/test/report-quality-check.node.js) | ブランチと結果別のGitHub CLI操作を検証する   |

### 関連コンポーネント

- [リポジトリ固有GitHub運用ルール](../../../development/github-repository-rules.md#github-actions)
- `.github/workflows/ci.yml`

## 対象ファイル・データ

- GitHub Issueを作成、コメント、クローズします。
- リポジトリのファイルやSalesforce組織は変更しません。
- GitHub CLIの操作に失敗した場合は原因をGitHub Actionsログへ表示し、終了コード`1`を返します。

## 実行方法・入力

GitHub Actionsから次の環境変数を受け取ります。

| 環境変数         | 用途                                             |
| ---------------- | ------------------------------------------------ |
| `NPM_RESULT`     | `Nightly npm checks` jobの結果                   |
| `WINDOWS_RESULT` | `Weekly Windows script checks` jobの結果         |
| `GITHUB_ACTOR`   | 新規Issueの担当者                                |
| `GITHUB_REF`     | `refs/heads/main` の実行だけを報告対象とする判定 |
| `GITHUB_SHA`     | Issue本文またはコメントへ記録する対象コミット    |
| `RUN_URL`        | GitHub Actions実行ログのURL                      |
| `GH_TOKEN`       | GitHub CLIがIssueを操作するためのtoken           |
| `GH_REPO`        | GitHub CLIの対象リポジトリ                       |

`GITHUB_REF` が `refs/heads/main` と一致する場合だけGitHub CLIを実行します。作業ブランチ、タグ、ref不明の実行は監視Issueを変更しません。

報告前にGitHub APIで現在のmainのSHAを取得し、`GITHUB_SHA`と一致しない古いコミットの結果は反映しません。SHAが未指定の場合も反映せず、API取得失敗時は報告jobを失敗させます。報告jobは同じref内で直列化します。

結果は`failure`と`success`だけを処理し、`skipped`、`cancelled`、未定義値はIssueを変更しません。

### 権限・実行条件

- `.github/workflows/ci.yml`の報告jobは`issues: write`と`contents: read`を使用します。
- GitHub CLIが利用でき、workflowの`GITHUB_TOKEN`と対象リポジトリが設定されている必要があります。
- 通常はGitHub Actionsから実行し、利用者向けのローカル実行入口は設けません。

## エラー判定

- GitHub CLIの起動失敗と非0終了を報告処理の失敗として扱います。
- open Issue一覧がJSON配列でない場合は、既存Issueの有無を推測せず停止します。
- 一方のチェック処理で例外が発生した場合は、後続チェックを処理せず報告jobを失敗させます。

## 処理詳細

1. npmチェックとWindowsスクリプトチェックを別々の監視対象として処理する。
2. `CI: <チェック名>が失敗しています`をタイトル検索条件にしてopen Issueの候補を取得し、完全一致するIssueを検索する。
3. `failure`で対応Issueがなければ、`bug`と`area:testing`ラベル、実行者の担当指定を付けてIssueを作成する。
4. `failure`で対応Issueがあれば、検知日時、対象コミット、結果、実行ログをコメントする。
5. `success`で対応Issueがあれば、復旧確認日時、対象コミット、実行ログをコメントし、`completed`としてクローズする。
6. `success`で対応Issueがなければ、一覧確認だけで終了する。

日時は`YYYY-MM-DD HH:mm:ss JST`形式で記録します。

### 制約・注意事項

- 同一性はIssueタイトルの完全一致で判定します。
- GitHub検索の候補から、Issueタイトルが完全一致するものだけを更新対象にします。
- `skipped`と`cancelled`は成功または失敗とみなさず、既存Issueへ記録しません。
- Issue本文とコメントにはworkflowから渡されたコミットと実行URLを記録します。

### 既知の差異・確認事項

- 状態: 未確認
- Node.jsテストではGitHub CLI操作を模擬しています。GitHub Actions上でのIssue作成、継続失敗の追記、復旧クローズはworkflowの実行結果で確認します。

### テストコードと確認内容

[テストコードと確認内容](tests.md)
