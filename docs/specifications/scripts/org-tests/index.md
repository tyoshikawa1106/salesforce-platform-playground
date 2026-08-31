# 組織テスト実行スクリプト

## 概要

Default Target Orgを確認し、ローカルApexテストまたはローカルFlowテストを非同期で開始して、完了後の結果とカバレッジを表示するNode.jsスクリプトです。

## 目的・利用場面

Sandbox、Scratch Org、Developer Edition、本番環境で、接続先を実行者が確認したうえで組織内のローカルテストを全件実行するときに使用します。

ApexとFlowは別々の実行入口を持ち、必要なテスト種別だけを独立して確認できます。

## 対象実装・メタデータ

| 種別               | API名・ファイル名                             | 役割                                                   |
| ------------------ | --------------------------------------------- | ------------------------------------------------------ |
| npm script         | `sf:test:apex`                                | ローカルApexテストを実行する入口                       |
| npm script         | `sf:test:flow`                                | ローカルFlowテストを実行する入口                       |
| Node.js script     | `scripts/org-tests/run-apex-tests.js`         | Apex固有の表示とテスト種別を共通処理へ渡す             |
| Node.js script     | `scripts/org-tests/run-flow-tests.js`         | Flow固有の表示とテスト種別を共通処理へ渡す             |
| Node.js module     | `scripts/org-tests/internal/run-org-test.js`  | 接続先確認、承認、本番環境の追加確認を行う             |
| Node.js module     | `scripts/org-tests/internal/test-runner.js`   | テストの開始、監視、中断、最終結果取得を行う           |
| Node.js module     | `scripts/org-tests/internal/test-progress.js` | CLI応答解析、進捗照会、終了判定、進捗表示を行う        |
| 共通Node.js module | `scripts/common/approval.js`                  | `y`または`Y`だけを承認として扱う                       |
| 共通Node.js module | `scripts/common/target-org.js`                | Default Target Orgの情報取得、照合、組織種別判定を行う |
| 共通Node.js module | `scripts/common/run-command.js`               | Salesforce CLIをshell経由なしで実行する                |

## 入力

実行コマンドは次の2種類です。追加のコマンドライン引数は受け付けません。

```sh
npm run sf:test:apex
```

```sh
npm run sf:test:flow
```

- 接続先にはSalesforce CLIで設定されたDefault Target Orgを使用します。
- テストクラス、テストメソッド、テストスイート、Flow名は個別指定できません。
- 接続組織と、必要な場合は本番環境での実行について、標準入力から承認を受け付けます。

## 処理内容

現在の処理順序は次のとおりです。

```text
引数検査
  ↓
Default Target Orgの確認
  ↓
Apexのみ並列実行設定を確認・必要なら注意表示
  ↓
接続組織の承認
  ↓
本番環境のみ追加確認
  ↓
RunLocalTestsをカバレッジ付きで非同期開始
  ↓
テストランIDを表示
  ↓
5秒ごとに進捗を監視
  ↓
最終結果とカバレッジを表示
```

### 1. 引数検査

引数が1件でも指定された場合は、Salesforce CLIを呼び出さず終了コード`1`で停止します。対象組織とテストscopeは、Default Target Orgと`RunLocalTests`に固定します。

### 2. Default Target Orgの確認

Salesforce CLIのDefault Target Orgを認証済み組織一覧と照合し、aliasまたはusernameで1件に特定します。Scratch Org、Sandbox、Developer Edition、本番環境のいずれかへ分類し、次の形式で表示します。

```text
接続組織を確認してください。
・Alias: <alias>
・Username: <username>
・URL: <instance-url>
・Org Type: <組織種別>
```

Default Target Orgが未設定、対象を一意に特定できない、または組織種別を判定できない場合は、承認入力と組織テストを開始しません。

Default Target Orgの取得と認証済み組織一覧の取得には、それぞれ2分のCLI実行時間上限を設定します。

### 3. Apex並列実行設定の確認

Apexテストでは、接続組織の表示後、実行承認の前にTooling APIの`ApexSettings.IsDisableParallelApexTestingEnabled`を取得します。値が`false`の場合は「Disable Parallel Apex Testing」が無効であり、Apexテストの並列実行オプションが有効なため、次を表示します。

```text
注意: 対象組織ではApexテストの並列実行オプションが有効です。
```

この確認は通知だけを目的とし、設定を変更せず、テスト開始を禁止しません。値が`true`の場合は注意を表示しません。設定取得に失敗した場合も、確認できなかったことを標準エラー出力へ表示して実行承認へ進みます。

Flowテストでは、この設定を確認しません。設定取得CLIには2分の実行時間上限を設定します。

### 4. 実行承認

Apexでは次を表示します。

```text
この接続組織でApexテストを実行しますか？ [y/N]:
```

Flowでは次を表示します。

```text
この接続組織でFlowテストを実行しますか？ [y/N]:
```

`y`または`Y`の場合だけ続行します。それ以外の場合は組織操作を開始せず、正常な利用者中止として終了コード`0`を返します。

本番環境では、接続組織の承認後に次の追加確認を行います。

```text
本番環境です。<ApexまたはFlow>テストを実行してよろしいですか？ [y/N]:
```

Sandbox、Scratch Org、Developer Editionでは、環境別の追加確認を行いません。

### 5. テストの開始

Apexでは次のコマンドに相当する処理を実行します。

```sh
sf apex run test \
    --test-level RunLocalTests \
    --code-coverage \
    --target-org <default-target-org> \
    --json
```

Flowでは先頭の`apex`を`flow`へ置き換えます。`--synchronous`と`--wait`を指定しないため、Salesforce CLIはテストを非同期で開始してテストランIDを返します。

テストランIDは、`AsyncApexJob`に対応する`707`で始まる15桁または18桁のSalesforce IDであることを確認します。このIDは、進捗照会で`ApexTestRunResult.AsyncApexJobId`として使用します。条件を満たす場合は次を表示します。

```text
テストランID: 707XXXXXXXXXXXXXXX
```

開始CLIには2分の実行時間上限があります。この上限はテスト全体の実行時間を制限せず、開始要求を行う1回のローカルCLIプロセスだけを対象とします。

### 6. 進捗監視

開始時に取得したテストランIDを指定し、5秒ごとにTooling APIの`ApexTestRunResult`から次の項目を取得します。

- `Status`
- `ClassesCompleted`
- `ClassesEnqueued`

ApexとFlowの非同期テストは、Salesforce CLIと同じ`ApexTestRunResult`を進捗確認に使用します。進捗は次の形式で表示します。

```text
進捗: 1 / 3件完了（実行中）｜2026/08/31 17:26:20
```

末尾に、進捗応答を正常に取得した時点のローカル日時を`YYYY/MM/DD HH:mm:ss`形式で表示します。TTYでは同じ行を更新し、TTY以外では行単位で出力します。監視全体には時間上限を設けず、長時間の組織テストを完了まで追跡します。個々の進捗照会CLIには2分の実行時間上限があります。

`Aborted`、`Completed`、`Failed`、`Passed`、`Skipped`のいずれかを取得すると、完了状態として進捗監視を終了します。テストの成功または失敗は、この進捗表示だけでは確定せず、後続のSalesforce CLIによる最終結果を正とします。

### 7. 最終結果の取得

Apexでは次のコマンドに相当する処理を実行します。

```sh
sf apex get test \
    --test-run-id 707XXXXXXXXXXXXXXX \
    --code-coverage \
    --result-format human \
    --target-org <default-target-org>
```

Flowでは先頭の`apex`を`flow`へ置き換えます。最終結果取得CLIにも2分の実行時間上限を設定します。

Salesforce CLIが返す終了コードをスクリプトの終了コードとして使用します。テスト失敗または結果取得失敗で終了コードが非0の場合は、同じテストランIDを使った結果確認コマンドも表示します。

## 出力・更新対象

- 接続組織情報、テストランID、進捗、最終結果、カバレッジを標準出力へ表示します。
- テスト失敗、CLI失敗、JSON解析失敗などを標準エラー出力へ表示します。
- リポジトリ内へテスト結果ファイルを作成しません。
- Salesforce組織上には非同期テストランが作成されます。
- スクリプトはテストランの自動再試行またはキャンセルを行いません。

## 権限・実行条件

- Salesforce CLIが利用でき、Default Target Orgが設定済みである必要があります。
- 対象組織が認証済み組織一覧に存在し、組織種別を判定できる必要があります。
- Salesforce CLIの組織テスト実行に必要な権限が必要です。現行CLIでは`View All Data`権限が必要です。
- Apexテストの直列実行は、対象組織の`Settings:Apex`にある`enableDisableParallelApexTesting`で管理します。スクリプトは現在値を確認しますが、設定を切り替えません。
- Flowテストを直列化する設定として`enableDisableParallelApexTesting`を使用しません。

## エラー処理

### 開始失敗

Salesforce CLIが構造化された失敗応答を返した場合は、エラー内容を表示して終了コード`1`を返します。

開始CLIのタイムアウト、開始応答を受け取る前のCtrl+C、解析できないJSON、成功応答に有効なテストランIDがない場合は、組織上でテストが開始された可能性を否定できません。テスト種別に応じて次を表示し、自動再実行せず終了します。Ctrl+Cの場合の終了コードは`130`、それ以外は`1`です。

```text
Apexテストの開始結果を取得できませんでした。組織上では開始されている可能性があります。
重複実行を避けるため、再実行する前にSalesforceの「Apexテスト実行」で状況を確認してください。
```

```text
Flowテストの開始結果を取得できませんでした。組織上では開始されている可能性があります。
重複実行を避けるため、再実行する前にSalesforceのテスト実行状況を確認してください。
```

### Apex並列実行設定の確認失敗

設定取得のタイムアウト、CLI失敗、JSON解析失敗、不正な応答が発生した場合は、次の注意を標準エラー出力へ表示します。この確認だけを理由にテスト開始を中止しません。

```text
注意: Apexテストの並列実行設定を確認できませんでした。テストは続行できます: <原因>
```

### 監視失敗

進捗照会のタイムアウト、CLI失敗、JSON解析失敗、不正な進捗応答が発生した場合は、組織上のテストをキャンセルせず終了コード`1`を返します。

```text
組織テストの進捗監視を終了しました。
組織上のテストは継続している可能性があります。
結果確認: sf <apexまたはflow> get test --test-run-id <test-run-id> --code-coverage --result-format human --target-org <default-target-org>
```

### Ctrl+C

開始CLIの応答待ちでCtrl+Cを押した場合はローカルCLIを中断し、開始状況不明として自動再実行しないよう案内します。この時点ではテストランIDを取得できないため、結果確認コマンドは表示しません。

テストランID取得後の監視中にCtrl+Cを押した場合は、実行中の進捗照会または次回照会までの待機と、ローカル監視だけを終了します。Salesforce組織上のテストはキャンセルしません。

```text
進捗監視を終了しました。組織上のテストは継続しています。
結果確認: sf <apexまたはflow> get test --test-run-id <test-run-id> --code-coverage --result-format human --target-org <default-target-org>
```

終了コードにはSIGINTの慣例である`130`を使用します。

### 最終結果取得失敗

最終結果取得が非0終了した場合は、その終了コードを返し、同じテストランIDを使った結果確認コマンドを表示します。ApexまたはFlowテスト自体が失敗した場合も、Salesforce CLIの非0終了を変更しません。

## 関連コンポーネント

- [組織操作ルール](../../../deployment/org-operation-rules.md)
- [メタデータ削除スクリプト](../metadata-deletion/index.md)
- [リポジトリ構成](../../repository-structure.md)

## テスト・確認観点

Node.jsテストでは、次を確認します。

- 引数指定とDefault Target Org未設定時に組織操作を開始しないこと
- 接続組織と本番環境の承認境界
- ApexとFlowで`RunLocalTests`とカバレッジを指定すること
- 組織確認、設定確認、開始、進捗照会、最終結果取得の各CLIへ2分上限を渡すこと
- Apexの並列実行オプションが有効な場合だけ注意を表示し、設定を確認できない場合もテストを止めないこと
- `707`形式以外のテストランIDを拒否すること
- 開始状況不明と構造化された開始失敗を区別すること
- 完了後の最終結果取得、監視失敗、開始中と監視中のCtrl+C、結果取得失敗時の復旧案内
- JSON応答、進捗項目、TTYと非TTYの表示

実行コマンドは次のとおりです。

```sh
node --test scripts/org-tests/test/*.node.js
```

## 制約・注意事項

- `RunLocalTests`の対象範囲はSalesforce標準の定義に従います。
- Apexでは、インストール済み管理パッケージとnamespaced unlocked packageのテストを実行しません。
- Flowでは、インストール済み管理パッケージとunlocked packageのテストを実行しません。
- ApexとFlowは別々のテストランとして実行し、一括実行する`sf logic run test`は使用しません。
- 監視全体には時間上限がありません。個々のCLI呼び出しの2分上限は、組織上のテストランをキャンセルするものではありません。
- カバレッジはSalesforce CLIが返す結果を表示し、スクリプト独自の合格率を追加しません。
- ApexとFlowのテストだけでは、画面描画や外部システムの実動作を保証しません。

## 既知の差異・確認事項

- Salesforce CLI 2.149.9のhelpで、Apex／Flowの開始、結果取得、カバレッジに使用する引数を確認しています。
- Developer EditionのApexテスト実行で、開始JSONから`707`で始まるテストランIDを取得し、`ApexTestRunResult`から実行中の進捗件数を取得できることを確認しています。
- Node.jsテストのSalesforce CLI応答は模擬JSONです。実組織でのApex並列実行設定、Apexの完了後の最終結果とカバレッジ、Flowの開始から結果取得まで、日時付き進捗表示、長時間監視、Ctrl+C、タイムアウト時の表示は未確認です。
- 承認済みの外部要求または業務契約との比較対象はありません。
