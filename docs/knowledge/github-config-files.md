# GitHub 設定ファイル

このページは、GitHub Actions、Dependabot、Release notes、Issue / PR template の設定内容を説明します。

## .github/workflows/ci.yml

pull request と `main` push で実行する CI です。

| 設定 / step                                       | 内容                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `pull_request` / `push`                           | `main` 向け PR と `main` push で実行する。                           |
| `permissions.contents: read`                      | CI は read-only に寄せる。                                           |
| `HUSKY: 0`                                        | CI 上では Husky hook を無効化する。                                  |
| `concurrency`                                     | 同じ ref の古い CI をキャンセルする。                                |
| `actions/checkout@v7`                             | repository の source を checkout する。内部ランタイムは Node.js 24。 |
| `actions/setup-node@v6`                           | Node.js 24 と npm cache を設定する。                                 |
| `npm ci --include=dev`                            | lockfile どおりに依存を入れる。                                      |
| `npm audit --audit-level=high`                    | 全依存を監査し、high / criticalの既知脆弱性を検出する。              |
| `npm run prettier:verify`                         | formatter 確認。                                                     |
| `npm run docs:check`                              | docs のリンク、見出し、ファイル名、索引到達性を確認。                |
| `npm run lint -- --no-error-on-unmatched-pattern` | Aura / LWC JS lint。                                                 |
| `actions/setup-java@v5`                           | Code Analyzer 用の Java 17 を設定する。内部ランタイムは Node.js 24。 |
| Salesforce Code Analyzer                          | Salesforce CLI と plugin を入れて `npm run code-analyzer:ci`。       |
| Script unit tests                                 | `npm run test:scripts` で Scratch Org 操作の引数ガードを確認する。   |
| Salesforce validate                               | JWT secrets が揃っている場合だけ `npm run sf:validate:dev`。         |
| LWC unit tests                                    | `npm run test:unit -- -- --runInBand --passWithNoTests`。            |

Salesforce validate で使う secrets:

| secret               | 内容                                        |
| -------------------- | ------------------------------------------- |
| `SF_JWT_CLIENT_ID`   | Connected App の client id。                |
| `SF_JWT_USERNAME`    | JWT login user。                            |
| `SF_JWT_PRIVATE_KEY` | JWT signing key。                           |
| `SF_LOGIN_URL`       | optional。未設定時は login.salesforce.com。 |

CI に secret 実値は書きません。

## .github/dependabot.yml

npm dependency と GitHub Actions の version update PR を作成する設定です。

| key                                 | 内容                                                           |
| ----------------------------------- | -------------------------------------------------------------- |
| `package-ecosystem: npm`            | npm dependency を対象にする。                                  |
| `package-ecosystem: github-actions` | workflow 内の GitHub Actions を対象にする。                    |
| `directory: '/'`                    | repository root を対象にする。                                 |
| `schedule.interval: weekly`         | 毎週月曜日の 09:00 JST に更新を確認する。                      |
| `open-pull-requests-limit`          | ecosystem ごとの同時 open PR 上限。                            |
| `labels`                            | npm は`area:testing`、GitHub Actions は`area:github`を付ける。 |
| `commit-message.prefix`             | commit message prefix を`chore`にする。                        |
| `groups.npm-development`            | devDependency 更新を grouping する。                           |

特定個人の assignee / reviewer は固定しません。

## .github/release.yml

GitHub Release notes の自動分類設定です。

| category        | label             |
| --------------- | ----------------- |
| 機能追加        | `enhancement`     |
| 不具合修正      | `bug`             |
| ドキュメント    | `documentation`   |
| Apex            | `area:apex`       |
| メタデータ      | `area:metadata`   |
| デプロイ / 運用 | `area:deployment` |
| テスト / 品質   | `area:testing`    |
| GitHub / 保守   | `area:github`     |
| その他          | `*`               |

release notes は deploy や package publish を実行する設定ではありません。

## Issue template

`.github/ISSUE_TEMPLATE/` は Issue 作成フォームを定義します。

| ファイル             | 内容                        |
| -------------------- | --------------------------- |
| `config.yml`         | Issue template 全体の挙動。 |
| `01_improvement.yml` | 機能追加 / 改善 Issue。     |
| `02_bug_report.yml`  | 不具合報告 Issue。          |

必須項目、初期 label、秘密情報への注意書きが GitHub 運用ルールと一致しているか確認します。

## .github/pull_request_template.md

PR 作成時の記入テンプレートです。

| セクション   | 内容                                              |
| ------------ | ------------------------------------------------- |
| Issue        | `Closes #<issue番号>` または Issue なしの理由。   |
| 変更内容     | 主な変更点、理由、影響範囲、維持した既存挙動。    |
| 確認結果     | 実行したチェック、未実行チェックの理由。          |
| レビュー観点 | 見てほしい Apex、metadata、権限、運用上の注意点。 |

Salesforce 組織操作を記録できる確認結果欄を残します。
