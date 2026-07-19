# 組織操作ルール

この文書は、AI エージェントが接続中の Salesforce 組織へ validate / deploy / test / retrieve を実行するときの判断基準です。

## この文書の責務

- 操作対象となる org と alias
- deploy / retrieve scope
- validate、deploy、retrieve、Apex test の実行条件
- 開発中の動作確認 deploy、push 前の事前検証、通常開発外の deploy
- 実行結果と未実行項目の報告

Scratch Org の初期構築は [Scratch Org 再現ルール](scratch-org-rebuild-rules.md)、metadata の削除は [メタデータ削除ルール](metadata-deletion-rules.md)、テストデータ投入は [テストデータ投入手順](test-data-import.md) に従います。

## 絶対ルール

- 開発中の動作確認 deploy、push 前の validate / dry-run、通常開発外の deploy は、Git 差分に含まれる deploy 可能な metadata と、動作に必要なことを明示した依存 metadata だけを対象にする。
- `force-app` 全体、retrieve 用 manifest、Scratch Org 再構築用 manifest、org 全体を表す manifest を通常開発や deploy に使わない。
- 接続組織向けの再利用可能な全体 validate / deploy script と manifest は管理しない。
- PR の作成・マージ依頼は deploy の依頼を意味しない。組織反映が明示された場合も、依頼範囲外の metadata や org 全体を deploy する許可を意味しない。
- deploy 前に対象 org alias、org 種別、metadata の fullName、件数、差分外依存を提示し、その scope の deploy が明示承認された場合だけ実行する。
- 開発中の動作確認 deploy と push 前の validate / dry-run は、それぞれ実行時点の Git 差分から scope を決める。deploy 後に metadata を修正した場合は、scope を見直す。
- FlexiPage は、そのファイルが依頼された Git 差分に含まれ、deploy 対象として明示されている場合だけ scope に含める。
- 対象外 metadata が一件でも混ざる場合は実行を停止し、scope を修正する。広い scope のまま続行しない。
- 本番環境への deploy は、ユーザーが本番リリースを明示した場合だけ実行する。

## Scope の決定

Salesforce 組織操作の前に、次の順で scope を決めます。

1. `git status --short` と比較対象ブランチからの差分を確認する。
2. 差分から deploy 可能な metadata の type と fullName を列挙する。
3. 依存 metadata を追加する場合は、差分外であることと追加理由を明示する。
4. `--metadata`、`--source-dir`、または作業単位の一時 manifest で scope を表現する。
5. validate / dry-run または deploy 前に、対象 org alias、org 種別、metadata の fullName、件数、差分外依存を提示する。
6. deploy 前に提示した scope の明示承認を得る。

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

## 開発中の動作確認 deploy

振る舞いを変更した場合は、実装が org 上で確認できる状態になった時点で、Git 差分から deploy 対象を特定します。対象の開発 org の alias と org 種別、metadata の type と fullName、件数、差分外依存を提示し、限定 scope の deploy が明示承認された後に開発 org へ deploy して、org 上で動作確認します。Production org は開発中の動作確認に使いません。

動作確認で修正が必要になった場合は実装へ戻り、振る舞いへ影響する修正後の scope を見直して、必要な deploy と動作確認を繰り返します。この反復ごとに、全体テスト、関連文書更新、Code Analyzer、validate、dry-runを必須化しません。途中コミットでは既存のコミットフックを省略せず、通常どおり実行します。

コメント、文書、フォーマットだけの変更や、振る舞いを変えない内部整理では、開発 org への deploy と org 上の動作確認を必須にしません。

## push 前の検証

コミット後・push 前に、PR の deploy 可能な差分と明示した依存 metadata だけを含む scope で最終 validate または dry-run を実行します。確認後に deploy 対象 metadata を修正した場合だけ、変更をコミットして該当確認と validate または dry-run を再実行します。

docs-only と、組織から retrieve した状態を Git に記録するだけの retrieve-only 変更では、Salesforce validate または dry-run を実行しません。変更内容に応じたローカルチェックと retrieve 差分確認を行います。retrieve 後に metadata を編集して組織反映対象とした場合は retrieve-only と扱わず、通常の validate または dry-run 対象とします。

PR のマージ依頼では、PR マージ、`main` 同期、作業ブランチ整理までを行い、deploy は行いません。

## 通常開発外の deploy

本番 release や通常開発外の組織反映は別タスクとして扱い、ユーザーが対象 org への deploy を明示した場合だけ行います。マージ済み変更を `main` から deploy する場合は、次をすべて満たす必要があります。

- `main`が`origin/main`と一致している。
- 作業ツリーがクリーンである。
- deploy 対象の fullName、件数、内容を確認できる。
- 対象内容に対する validate または dry-run が成功している。内容が変わっている場合は再実行する。
- 対象 org alias が確認済みである。
- 対象 org と scope の deploy が明示承認されている。

scope を再現できない場合、または validate 後に対象内容が変わっている場合は deploy せず、scope の修正または再検証を行います。deploy のために全体 manifestへ切り替えてはいけません。

次は通常、deploy の対象外です。

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
- deploy コマンド

初回構築用の scope はそのタスク内で一時的に作成し、通常開発から呼べる npm script や恒久的な接続組織向け全体 manifest として残しません。

## CI

GitHub Actions は、依存監査、整形、文書、lint、Code Analyzer、スクリプトテスト、LWC Jestなど、組織へ接続しない品質確認を実行します。

CI から接続 org へログインして全体 manifest を validate しません。Salesforce org での validate / dry-run は、push 前に限定 scope と対象 org を確認して実行し、結果を PR へ記録します。

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
