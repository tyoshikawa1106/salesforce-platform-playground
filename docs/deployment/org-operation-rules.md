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
- PRの作成・マージ依頼はdeployの依頼を意味しない。マージ依頼の完了範囲はPRマージ、`main`同期、作業ブランチ整理までとする。組織反映が明示された場合も、依頼範囲外のmetadataやorg全体をdeployする許可を意味しない。
- FlexiPage は、そのファイルが依頼された Git 差分に含まれ、deploy 対象として明示されている場合だけ scope に含める。
- 対象外 metadata が一件でも混ざる場合は実行を停止し、scope を修正する。広い scope のまま続行しない。

## Scope の決定

validate・deployの前に、実行時点の差分から次の順でscopeを決めます。

1. `git status --short` と比較対象ブランチからの差分を確認する。
2. 差分から deploy 可能な metadata の type と fullName を列挙する。
3. 依存 metadata を追加する場合は、差分外であることと追加理由を明示する。
4. `--metadata`、`--source-dir`、または作業単位の一時 manifest で scope を表現する。
5. validate / dry-run または deploy 前に、対象 org alias、org 種別、metadata の fullName、件数、差分外依存を提示する。
6. deploy 前に提示した scope の明示承認を得る。

作業単位の一時manifestは、その変更だけを列挙し、別タスクへ流用しません。接続組織向けの再利用可能な全体validate・deploy用scriptやmanifestは管理しません。

## 対象組織

個別指定がない場合は、現在の default target org を確認します。

```sh
sf config get target-org
```

後続のコマンドでは、確認済みの alias を必ず `--target-org <alias>` で明示します。明示依頼なしに default target org を変更しません。`sf org display --json`などtokenを含み得る出力は、必要性が明確な場合だけ使います。

## Validate / dry-run

`sf project deploy validate`とdry-runは反映前の検証であり、組織へ変更を反映しません。`sf project deploy preview`は標準の確認手段にせず、Git差分と対象組織に応じたvalidateまたはdry-runで確認します。組織種別はlogin URLだけで判断せず、対象orgを変更する際に種別と使用コマンドを確認します。

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

複数typeを含む場合も、対象fullNameを省略しません。

## 開発中の動作確認 deploy

振る舞いを変更した場合は、実装がorg上で確認できる状態になった時点で開発orgへdeployし、動作確認します。Production orgは開発中の動作確認に使いません。

動作確認で修正が必要になった場合は実装へ戻り、振る舞いへ影響する修正後の scope を見直して、必要な deploy と動作確認を繰り返します。この反復ごとに、全体テスト、関連文書更新、Code Analyzer、validate、dry-runを必須化しません。

コメント、文書、フォーマットだけの変更や、振る舞いを変えない内部整理では、開発 org への deploy と org 上の動作確認を必須にしません。

## push 前の検証

コミット後・push前に最終validateまたはdry-runを実行します。対象org、org種別、deploy可能な変更、scope、検証結果を確認できない場合はpushしません。Apexを含む場合は、その最終差分に対するテスト結果とcoverageを確認します。確認後に deploy 対象 metadata を修正した場合だけ、変更をコミットして該当確認と validate または dry-run を再実行します。

docs-only と、組織から retrieve した状態を Git に記録するだけの retrieve-only 変更では、Salesforce validate または dry-run を実行しません。変更内容に応じたローカルチェックと retrieve 差分確認を行います。retrieve 後に metadata を編集して組織反映対象とした場合は retrieve-only と扱わず、通常の validate または dry-run 対象とします。

## 通常開発外の deploy

本番releaseや通常開発外の組織反映は別タスクとして扱い、ユーザーが対象orgへのdeployを明示した場合だけ行います。本番環境では、本番releaseの明示依頼が必要です。マージ済み変更を`main`からdeployする場合は、次をすべて満たす必要があります。

- `main`が`origin/main`と一致している。
- 作業ツリーがクリーンである。
- deploy 対象の fullName、件数、内容を確認できる。
- 対象内容に対する validate または dry-run が成功している。内容が変わっている場合は再実行する。
- 対象 org alias が確認済みである。
- 対象 org と scope の deploy が明示承認されている。

scopeを再現できない場合はdeployせず、scopeを修正して再検証します。

次は通常、deploy の対象外です。

- docs-only PR
- retrieve-only PR

## 組織の初回構築・再構築

接続組織の初回構築または再構築は通常開発とは別タスクです。ユーザーが「初回構築」または「再構築」を明示し、次の情報を確認したうえで個別に承認した場合だけ実行します。

- 対象 org alias と組織種別
- 全 metadata の type、fullName、件数
- 既存設定への上書き影響
- バックアップまたは復旧方法
- validate / dry-run 結果
- deploy コマンド

初回構築用のscopeはそのタスク内で一時的に作成します。

## Apex test

関連テストを単独で実行する場合は、次のように対象クラスと`--code-coverage`を指定します。

```sh
sf apex run test \
    --class-names MyServiceTest \
    --code-coverage \
    --result-format human \
    --target-org <alias>
```

対象クラスが1つの場合は`--synchronous`を指定して同期実行できます。複数クラスでは`--class-names`を繰り返し指定し、`--wait`で結果の待機時間を指定します。

組織内のローカルApexテストを全件実行する場合は、次のスクリプトを使用します。

```sh
npm run sf:test:apex
```

スクリプトはdefault target orgのalias、ユーザー名、URL、種別を表示し、`y`または`Y`で承認された場合だけ、`RunLocalTests`をカバレッジ付きで開始します。本番環境では、接続組織の承認後に環境別の最終確認を行い、再承認された場合だけ開始します。接続組織の承認前にApexテストの並列実行設定を確認し、並列実行オプションが有効な場合は注意を表示しますが、実行は中止しません。インストール済み管理パッケージとnamespaced unlocked packageのApexテストは対象外です。全件実行は非同期で開始し、テストランIDとクラス単位の完了件数を表示します。全件完了後は`sf apex get test`相当の処理で結果とカバレッジを自動取得します。監視全体には時間上限を設けず、組織確認、設定確認、開始、個々の進捗照会、最終結果取得のCLI呼び出しにはそれぞれ2分の上限を設定します。開始状況を確認できない場合は自動再実行せず、監視または結果取得に失敗した場合は同じテストランIDの結果確認コマンドを表示します。詳細は[組織テスト実行スクリプト](../specifications/scripts/org-tests/index.md)を参照してください。Apexテストの直列実行は、対象組織の`Settings:Apex`で`enableDisableParallelApexTesting`を`true`にして管理します。

「Disable Parallel Apex Testing」は組織全体のApexテスト実行に影響し、テスト時間が長くなる可能性があります。元へ戻す場合は`enableDisableParallelApexTesting`を`false`へ戻し、`Settings:Apex`だけを対象組織へ反映します。

## Flow test

組織内のローカルFlowテストを全件開始する場合は、次のスクリプトを使用します。

```sh
npm run sf:test:flow
```

スクリプトはdefault target orgの情報を表示し、`y`または`Y`で承認された場合だけ、`sf flow run test --test-level RunLocalTests`を実行します。本番環境では、接続組織の承認後に環境別の最終確認を行い、再承認された場合だけ実行します。インストール済みの管理パッケージとunlocked packageのFlowテストは対象外です。全件実行は非同期で開始し、テストランIDと完了件数を表示します。全件完了後は`sf flow get test`相当の処理で結果とカバレッジを自動取得します。Apexテストと同じ開始、監視、結果取得、タイムアウト、復旧処理を使用します。詳細は[組織テスト実行スクリプト](../specifications/scripts/org-tests/index.md)を参照してください。

開始CLIの応答待ちに`Ctrl+C`を入力した場合は、開始状況不明として自動再実行しないよう案内します。テストランID取得後の進捗照会中または次回照会までの待機中に入力した場合は、ローカルの監視だけを終了し、組織上のテストは継続します。スクリプトが表示する`sf apex get test`または`sf flow get test`コマンドで、後から結果を取得できます。

「Disable Parallel Apex Testing」がFlowテストを直列化する前提にはしません。Flowテストの直列実行が必要な場合は、対象Flowを1件に限定した別の実行scopeとして扱います。

## 報告ルール

Salesforce組織操作後は次を報告します。PRに関連する組織検証の結果はPRにも記録し、CI成功や実際のdeploy完了と区別します。

- 対象 org alias
- validate / deploy / test の区分
- 対象 metadata の type、fullName、件数
- Git 差分外の依存 metadata と追加理由
- 実行コマンドと結果
- Apexテスト件数と関連クラスcoverage
- 実行しなかった確認と理由
