# 開発ルール

このリポジトリでは GitHub Flow で開発します。

## 基本ルール

- `main` は常に動作確認済みの状態に保つ。
- `main` へ直接コミットしない。
- 作業前に Issue を作成し、Issue 単位でブランチを切る。
- PR には対応する Issue を `Closes #<issue番号>` で紐づける。
- ブランチ名には作業内容が分かる短い summary を入れる。
- コミット時の hook は原則通す。
- `--no-verify` はユーザーが明示した場合だけ使う。
- hook が依存不足で失敗した場合、勝手に依存を導入せず確認する。

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
- 迷う場合は、作業内容を表す `area:*` と変更種別を表す `type:*` を 1 つずつ選ぶ。
- 既存ラベルで表現できない場合は、勝手に新しいラベルを増やさず確認する。

### area

| label             | 用途                                    |
| ----------------- | --------------------------------------- |
| `area:apex`       | Apex クラス、トリガー、Apex テスト      |
| `area:metadata`   | Object、Field、Flow、Permission Set     |
| `area:deployment` | deploy、retrieve、destructive changes   |
| `area:docs`       | README、AGENTS、docs                    |
| `area:github`     | Issue、PR、GitHub Actions、テンプレート |
| `area:testing`    | テスト、検証、coverage                  |

### type label

| label              | 用途                         |
| ------------------ | ---------------------------- |
| `type:improvement` | 改善、機能追加、ルール追加   |
| `type:maintenance` | 保守、依存関係、運用作業     |
| `type:refactor`    | 振る舞いを変えない整理       |
| `type:test`        | テスト追加、テスト方針の変更 |

GitHub 標準ラベルの `bug`、`documentation`、`enhancement`、`question` も、内容に合う場合は利用します。

## 例

```sh
git switch -c codex/setup-dev-docs
git commit -m "docs: Salesforce DX開発運用ルールを追加"
```
