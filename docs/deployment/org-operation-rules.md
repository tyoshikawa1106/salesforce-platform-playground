# 組織操作ルール

この文書は、AI エージェントが接続中の Salesforce 組織へ validate / deploy / test / retrieve を実行するときの判断基準です。

## この文書の責務

- 操作対象となる org と alias
- deploy / retrieve scope
- validate、deploy、retrieve、Apex test の実行条件
- PR マージ前の事前検証とマージ後 deploy
- 実行結果と未実行項目の報告

Scratch Org の初期構築は [Scratch Org 再現ルール](scratch-org-rebuild-rules.md)、metadata の削除は [メタデータ削除ルール](metadata-deletion-rules.md)、テストデータ投入は [テストデータ投入手順](test-data-import.md) に従います。

## 絶対ルール

- 通常開発の validate / deploy は、Git 差分に含まれる deploy 可能な metadata と、動作に必要なことを明示した依存 metadata だけを対象にする。
- `force-app` 全体、retrieve 用 manifest、Scratch Org 再構築用 manifest、組織全体を表す manifest を通常開発や PR マージ後 deploy に使わない。
- 接続組織向けの再利用可能な全体 validate / deploy script と manifest は管理しない。
- PR の作成、マージ、または「デプロイして」という依頼は、依頼範囲外の metadata や組織全体を deploy する許可を意味しない。
- 実 deploy前に対象org alias、metadataのfullName、件数を提示し、そのscopeの実deployが明示承認された場合だけ実行する。
- validate と実 deploy は、確認済みの同一 scope を使う。マージ後も scope を追加しない。
- FlexiPage は、そのファイルが依頼された Git 差分に含まれ、deploy 対象として明示されている場合だけ scope に含める。
- 対象外 metadata が一件でも混ざる場合は実行を停止し、scope を修正する。広い scope のまま続行しない。
- 本番環境への deploy は、ユーザーが本番リリースを明示した場合だけ実行する。

## Scope の決定

Salesforce 組織操作の前に、次の順で scope を決めます。

1. `git status --short` と比較対象ブランチからの差分を確認する。
2. 差分から deploy 可能な metadata の type と fullName を列挙する。
3. 依存 metadata を追加する場合は、差分外であることと追加理由を明示する。
4. `--metadata`、`--source-dir`、または作業単位の一時 manifest で scope を表現する。
5. validate / dry-run 前に、対象 org alias、metadata の fullName、件数、差分外依存を提示する。
6. 実 deploy 前に、validate 済み scope と完全に一致することを再確認し、そのscopeの明示承認を得る。

作業単位の一時 manifest は、その変更だけを列挙します。別タスクで再利用せず、汎用的な全体 deploy の入口として Git 管理しません。

## 対象組織

個別指定がない場合は、現在の default target org を確認します。

```sh
sf config get target-org
```

後続のコマンドでは、確認済みの alias を必ず `--target-org <alias>` で明示します。明示依頼なしに default target org を変更しません。`sf org display --json`などtokenを含み得る出力は、必要性が明確な場合だけ使います。

## Validate / dry-run

Production 組織と、このリポジトリで実行確認済みの Developer Edition では、限定 scope で `deploy validate` を使います。

```sh
sf project deploy validate \
    --metadata ApexClass:MyService \
    --metadata ApexClass:MyServiceTest \
    --test-level RunLocalTests \
    --target-org <alias>
```

Sandbox と Scratch Org では、同じ限定 scope で dry-run を使います。

```sh
sf project deploy start \
    --dry-run \
    --metadata ApexClass:MyService \
    --metadata ApexClass:MyServiceTest \
    --test-level RunLocalTests \
    --target-org <alias> \
    --wait 30
```

複数 type を含む場合も、対象 fullName を省略しません。`--source-dir force-app`は通常開発の検証に使いません。

## 開発中の deploy

Apex、LWC、または関連 metadata の振る舞いを変更した場合は、確認済みの非本番組織へ作業単位の scope で実 deploy します。

```sh
sf project deploy start \
    --metadata ApexClass:MyService \
    --metadata ApexClass:MyServiceTest \
    --target-org <alias> \
    --wait 30
```

依存する LWC、Permission Set、Custom Field などがある場合は、それぞれの type と fullName を明示して同じ scope に含めます。validate 成功だけで動作確認可能とは扱いません。

## PR マージ前とマージ後

PR 作成前またはマージ前に、PR の deploy 可能な差分と明示した依存 metadata だけを含む scope で最終 validate または dry-run を実行します。

マージ後は次をすべて満たした場合だけ、同じ scope で実 deploy します。

- `main`が`origin/main`と一致している。
- 作業ツリーがクリーンである。
- マージ前に成功した scope の fullName 一覧と件数を確認できる。
- マージ後の scope がその一覧と一致し、追加 metadata がない。
- 対象 org alias が確認済みである。

scope を再現できない場合、または新しい metadata が加わる場合は deploy せず、ユーザーに確認します。マージ後 deploy のために全体 manifestへ切り替えてはいけません。

次の場合はマージ後 deploy の対象外です。

- docs-only PR
- retrieve-only PR
- ユーザーが本番リリースを明示していない本番環境

## 組織の初回構築・再構築

接続組織の初回構築または再構築は通常開発とは別タスクです。ユーザーが「初回構築」または「再構築」を明示し、次の情報を確認したうえで個別に承認した場合だけ実行します。

- 対象 org alias と組織種別
- 全 metadata の type、fullName、件数
- 既存設定への上書き影響
- バックアップまたは復旧方法
- validate / dry-run 結果
- 実 deploy コマンド

初回構築用の scope はそのタスク内で一時的に作成し、通常開発から呼べる npm script や恒久的な接続組織向け全体 manifest として残しません。

## CI

GitHub Actions は、依存監査、整形、文書、lint、Code Analyzer、スクリプトテスト、LWC Jestなど、組織へ接続しない品質確認を実行します。

CI から接続組織へログインして全体 manifest を validate しません。Salesforce 組織での validate / dry-run は、PR 作成前に限定 scope と対象 orgを確認して実行し、結果をPRへ記録します。

## Apex test

Apexを含む変更では、関連テストをカバレッジ付きで実行します。

```sh
sf apex run test \
    --class-names MyServiceTest \
    --code-coverage \
    --result-format human \
    --target-org <alias>
```

関連するController、Service、Selector、Wrapperなどのクラス別coverageも確認します。

## 報告ルール

Salesforce組織操作後は次を報告します。

- 対象 org alias
- validate / deploy / test の区分
- 対象 metadata の type、fullName、件数
- Git 差分外の依存 metadata と追加理由
- 実行コマンドと結果
- Apexテスト件数と関連クラスcoverage
- 実行しなかった確認と理由

実ユーザー名、メールアドレス、org ID、org 固有 URL、tokenは報告へ含めません。
