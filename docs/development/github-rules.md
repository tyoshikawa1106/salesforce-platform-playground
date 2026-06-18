# GitHub 運用ルール

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

## コミット本文

実質的な変更を含むコミットは、subject だけで終わらせず本文を付けます。本文には次を簡潔に書きます。

- 目的: なぜ変更したか。
- 主な変更: 何を変更したか。
- 検証: 実行した確認コマンドと結果。未実行の確認があれば理由も書く。

例:

```text
refactor: 取引先名正規化を専用クラスへ分離

AccountTriggerHandler から取引先名の会社略称正規化ロジックを AccountNameNormalizer へ切り出し、handler は trigger context の振り分けに集中させる。

AccountNameNormalizerTest を追加し、直接テストと trigger 経由の回帰テストで複数略称を含む取引先名の正規化を確認する。

検証: sf code-analyzer run は違反 0 件。sf project deploy validate --source-dir force-app は salesforce-playground で成功し、対象 Apex テスト 10 件が通過。
```

次のような機械的・軽微なコミットでは、本文を省略してよいです。

- typo 修正のみ。
- フォーマットのみ。
- 依頼により明示的に subject だけにする場合。

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

## Assignee ルール

Issue と PR には、作成時に assignee を設定します。

- 特別な指定がない場合は、repository owner を assignee にする。
- エージェントが Issue / PR を作成する場合は、作成コマンドで assignee を指定する。
- assignee が未設定の Issue / PR を見つけた場合は、気づいた時点で補正する。
- 特定の個人ユーザー名を運用ルールや automation config に固定しない。
- author は作成者、assignee は現在の担当者として扱う。
- PR 作成・更新後は、`assignees`、`labels`、Project 紐づけを確認する。

## GitHub Actions

- GitHub Actions は CI、静的解析、secret scan など、変更内容の品質確認に使う。
- assignee、label、milestone、Project 追加、Project status 更新などの運用メタデータ整理は Actions で自動化せず、エージェントまたはユーザーが明示的に行う。
- CI workflow は `permissions: contents: read` を基本にし、必要な権限だけを明示する。
- 最小 CI は `npm ci`、`npm audit --omit=dev`、lint、LWC unit test を実行する。
- required status checks は、`main` の branch protection で `npm checks` を必須にする。

## Dependabot

- Dependabot alerts と security updates は、既知脆弱性の検出と修正 PR 作成に使う。
- Dependabot version updates は、通常の npm 依存更新 PR を週次で作成するために使う。
- Dependabot PR には `enhancement` と `area:testing` を付ける。
- Dependabot config には個人ユーザー名を assignee として固定しない。
- Dependabot PR の Project 紐づけや担当者設定は、必要に応じて手動で確認する。

## リポジトリセキュリティ設定

このリポジトリは公開リポジトリとして扱い、GitHub 側の保護設定を軽量に有効化します。

2026-06-18 時点の標準設定は次の通りです。

- `main` は branch protection を有効化し、Pull Request 経由の変更を必須にする。
- branch protection は admin にも適用する。
- `main` の required status checks は `npm checks` を必須にする。
- `main` への force push と branch deletion は許可しない。
- PR の unresolved conversation が残っている場合は merge しない。
- Dependabot alerts と Dependabot security updates を有効化する。
- secret scanning と push protection を有効化する。
- GitHub Actions は GitHub-owned actions と verified creator の actions だけを許可する。
- PR merge 後は GitHub 側で head branch を自動削除する。

次の設定は、現時点では保留します。

- required approving review count: 個人運用で協力者がいない場合に merge できなくなるため。
- required linear history: merge 方針を別途決める必要があるため。
- CODEOWNERS 必須レビュー: 個人運用では重くなりやすいため。

secret scanning の non-provider patterns と validity checks は有効化候補ですが、2026-06-18 時点では GitHub API で更新しても repository settings に反映されませんでした。GitHub 側で利用可能になったことを確認できたら有効化します。

## Project / Milestone ルール

Issue と PR は、このリポジトリ用の Project に紐づけます。Milestone は、期限やリリースなどの区切りがある場合だけ使います。

- Project は `Salesforce Platform Playground` を使う。
- 新規 Issue / PR の Project は手動で設定する。
- Project 追加は `gh project item-add ...` などで、エージェントまたはユーザーが明示的に実行する。
- Project 紐づけの確認は対象 Issue / PR の item だけを見る。Project 全件を取得して絞り込む運用は避ける。
- Project 設定のために、個人アクセストークンを GitHub Actions の secret に保存しない。
- Milestone は自動設定しない。必要な作業単位が決まったときに手動で設定する。
- Project 設定が漏れた場合は、気づいた時点で手動で補正する。

## 例

```sh
git switch -c codex/setup-dev-docs
git commit -m "docs: Salesforce DX開発運用ルールを追加"
```
