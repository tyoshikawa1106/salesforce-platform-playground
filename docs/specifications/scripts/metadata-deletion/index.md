# メタデータ削除スクリプト

## 概要

`npm run sf:destructive`を1回実行し、Default Target Orgの確認、dry-run、実削除、完了監視までを連続して行うNode.jsスクリプトです。削除対象はリポジトリ管理のmanifestで指定します。

## 目的・利用場面

Salesforce組織からmetadataを削除するときに接続先を確認し、Salesforceのdry-runが成功した対象だけを、同じ対象組織とmanifestで実削除するために使用します。

本番実行前の確認、依存調査、復旧方針は[メタデータ削除ルール](../../../deployment/metadata-deletion-rules.md)に従います。

## 対象実装・メタデータ

| 種別               | API名・ファイル名                                        | 役割                                                   |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------ |
| npm script         | `sf:destructive`                                         | 利用者が実行する入口                                   |
| Node.js script     | `scripts/metadata/destructive/destructive.js`            | manifest検査、接続先確認、承認、deploy順序を制御する   |
| Node.js module     | `scripts/metadata/destructive/internal/deploy-runner.js` | deployの開始、監視、結果検証、中断処理を行う           |
| manifest           | `manifest/destructivePackage.xml`                        | 削除deployに必要な通常manifest                         |
| manifest           | `manifest/destructiveChanges.xml`                        | 削除するmetadata typeとfullNameを定義する              |
| 共通Node.js module | `scripts/common/approval.js`                             | `y`または`Y`だけを承認として扱う                       |
| 共通Node.js module | `scripts/common/target-org.js`                           | Default Target Orgの情報取得、照合、組織種別判定を行う |
| 共通Node.js module | `scripts/common/run-command.js`                          | Salesforce CLIをshell経由なしで実行する                |

## 入力

- 実行コマンドは次のとおりです。追加のコマンドライン引数は受け付けません。

    ```sh
    npm run sf:destructive
    ```

- 接続先にはSalesforce CLIで設定されたDefault Target Orgを使用します。
- 削除対象は`manifest/destructiveChanges.xml`にmetadata typeとfullNameで指定します。
- 通常manifestには`manifest/destructivePackage.xml`を使用します。
- 接続組織と、必要な場合は組織種別について、標準入力から承認を受け付けます。

## 処理内容

現在の処理順序は次のとおりです。

```text
manifest検査
  ↓
Default Target Orgの確認
  ↓
接続組織の承認
  ↓
本番環境／Developer Editionのみ追加確認
  ↓
dry-run開始・監視
  ↓
Salesforce CLIが成功を返したら実削除
  ↓
実削除開始・監視
  ↓
削除完了・Apexテストを案内
```

### 1. manifest検査

組織へ接続する前に`manifest/destructiveChanges.xml`を読み、次を確認します。

- `REPLACE_WITH_`で始まるプレースホルダーが残っていないこと
- `<types>`が1件以上あり、開始タグと終了タグの数が一致すること
- 各`<types>`に空でない`<name>`が1件だけあること
- 各`<types>`に空でない`<members>`が1件以上あること
- `<members>`にワイルドカード`*`がないこと

条件を満たさない場合は、Default Target Orgを取得せず終了します。

### 2. Default Target Orgの確認

Salesforce CLIのDefault Target Orgを認証済み組織一覧と照合し、aliasまたはusernameで1件に特定します。Scratch Org、Sandbox、Developer Edition、本番環境のいずれかへ分類し、次の形式で表示します。

```text
接続組織を確認してください。
・Alias: <alias>
・Username: <username>
・URL: <instance-url>
・Org Type: <組織種別>
```

Default Target Orgが未設定、対象を一意に特定できない、または組織種別を判定できない場合は、承認入力とdeployを開始しません。

### 3. 接続組織の承認

すべての組織で次を表示します。

```text
この接続組織で続行しますか？ [y/N]:
```

`y`または`Y`の場合だけ続行します。それ以外の場合は次を表示して正常終了します。

```text
メタデータ削除を中止しました。
```

本番環境とDeveloper Editionでは、dry-run前に次の追加確認を行います。

```text
<組織種別>です。メタデータ削除を実行してよろしいですか？ [y/N]:
```

SandboxとScratch Orgでは、この追加確認を行いません。これらの承認はdry-runとその成功後の実削除までを対象とし、dry-run成功後に再確認は行いません。

### 4. dry-runの開始

次を表示します。

```text
dry-runによるメタデータ削除の検証を開始します。
```

次のコマンドに相当する引数でSalesforce CLIを非同期実行します。

```sh
sf project deploy start \
    --manifest manifest/destructivePackage.xml \
    --post-destructive-changes manifest/destructiveChanges.xml \
    --target-org <default-target-org> \
    --dry-run \
    --async \
    --json
```

`--test-level`と`--ignore-errors`は指定しません。テストレベルとdeployの成否は、対象組織とmetadataに応じたSalesforce標準の判定に従います。

### 5. deployの監視

dry-runと実削除の開始結果からjob IDを取得し、次を表示します。

```text
deploy job ID: 0AfXXXXXXXXXXXXXXX
```

開始時のjob IDを指定し、5秒ごとに次のコマンドに相当する処理で状態を取得します。

```sh
sf project deploy report \
    --job-id 0AfXXXXXXXXXXXXXXX \
    --target-org <default-target-org> \
    --json
```

進捗は次の形式で表示します。TTYでは同じ行を更新し、TTY以外では行単位で出力します。

```text
進捗: metadata 1 / 3件（InProgress）
```

監視全体には時間上限を設けません。deploy開始と個々のreport呼び出しには、それぞれ2分の実行時間上限と50MBのJSON出力上限を設定します。

監視応答では次を確認します。

- reportのjob IDが開始時のjob IDと一致すること
- `done`が真偽値であること
- `status`がMetadata API deployの既知の状態であること
- `numberComponentsDeployed`と`numberComponentsTotal`が0以上の整数であること

### 6. dry-runの成功判定

`done: true`になった結果について、次を確認します。

- `status: Succeeded`
- `success: true`
- dry-runとして開始したため`checkOnly: true`

条件を満たさない場合は終了コード`1`で終了し、実削除を開始しません。

### 7. 実削除の開始

dry-runが成功すると、次を表示します。

```text
dry-runによるメタデータ削除の検証が成功しました。
メタデータの実削除を開始します。
```

dry-runと同じTarget Orgとmanifestを使用し、`--dry-run`を外して次のコマンドに相当する処理を開始します。

```sh
sf project deploy start \
    --manifest manifest/destructivePackage.xml \
    --post-destructive-changes manifest/destructiveChanges.xml \
    --target-org <default-target-org> \
    --async \
    --json
```

Quick Deployや、利用者が後からjob IDを入力する操作はありません。

### 8. 実削除の成功判定

dry-runと同じ方法で完了まで監視し、次を確認します。

- 開始時と同じjob ID
- `done: true`
- `status: Succeeded`
- `success: true`
- 実削除として開始したため`checkOnly: false`

個々のmetadata typeとfullNameはdeploy結果と独自照合せず、削除処理と対象ごとの結果判定はSalesforce CLIとMetadata APIへ委ねます。

### 9. 削除完了

実削除が成功すると次を表示します。

```text
メタデータの削除が完了しました。
削除後の確認としてApexテストの実行を推奨します: npm run sf:test:apex
```

Apexテストは自動実行しません。

## 出力・更新対象

- dry-runはSalesforce組織のmetadataを変更しません。
- 実削除は`manifest/destructiveChanges.xml`に指定したmetadataをDefault Target Orgから削除します。
- スクリプトはローカルのmanifestとsourceを変更しません。
- 標準出力には接続先、承認、進捗、job ID、完了案内を表示します。
- 標準エラーにはmanifest、Salesforce CLI応答、成功判定のエラーを表示します。
- 正常完了と利用者による承認拒否は終了コード`0`、失敗は`1`、Ctrl+Cによる監視中断は`130`を返します。

## 権限・実行条件

- リポジトリの対応Node.jsバージョンとSalesforce CLIを使用できること
- Salesforce CLIにDefault Target Orgが設定され、認証済み組織一覧から1件に特定できること
- 実行者が対象metadataをdeployおよび削除できる権限を持つこと
- `manifest/destructivePackage.xml`に追加・更新対象が含まれていないこと
- `manifest/destructiveChanges.xml`に承認済みの削除対象だけが設定されていること
- 本番実行前に、同じ削除対象をSandboxで削除し、Apexテストと対象に応じた画面、Flow、外部連携を確認していること

## エラー処理

### 引数とmanifestのエラー

- 引数を指定した場合は、引数を受け付けないことと正しいnpmコマンドを表示し、Salesforce CLIを実行しません。
- 削除対象が空、不完全、プレースホルダー、ワイルドカードの場合は、組織情報を取得せず終了します。

### deploy開始結果が不明な場合

deploy開始コマンドのタイムアウト、JSON解析不能など、jobが作成された可能性を否定できない場合は、次の形式で自動再実行を禁止します。job IDを安全に取得できないため、reportコマンドは組み立てません。

```text
<dry-runまたはdestructive deploy>の開始状況を確認できません。自動で再実行しないでください。
SalesforceのDeployment Statusで実行状況を確認してください。
```

Salesforce CLIから構造化された開始失敗を取得できた場合は、確定した開始失敗としてエラーだけを表示します。

### 監視応答を検証できない場合

job IDの取得後にreport応答を解析または検証できない場合は、組織上のdeployが継続している可能性と結果確認コマンドを表示します。

```text
<dry-runまたはdestructive deploy>の進捗監視を終了しました。
エラー: <監視エラー>
組織上のdeployは継続している可能性があります。
結果確認: sf project deploy report --job-id 0AfXXXXXXXXXXXXXXX --target-org <default-target-org>
```

### Ctrl+C

監視中にCtrl+Cを受けた場合は、ローカル監視と次回pollまでの待機だけを終了します。Salesforce組織上のdeployはキャンセルしません。

```text
進捗監視を終了しました。組織上のdeployは継続しています。
結果確認: sf project deploy report --job-id 0AfXXXXXXXXXXXXXXX --target-org <default-target-org>
```

### 完了結果が成功条件を満たさない場合

最終状態、`success`、`checkOnly`が成功条件を満たさない場合は終了コード`1`を返し、job IDを指定した結果確認コマンドを表示します。dry-runの失敗時は実削除せず、実削除の失敗時は削除完了とApexテストの案内を表示しません。

## 関連コンポーネント

- [メタデータ削除ルール](../../../deployment/metadata-deletion-rules.md)
- [組織操作ルール](../../../deployment/org-operation-rules.md)
- [Repository Structure](../../repository-structure.md)
- Salesforce CLIのMetadata API deploy

## テスト・確認観点

### 削除フロー

次のコマンドで、manifest検査、接続先と組織種別の承認、dry-runと実削除の順序、CLI引数、完了メッセージを確認します。

```sh
node --test scripts/metadata/destructive/test/destructive.node.js
```

### deployの実行と監視

次のコマンドで、非同期開始、5秒間隔のreport、CLI呼び出し上限、開始状況不明、監視エラー、Ctrl+C、dry-run／実削除の成功判定を確認します。

```sh
node --test scripts/metadata/destructive/test/deploy-runner.node.js
```

リポジトリのNode.jsスクリプトテスト全体は次で実行します。

```sh
npm run test:scripts
```

テストはSalesforce CLI応答、確認入力、時間待機をモックし、Salesforce組織へ接続しません。

## 制約・注意事項

- dry-runと実削除ではテストレベルを明示しません。削除後のApexテストは別コマンドとして案内するだけで、自動実行しません。
- ApexテストだけではVisualforce、画面描画、Flow、外部連携を保証できないため、削除対象に応じた確認が別途必要です。
- 監視全体には時間上限がないため、Salesforceが処理中の状態を返し続ける間は監視を継続します。
- Ctrl+Cとローカルの監視エラーは、Salesforce組織上のdeployをキャンセルしません。
- 個々の削除componentはdeploy結果と独自照合しません。必要な場合はTooling APIまたはretrieveで追加確認します。
- component件数、componentエラー、`rollbackOnError`、Apexテスト結果は、スクリプト独自の成功条件として重ねて判定しません。
- Quick Deployは使用しません。

## 既知の差異・確認事項

- 状態: 未確認
- 現行仕様は`destructive.js`、`deploy-runner.js`と対応するNode.jsテストから確認しています。
- Node.jsテストのSalesforce CLI応答はすべてモックです。実際のdry-runと実削除で返るJSON形式、進捗、削除結果の出方は、承認済みの削除対象を使ったSandboxリハーサルで確認が必要です。
- 承認済み要求の管理元をリポジトリ内で確認できないため、要求との差異は判定していません。
