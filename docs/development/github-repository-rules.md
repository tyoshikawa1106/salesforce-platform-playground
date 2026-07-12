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

- 作業開始時に対応Issueと現在のrepository stateを確認する。
- Salesforceメタデータ変更を含む場合は、merge前に対象組織に応じたvalidateまたはdry-runを確認する。
- PR作成・更新後は、assignee、labels、Project紐づけを確認する。
- merge後に必要なSalesforce deployとProject status更新を行う。

Salesforceの対象org、scope、validate、deploy、retrieve、testの詳細は [Salesforce 組織操作ルール](../deployment/salesforce-org-operation-rules.md) を正とします。

### PR merge後の作業branch整理

PR merge後は、次の条件をすべて満たす場合に限り、エージェントが明示確認なしで作業branch整理を実行してよいです。

- PRがmerge済みであることを確認できる。
- 作業ツリーがcleanで、未コミット変更がない。
- 現在の作業branchがmerge済みPRのbranchであることを確認できる。
- `main`へ戻り、`git pull --ff-only`で同期できる。
- 作業branchを`git branch -d <branch>`で削除できる。
- 対応するremote作業branchが残っている場合は、`git push origin --delete <branch>`で削除できる。

次の場合は自動実行せず、ユーザーに確認します。

- 未コミット変更がある。
- PRのmerge状態や削除対象branchを確認できない。
- `git pull --ff-only`が失敗する。
- branch削除に`git branch -D`が必要になる。
- remote branchが保護対象、共有作業中、または削除可否を確認できない。
- push、PR作成、CI確認、mergeなど、作業branch整理の範囲を超える操作が必要になる。

### PR merge前のSalesforce preflight

Salesforceメタデータ変更を含むPRは、merge前に [Salesforce 組織操作ルール](../deployment/salesforce-org-operation-rules.md#pr-merge-前-preflight) に従って、対象組織に応じたvalidateまたはdry-runを実行します。対象org、組織種別、deploy可能な変更、scope、実行結果を確認できない場合はmergeしません。

### PR merge後のSalesforce deploy

Salesforceメタデータ変更を含むPRのmerge依頼では、[Salesforce 組織操作ルール](../deployment/salesforce-org-operation-rules.md#deploy) に従って、merge後に同期したcleanな`main`から必要なdeployと確認まで実行します。PR branchからの実deployは標準フローにしません。

## リリースノート

このリポジトリのリリースノートはGitHub Releaseを正式な記録として扱います。ユーザーが「昨日のリリースノート」「今日のリリースノート」「リリースノートを更新」と依頼した場合は、明示的にdraftやローカル文書を求められていない限り、日次GitHub Releaseの作成または確認として扱います。

- 日付はJSTの暦日として明示する。
- タグ名は`vYYYY.MM.DD`形式にする。
- 既存のtagとreleaseを確認し、同じ日付のreleaseを重複作成しない。
- タグは対象日の`origin/main`における最後のfirst-parent merge commitに作成する。単に現在の`HEAD`へタグを打たない。
- 前回の日次タグをcompare開始点にし、`.github/release.yml`の設定でGitHub Release notesを生成する。
- 作成後はtagの参照先、releaseのcompare範囲、latest状態を確認する。

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

## 命名

| 対象               | 形式                      |
| ------------------ | ------------------------- |
| 作業branch         | `feature/<summary>`       |
| Codex作業branch    | `codex/<summary>`         |
| コミットメッセージ | `<type>: <日本語summary>` |
| PR title           | `<type>: <日本語summary>` |

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

| label             | 用途                                    |
| ----------------- | --------------------------------------- |
| `area:apex`       | Apexクラス、Trigger、Apex test          |
| `area:metadata`   | Object、Field、Flow、Permission Set     |
| `area:deployment` | deploy、retrieve、destructive changes   |
| `area:github`     | Issue、PR、GitHub Actions、テンプレート |
| `area:testing`    | テスト、検証、coverage                  |

GitHub標準ラベルの`bug`、`documentation`、`enhancement`、`question`も、内容に合う場合は利用します。

### Assignee

IssueとPRには、作成時にassigneeを設定します。

- 特別な指定がない場合はGitHub操作の実行者をassigneeにする。
- エージェントは`gh api user`などで現在の実行者を確認する。
- 実行者をassigneeにできない場合、または担当者が不明な場合はユーザーに確認する。
- 作業対象のIssue / PRでassignee未設定に気づいた場合は、同じ方針で補正する。
- 特定の個人ユーザー名を運用ルールやautomation configに固定しない。
- authorは作成者、assigneeは現在の担当者として扱う。

## リポジトリ保護と自動化

### Branch protection

- `main`はPull Request経由の変更を前提にする。
- required status checksは`npm checks`を必須にし、最新の`main`を基準に実行する。
- repository administratorにもbranch protectionを適用する。
- merge前に未解決のreview conversationがないことを必須にする。
- CODEOWNERSによる必須reviewは現在の要件にしない。
- `main`へのforce pushとbranch deletionは許可しない。
- GitHub側設定を変える場合は、現在のrepository stateを確認してから別タスクで扱う。

### GitHub Actions

- GitHub ActionsはCI、静的解析、secret scanなどの品質確認に使う。
- assignee、label、Milestone、Projectなどの運用metadataはActionsで自動化しない。
- CI workflowは`permissions: contents: read`を基本にし、必要な権限だけを明示する。
- 現行CIは`npm ci`、`npm audit --omit=dev`、Prettier、docs check、lint、Code Analyzer、LWC unit testを実行する。
- Salesforce JWT認証用Secretsが揃っている場合はSalesforce validateも実行する。詳細は [CI Salesforce validateルール](../deployment/ci-salesforce-validate-rules.md) に従う。

### Dependabot

- Dependabot alertsとsecurity updatesは既知脆弱性の検出と修正PR作成に使う。
- version updatesはnpm依存更新PRを週次で作成するために使う。
- Dependabot PRには`enhancement`と`area:testing`を付ける。
- repository ownerを都度確認し、reviewerに設定する。
- 取り込む場合はrepository ownerのreviewとしてapproveしてからmergeする。
- 見送る場合は理由を書いたrequest changes reviewを残してからcloseする。
- configには個人ユーザー名をassigneeやreviewerとして固定しない。
- Project紐づけや担当者設定は必要に応じて手動で確認する。

## ProjectとMilestone

### Project

IssueとPRは、このリポジトリ用のProjectに紐づけます。

- Projectは`Salesforce Platform Playground`を使う。
- 新規Issue / PRのProjectは手動で設定する。
- Project追加は`gh project item-add ...`などで明示的に実行する。
- Project番号やownerを固定値にせず、Project titleから対象を解決する。
- Project紐づけの確認は対象Issue / PRのitemだけを見る。
- Project設定用の個人アクセストークンをGitHub Actionsのsecretに保存しない。
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
