# 開発ルール

このリポジトリでは GitHub Flow で開発します。

## 基本ルール

- `main` は常に動作確認済みの状態に保つ。
- `main` へ直接コミットしない。
- 作業前に Issue を作成し、Issue 単位でブランチを切る。
- Issue は `.github/ISSUE_TEMPLATE/` の内容に従って作成する。
- PR には対応する Issue を `Closes #<issue番号>` で紐づける。
- PR 本文は `.github/pull_request_template.md` の構成に従って作成する。
- ブランチ名には作業内容が分かる短い summary を入れる。
- コミット時の hook は原則通す。
- `--no-verify` はユーザーが明示した場合だけ使う。
- hook が依存不足で失敗した場合、勝手に依存を導入せず確認する。

## PR マージ後の作業ブランチ整理

PR マージ後は、次の条件をすべて満たす場合に限り、エージェントが明示確認なしで作業ブランチ整理を実行してよい。

- PR がマージ済みであることを確認できる。
- 作業ツリーが clean で、未コミット変更がない。
- 現在の作業ブランチがマージ済み PR のブランチであることを確認できる。
- `main` へ戻り、`git pull --ff-only` で同期できる。
- 作業ブランチを `git branch -d <branch>` で削除できる。

次の場合は自動実行せず、ユーザーに確認する。

- 未コミット変更がある。
- PR のマージ状態や削除対象ブランチを確認できない。
- `git pull --ff-only` が失敗する。
- ブランチ削除に `git branch -D` が必要になる。
- remote ブランチ削除、push、PR 作成、CI 確認、merge など、作業ブランチ整理の範囲を超える操作が必要になる。

## 命名ルール

| 対象               | 形式                      |
| ------------------ | ------------------------- |
| 作業ブランチ       | `feature/<summary>`       |
| Codex 作業ブランチ | `codex/<summary>`         |
| コミットメッセージ | `<type>: <日本語summary>` |
| PR title           | `<type>: <日本語summary>` |

## type

| type       | 用途                   |
| ---------- | ---------------------- |
| `feat`     | 機能追加               |
| `fix`      | 不具合修正             |
| `docs`     | ドキュメント変更       |
| `test`     | テスト追加、修正       |
| `refactor` | 振る舞いを変えない整理 |
| `style`    | 見た目や整形の変更     |
| `ci`       | CI 設定の変更          |
| `chore`    | その他の保守作業       |
| `revert`   | 変更の取り消し         |

## ラベルルール

GitHub の Issue と PR には必ずラベルを付けます。

- Issue 作成時は、内容に合う分類ラベルを付ける。
- PR 作成時は、対応する Issue と同じ観点でラベルを付ける。
- エージェントが PR を作成する場合は、対応 Issue のラベルを確認し、同じ観点のラベルを PR に付ける。
- エージェントが PR を作成・更新した後は PR のラベルを確認し、対応 Issue と観点がずれていれば補正する。
- 迷う場合は、まず GitHub 標準ラベルから内容に合うものを選び、必要に応じて作業領域を表す `area:*` を追加する。
- このファイルに定義済みのラベルが GitHub に存在しない場合は、ユーザーに確認してからラベルを作成して使う。
- 未定義のラベルが必要な場合は、勝手に新しいラベルを増やさず確認する。

### area

| label             | 用途                                    |
| ----------------- | --------------------------------------- |
| `area:apex`       | Apex クラス、トリガー、Apex テスト      |
| `area:metadata`   | Object、Field、Flow、Permission Set     |
| `area:deployment` | deploy、retrieve、destructive changes   |
| `area:github`     | Issue、PR、GitHub Actions、テンプレート |
| `area:testing`    | テスト、検証、coverage                  |

GitHub 標準ラベルの `bug`、`documentation`、`enhancement`、`question` も、内容に合う場合は利用します。

## Project / Milestone ルール

Issue と PR は、このリポジトリ用の Project に紐づけます。Milestone は、期限やリリースなどの区切りがある場合だけ使います。

- Project は `Salesforce Platform Playground` を使う。
- 新規 Issue / PR の Project は GitHub Actions で自動設定する。
- 過去の Issue / PR は、同じ workflow の手動実行で Project をまとめて補正する。
- Milestone は自動設定しない。必要な作業単位が決まったときに手動で設定する。
- Project 設定が失敗した場合は、原因を確認してから手動で補正する。
- user Project v2 への書き込みで `GITHUB_TOKEN` が使えない場合は、`PROJECTS_TOKEN` secret を設定する。

## 例

```sh
git switch -c codex/setup-dev-docs
git commit -m "docs: Salesforce DX開発運用ルールを追加"
```
