# リポジトリ固有 GitHub 運用ルール

この文書は、`salesforce-platform-playground`で [GitHub 運用ルール](github-rules.md) に追加適用する固有ルールです。Issue、テンプレート、ラベル、担当者、Project、Milestone、Release、CI、Salesforce組織操作との連携を定義します。

## IssueとPR

- Issueは`.github/ISSUE_TEMPLATE/`の内容に従って作成する。
- PR本文は`.github/pull_request_template.md`の構成に従って作成する。
- PRは、対応する実在Issueを必ず持つものとして扱う。
- PR作成前に対応Issueが存在することを確認する。
- 対応Issueがない場合は、PR作成前にIssueを作成するか、ユーザーに確認する。
- PR本文の`Issue`には`Closes #<issue番号>`を記載する。
- IssueなしのPRは、ユーザーが明示的に例外として許可した場合だけ作成する。
- Issueなし例外の場合も、PR本文に理由と承認された例外であることを書く。

## GitHub Flowへの追加確認

- 作業開始時に対応Issueと現在のリポジトリの状態を確認する。
- Salesforce metadata変更を含む場合は、push前に対象orgに応じたvalidateまたはdry-runを確認する。
- PR作成・更新後は、担当者、ラベル、Project紐づけを確認する。
- マージ後にProjectステータス更新と作業ブランチ整理を行う。同じフローでマージ後のdeployは行わず、本番releaseなど通常開発外のdeployは明示された別タスクとして扱う。
- ユーザーからマージ方式の指定がない場合はマージコミットを使う。squashマージまたはrebaseマージは、ユーザーから明示指定がある場合だけ使う。

Salesforceの対象org、scope、validate、deploy、retrieve、testの詳細は [組織操作ルール](../deployment/org-operation-rules.md) を正とします。

### PR マージ後の作業ブランチ整理

PR マージ後は、次の条件をすべて満たす場合に限り、エージェントが明示確認なしで作業ブランチ整理を実行してよいです。

- PRがマージ済みであることを確認できる。
- 作業ツリーがクリーンで、未コミット変更がない。
- 現在の作業ブランチがマージ済みPRのブランチであることを確認できる。
- `main`へ戻り、`git pull --ff-only`で同期できる。
- 作業ブランチを`git branch -d <branch>`で削除できる。
- 対応するリモート作業ブランチが残っている場合は、`git push origin --delete <branch>`で削除できる。

次の場合は自動実行せず、ユーザーに確認します。

- 未コミット変更がある。
- PRのマージ状態や削除対象ブランチを確認できない。
- `git pull --ff-only`が失敗する。
- ブランチ削除に`git branch -D`が必要になる。
- リモートブランチが保護対象、共有作業中、または削除可否を確認できない。
- プッシュ、PR作成、CI確認、マージなど、作業ブランチ整理の範囲を超える操作が必要になる。

### push前のSalesforce事前検証

org反映を目的とするSalesforce metadata変更を含むPRは、push前に [組織操作ルール](../deployment/org-operation-rules.md#push-前の検証) に従って、対象orgに応じたvalidateまたはdry-runを実行します。対象org、org種別、deploy可能な変更、scope、実行結果を確認できない場合はpushしません。PR上でdeploy対象metadataを修正した場合も、再push前に必要な検証を行います。docs-onlyと、orgから取得した状態を記録するだけのretrieve-only変更はSalesforce validateまたはdry-runの対象外とします。

### 開発中のSalesforce deploy

振る舞いを変更した場合は、[組織操作ルール](../deployment/org-operation-rules.md#開発中の動作確認-deploy) に従い、対象の開発orgと限定scopeを提示してdeploy承認を受け、開発orgへdeployしてorg上で動作確認します。push前には追加のdeployを行わず、最終差分のvalidateまたはdry-runを実行します。PRの作成・マージ依頼ではdeployしません。

## リリースノート

このリポジトリのリリースノートはGitHub Releaseを正式な記録として扱います。ユーザーが「昨日のリリースノート」「今日のリリースノート」「リリースノートを更新」と依頼した場合は、明示的にドラフトやローカル文書を求められていない限り、日次GitHub Releaseの作成または確認として扱います。

- 日付はJSTの暦日として明示する。
- タグ名は`vYYYY.MM.DD`形式にする。
- 既存のタグとリリースを確認し、同じ日付のリリースを重複作成しない。
- タグは対象日の`origin/main`における最後の`first-parent`コミットに作成する。単に現在の`HEAD`へタグを打たない。
- 前回の日次タグを比較開始点にし、`.github/release.yml`の設定でGitHubリリースノートを生成する。
- 作成後はタグの参照先、リリースの比較範囲、`latest`状態を確認する。

標準手順:

```sh
git status --short --branch
git pull --ff-only
git tag --list 'v20*' --sort=-v:refname
git log origin/main --first-parent --since='<YYYY-MM-DD 00:00:00 +0900>' --until='<YYYY-MM-DD 23:59:59 +0900>' --format='%H' --max-count=1
gh api repos/<owner>/<repo>/git/ref/tags/vYYYY.MM.DD
gh api repos/<owner>/<repo>/releases/tags/vYYYY.MM.DD
git tag vYYYY.MM.DD <target-commit>
git push origin vYYYY.MM.DD
gh release create vYYYY.MM.DD --verify-tag --notes-start-tag <previous-tag> --generate-notes --latest --title vYYYY.MM.DD
gh api repos/<owner>/<repo>/git/ref/tags/vYYYY.MM.DD
gh api repos/<owner>/<repo>/releases/tags/vYYYY.MM.DD
gh release list --json tagName,isLatest,publishedAt --limit 5
```

## 命名

| 対象              | 形式                     |
| ----------------- | ------------------------ |
| 作業ブランチ      | `feature/<summary>`      |
| Codex作業ブランチ | `codex/<summary>`        |
| コミット件名      | `<type>: <日本語の要約>` |
| PRタイトル        | `<type>: <日本語の要約>` |

### type

| type       | 用途                   |
| ---------- | ---------------------- |
| `feat`     | 機能追加               |
| `fix`      | 不具合修正             |
| `docs`     | ドキュメント変更       |
| `test`     | テスト追加、修正       |
| `refactor` | 振る舞いを変えない整理 |
| `style`    | 見た目や整形の変更     |
| `ci`       | CI設定の変更           |
| `chore`    | その他の保守作業       |
| `revert`   | 変更の取り消し         |

## ラベルと担当者

### ラベル

GitHubのIssueとPRには必ずラベルを付けます。

- Issue作成時は、内容に合う分類ラベルを付ける。
- PR作成時は、対応Issueと同じ観点でラベルを付ける。
- エージェントがPRを作成する場合は、対応Issueのラベルを確認する。
- エージェントがPRを作成・更新した後は、IssueとPRのラベルがずれていないか確認する。
- 迷う場合はGitHub標準ラベルから内容に合うものを選び、必要に応じて`area:*`を追加する。
- 定義済みのラベルがGitHubに存在しない場合や、新しいラベルが必要な場合は、勝手に作成せずユーザーに確認する。

| ラベル            | 用途                                    |
| ----------------- | --------------------------------------- |
| `area:apex`       | Apexクラス、Trigger、Apexテスト         |
| `area:metadata`   | Object、Field、Flow、Permission Set     |
| `area:deployment` | deploy、retrieve、destructive changes   |
| `area:github`     | Issue、PR、GitHub Actions、テンプレート |
| `area:testing`    | テスト、検証、カバレッジ                |

GitHub標準ラベルの`bug`、`documentation`、`enhancement`、`question`も、内容に合う場合は利用します。

### 担当者

IssueとPRには、作成時に担当者を設定します。

- 特別な指定がない場合はGitHub操作の実行者を担当者にする。
- エージェントは`gh api user`などで現在の実行者を確認する。
- 実行者を担当者にできない場合、または担当者が不明な場合はユーザーに確認する。
- 作業対象のIssue / PRで担当者未設定に気づいた場合は、同じ方針で補正する。
- 特定の個人ユーザー名を運用ルールや自動化設定に固定しない。
- 作成者と担当者を区別し、担当者は現在の作業担当として扱う。

## リポジトリ保護と自動化

### ブランチ保護

- `main`はPull Request経由の変更を前提にする。
- 必須ステータスチェックは`npm checks`とし、最新の`main`を基準に実行する。
- リポジトリ管理者にもブランチ保護を適用する。
- マージ前に未解決のレビュー指摘がないことを必須にする。
- CODEOWNERSによる必須レビューは現在の要件にしない。
- `main`へのフォースプッシュとブランチ削除は許可しない。
- GitHub側設定を変える場合は、現在のリポジトリの状態を確認してから別タスクで扱う。

### GitHub Actions

- GitHub ActionsはCI、静的解析、シークレットスキャンなどの品質確認に使う。
- 担当者、ラベル、Milestone、Projectなどの運用メタデータはGitHub Actionsで自動化しない。
- CIワークフローは`permissions: contents: read`を基本にし、必要な権限だけを明示する。
- 現行CIは`npm ci`、`npm audit --audit-level=high`、Prettier、ドキュメント検証、ESLint、SLDS Linter、Code Analyzer、LWC単体テストを実行する。
- CIの`npm audit`は`dependencies`と`devDependencies`を対象にし、`high` / `critical`の既知脆弱性が新たに混入することを防ぐ。
- `high` / `critical`を一時的に許容する必要がある場合は、対象パッケージ、影響、許容理由、見直し期限、追跡Issueを記録し、監査対象や失敗条件を理由なく弱めない。
- Salesforce JWT認証用シークレットが揃っている場合はSalesforce validateも実行する。詳細は [CI メタデータ検証ルール](../deployment/ci-metadata-validation-rules.md) に従う。

### Dependabot

- Dependabot alertsとsecurity updatesは既知脆弱性の継続監視と修正PR作成に使う。CIの`npm audit`は変更時の混入防止、Dependabotは継続的な検出と更新提案を担当する。
- version updatesはnpm依存とGitHub Actionsの更新PRを週次で作成するために使う。
- npm依存更新PRには`enhancement`と`area:testing`、GitHub Actions更新PRには`enhancement`と`area:github`を付ける。
- リポジトリ所有者を都度確認し、レビュー担当者に設定する。
- 取り込む場合はリポジトリ所有者が承認レビューを行ってからマージする。
- 見送る場合は理由を書いた変更要求レビューを残してからクローズする。
- 設定ファイルには個人ユーザー名を担当者やレビュー担当者として固定しない。
- Dependabot PRも、作成後に担当者とProjectを手動で設定する。

## ProjectとMilestone

### Project

IssueとPRは、このリポジトリ用のProjectに紐づけます。

- Projectは`Salesforce Platform Playground`を使う。
- 新規Issue / PRのProjectは手動で設定する。
- Project追加は`gh project item-add ...`などで明示的に実行する。
- Project番号や所有者を固定値にせず、Project名から対象を解決する。
- Project紐づけの確認は対象Issue / PRの項目だけを見る。
- Project設定用の個人アクセストークンをGitHub Actionsのシークレットに保存しない。
- 設定漏れは気づいた時点で手動補正する。

### Milestone

- 期限やリリースなどの作業単位が明確な場合だけIssueとPRへ設定する。
- 対象が不明な場合は勝手に作成せず、Milestoneなしで進める。
- 新しく作成する必要がある場合はユーザーに確認する。

## 例

```sh
git switch -c codex/setup-dev-docs
git commit -m "docs: Salesforce DX開発運用ルールを追加" \
    -m "開発環境の構築手順と検証コマンドを整理する。" \
    -m "検証: npm run docs:check と npm run prettier:verify が成功。"
```
