# GitHub 運用ルール

このリポジトリでは GitHub Flow で開発します。

`docs/development/documentation-rules.md` のフォルダ配置ルールは、GitHub 運用ルールとは独立した共通ルールとして扱います。

## 基本ルール

GitHub 作業の基本境界は `AGENTS.md` に従います。このファイルには Issue、PR、label、assignee、Project、CI などの詳細運用を置きます。

- Issue は `.github/ISSUE_TEMPLATE/` の内容に従って作成する。
- PR 本文は `.github/pull_request_template.md` の構成に従って作成する。
- ブランチ名には作業内容が分かる短い summary を入れる。
- hook が依存不足で失敗した場合、勝手に依存を導入せず確認する。

## このリポジトリ固有の運用

次の運用は、このリポジトリの GitHub 運用として扱います。

## Issue ルール

PR は、対応する実在 Issue を必ず持つものとして扱います。

- PR 作成前に、対応 Issue が存在することを確認する。
- 対応 Issue がない場合は、PR 作成前に Issue を作成するか、ユーザーに確認する。
- PR 本文の `Issue` には `Closes #<issue番号>` を記載する。
- Issue なしの PR は、ユーザーが明示的に例外として許可した場合だけ作成する。
- Issue なし例外の場合も、PR 本文に理由と承認された例外であることを書く。

## PR マージ後の作業ブランチ整理

PR マージ後は、次の条件をすべて満たす場合に限り、エージェントが明示確認なしで作業ブランチ整理を実行してよい。

- PR がマージ済みであることを確認できる。
- 作業ツリーが clean で、未コミット変更がない。
- 現在の作業ブランチがマージ済み PR のブランチであることを確認できる。
- `main` へ戻り、`git pull --ff-only` で同期できる。
- 作業ブランチを `git branch -d <branch>` で削除できる。
- 対応する remote 作業ブランチが残っている場合は、`git push origin --delete <branch>` で削除できる。

次の場合は自動実行せず、ユーザーに確認する。

- 未コミット変更がある。
- PR のマージ状態や削除対象ブランチを確認できない。
- `git pull --ff-only` が失敗する。
- ブランチ削除に `git branch -D` が必要になる。
- remote ブランチが保護対象、共有作業中、または削除可否を確認できない。
- push、PR 作成、CI 確認、merge など、作業ブランチ整理の範囲を超える操作が必要になる。

## リリースノート

このリポジトリのリリースノートは GitHub Release を正本とします。ユーザーが「昨日のリリースノート」「今日のリリースノート」「リリースノートを更新」と依頼した場合は、明示的に draft やローカル文書を求められていない限り、日次 GitHub Release の作成または確認として扱います。

- 日付は JST の暦日として明示する。
- タグ名は `vYYYY.MM.DD` 形式にする。
- 既存の tag と release を確認し、同じ日付の release を重複作成しない。
- タグは対象日の `origin/main` における最後の first-parent merge commit に作成する。単に現在の `HEAD` へタグを打たない。
- 前回の日次タグを compare 開始点にし、`.github/release.yml` の設定で GitHub Release notes を生成する。
- 作成後は tag の参照先、release の compare 範囲、latest 状態を確認する。

標準手順:

```sh
git status --short --branch
git pull --ff-only
git tag --list 'v20*' --sort=-v:refname
git log origin/main --first-parent --merges --since='<YYYY-MM-DD 00:00:00 +0900>' --until='<YYYY-MM-DD 23:59:59 +0900>'
gh api repos/<owner>/<repo>/git/ref/tags/vYYYY.MM.DD
gh api repos/<owner>/<repo>/releases/tags/vYYYY.MM.DD
git tag vYYYY.MM.DD <target-merge-commit>
git push origin vYYYY.MM.DD
gh release create vYYYY.MM.DD --verify-tag --notes-start-tag <previous-tag> --generate-notes --latest --title vYYYY.MM.DD
gh api repos/<owner>/<repo>/git/ref/tags/vYYYY.MM.DD
gh api repos/<owner>/<repo>/releases/tags/vYYYY.MM.DD
gh release list --json tagName,isLatest,publishedAt --limit 5
```

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

検証: sf code-analyzer run は違反 0 件。npm run sf:validate:dev は `<alias>` で成功し、対象 Apex テスト 10 件が通過。
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

## リポジトリ保護ルール

- `main` は Pull Request 経由の変更を前提にする。
- `main` の required status checks は `npm checks` を必須にする。
- `main` への force push と branch deletion は許可しない。
- branch protection、secret scanning、Dependabot などの GitHub 側設定を変える場合は、現在の repository state を確認してから別タスクで扱う。

## Assignee ルール

Issue と PR には、作成時に assignee を設定します。

- 特別な指定がない場合は、GitHub 操作の実行者を assignee にする。
- エージェントが Issue / PR を作成する場合は、`gh api user` などで現在の実行者を確認し、作成コマンドで assignee を指定する。
- 実行者を assignee にできない場合、または担当者が不明な場合は、勝手に repository owner へ割り当てずユーザーに確認する。
- 作業対象の Issue / PR で assignee 未設定に気づいた場合は、同じ方針で補正する。
- 特定の個人ユーザー名を運用ルールや automation config に固定しない。
- author は作成者、assignee は現在の担当者として扱う。
- PR 作成・更新後は、`assignees`、`labels`、Project 紐づけを確認する。

## GitHub Actions

- GitHub Actions は CI、静的解析、secret scan など、変更内容の品質確認に使う。
- assignee、label、milestone、Project 追加、Project status 更新などの運用メタデータ整理は Actions で自動化せず、エージェントまたはユーザーが明示的に行う。
- CI workflow は `permissions: contents: read` を基本にし、必要な権限だけを明示する。
- 最小 CI は `npm ci`、`npm audit --omit=dev`、lint、LWC unit test を実行する。

## Dependabot

- Dependabot alerts と security updates は、既知脆弱性の検出と修正 PR 作成に使う。
- Dependabot version updates は、通常の npm 依存更新 PR を週次で作成するために使う。
- Dependabot PR には `enhancement` と `area:testing` を付ける。
- Dependabot PR には、assignee と同じ考え方でそのリポジトリの owner を都度確認し、reviewer に設定する。
- Dependabot PR を取り込む場合は、確認後にそのリポジトリの owner の review として approve してから merge する。
- Dependabot PR を見送って close する場合は、理由を書いた request changes review を残してから close する。
- Dependabot config には個人ユーザー名を assignee や reviewer として固定しない。
- Dependabot PR の Project 紐づけや担当者設定は、必要に応じて手動で確認する。

## Project ルール

Issue と PR は、このリポジトリ用の Project に紐づけます。

- Project は `Salesforce Platform Playground` を使う。
- 新規 Issue / PR の Project は手動で設定する。
- Project 追加は `gh project item-add ...` などで、エージェントまたはユーザーが明示的に実行する。
- Project の番号や owner は固定値を前提にせず、Project title から対象 Project を解決してから追加する。
- Project 紐づけの確認は対象 Issue / PR の item だけを見る。Project 全件を取得して絞り込む運用は避ける。
- Project 設定のために、個人アクセストークンを GitHub Actions の secret に保存しない。
- Project 設定が漏れた場合は、気づいた時点で手動で補正する。

## Milestone ルール

- 期限やリリースなどの作業単位が明確な場合だけ、Issue と PR に Milestone を設定する。
- Milestone が未作成、またはどの Milestone に入れるべきか判断できない場合は、勝手に作成せず Milestone なしで進める。
- Milestone を新しく作成する必要がある場合は、ユーザーに確認してから作成する。

## 例

```sh
git switch -c codex/setup-dev-docs
git commit -m "docs: Salesforce DX開発運用ルールを追加"
```
