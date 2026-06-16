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

## 例

```sh
git switch -c codex/setup-dev-docs
git commit -m "docs: Salesforce DX開発運用ルールを追加"
```
