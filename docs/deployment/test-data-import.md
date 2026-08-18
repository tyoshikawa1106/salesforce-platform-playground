# テストデータ投入手順

Salesforce CLI で、リポジトリ管理された合成テストデータを org に投入する手順です。

## 使い分け

この仕組みは、画面操作や Flow / Trigger の動作確認など、org 上に一時的なテストレコードが必要な場合に使います。

Apex テストでは、組織内データに依存せず、テスト内で `TestDataFactory` などを使ってデータを作成します。

## ファイル構成

`scripts/` 全体の配置方針は `scripts/scripts-guide.md` を参照します。`scripts/setup/` は初期セットアップの実行起点とplanを置く場所です。匿名Apexのシード用スクリプトは、ファイル種別に合わせて`scripts/apex/`に置きます。

- `scripts/setup/plans/import-test-data-plan.json`: 主要標準オブジェクト seed の実行計画と共通preamble。
- `scripts/apex/test-data/seed-standard-preamble.apexpart`: 標準オブジェクトseedで共有する変数と関数の断片。
- `scripts/apex/test-data/seed-standard-*.apexpart`: 標準オブジェクトseedのobject固有処理の断片。
- `scripts/apex/test-data/*.apex`: 単独で実行するanonymous Apex。
- `scripts/soql/test-data-check-queries/*.soql`: 初期データ投入後の横断確認用 SOQL。
- `scripts/soql/object-queries/<object>/*.soql`: オブジェクトごとの調査・運用確認用 SOQL。
- `scripts/setup/import-test-data.js`: import planを読み、共通preambleとobject固有処理を一時ファイルへ合成して`sf apex run`を順番に実行する。

## 事前確認

実投入では、確認済みの alias を `--target-org <alias>` で明示します。スクリプトはSalesforce CLIの認証済み組織情報から、指定された組織のalias、ユーザー名、URL、種別を表示します。表示された接続組織を`y`または`Y`で承認した場合だけ、安全判定と実投入へ進みます。

Sandbox、Scratch Org、Developer Editionには投入できます。本番環境へのテストデータ投入は禁止し、接続組織が承認されても実投入前にエラー終了します。対象組織を一意に特定できない場合や、組織種別を判定できない場合も実投入しません。

報告には対象 org alias を書き、実ユーザー名や org 固有 URL は書きません。

## dry-run

実行前に、ローカルファイルと実行予定コマンドを確認します。

dry-runは組織へ接続せず、接続組織の表示と入力確認も行いません。

```sh
npm run setup:data:standard:dry-run -- --target-org <alias>
```

## 主要標準オブジェクト seed

### 実行単位

主要標準オブジェクトは親子関係や価格表 ID を必要とするため、CSV の一括投入ではなく、Salesforce CLI から anonymous Apex を実行します。

execute anonymousのCPU／サイズ制限を避けるため、1つのprimary objectにつき1つのobject固有ファイルへ分け、`scripts/setup/plans/import-test-data-plan.json`の順序で実行します。各実行では`seed-standard-preamble.apexpart`とobject固有の`.apexpart`を一時的な`.apex`ファイルへ合成し、終了後に一時ファイルを削除します。`standalone: true`のentryは共通preambleを使わず、単独実行可能な`.apex`を使用します。

件数や固定マスタの扱いは、このセクションの作成対象一覧の後にまとめます。

```sh
npm run setup:data:standard:dry-run -- --target-org <alias>
npm run setup:data:standard -- --target-org <alias>
```

一部だけ投入する場合は、`import-test-data-plan.json`の`label`を指定します。

```sh
npm run setup:data:standard -- --target-org <alias> --only standard-objects-accounts
```

### ケースメールログ表示用データ

`caseEmailMessageList` の大量行表示とページングを確認する場合は、合成ケース「`[TEST] ノートPCの初期設定方法を確認したい`」へ240件の合成メールを作成します。各メールの本文は、改行と空行を含む27行のテキストです。

再実行時は、件名が「`[TEST-LWC-BULK]`」で始まる専用データだけを削除し、同数を再作成します。それ以外の既存メールは残します。

```sh
npm run setup:data:standard:dry-run -- --target-org <alias> --only case-email-message-list
npm run setup:data:standard -- --target-org <alias> --only case-email-message-list
```

画面では初回に最も古い 50 件を表示します。「次のメールを読み込む」を選択し、50 件ずつ追加されることと、新しいメールが末尾へ追加されて古い順を維持することを確認します。

### 最近の問い合わせ表示用データ

`caseRelatedCaseList`の顧客タブと会社タブを確認する場合は、合成ケース「`[TEST] ノートPCの初期設定方法を確認したい`」と同じContact、Accountへ5件の合成ケースを作成します。

再実行時は、件名が「`[TEST-LWC-RELATED]`」で始まる専用データだけを削除し、同数を再作成します。それ以外の既存ケースは残します。

```sh
npm run setup:data:standard:dry-run -- --target-org <alias> --only case-related-case-list
npm run setup:data:standard -- --target-org <alias> --only case-related-case-list
```

画面では「顧客」と「会社」の両タブに表示中Caseがリンクなしで先頭表示され、その後へ別Caseが直近順で4件表示されることを確認します。5件目の別Caseは最大5件の表示制限により表示されません。

投入後の主要レコードは、確認用 SOQL で確認できます。

```sh
sf data query --file scripts/soql/test-data-check-queries/accounts.soql --target-org <alias>
sf data query --file scripts/soql/test-data-check-queries/opportunities.soql --target-org <alias>
sf data query --file scripts/soql/test-data-check-queries/cases.soql --target-org <alias>
```

オブジェクトごとの調査クエリ例は、`scripts/soql/object-queries/account/`、`scripts/soql/object-queries/opportunity/`、`scripts/soql/object-queries/case/` に置きます。

### 作成対象

作成対象は次のとおりです。

| 分類             | API 名                                                                |
| ---------------- | --------------------------------------------------------------------- |
| 顧客             | `Account`, `Contact`, `Lead`                                          |
| キャンペーン     | `Campaign`, `CampaignMember`                                          |
| 商品・価格       | `Product2`, `PricebookEntry`                                          |
| 商談             | `Opportunity`, `OpportunityContactRole`, `OpportunityLineItem`        |
| 契約・注文       | `Contract`, `Order`, `OrderItem`                                      |
| サポート         | `Asset`, `Case`, `Entitlement`, `ServiceContract`, `ContractLineItem` |
| 作業指示         | `WorkOrder`, `WorkOrderLineItem`                                      |
| 活動             | `Task`, `Event`                                                       |
| メール・ファイル | `EmailMessage`, `ContentVersion`                                      |

### 件数と表示名

- 通常 org では、各オブジェクトを 50 件規模で作成する。
- Scratch Org では、`scripts/scratch-org/steps/import-test-data.js` が `--default-repeat 40` を指定し、2,000 件規模へ拡張する。
- 組織の機能や権限で作成できない optional object は、debug log に理由を出し、作成可能な範囲を続行する。
- キャンペーンは、前年・今年・来年の各月 1 件ずつ作成する。
- 商品価格はカスタム価格表を作成せず、標準価格表を有効化して `PricebookEntry` を作成する。
- 商品マスターは、ノート PC、モニター、会議機器、オフィス家具、ソフトウェアなどの office product catalog として作成する。
- `Account.Name` は `[TEST] さくらデータ企画株式会社` のように、テスト接頭辞と自然な会社名で構成する。
- 請求先・納入先住所の都道府県は `State` で設定し、State/Country Picklist の有無に依存しないようにする。
- `Name`、`LastName`、`Subject`、`Title` など画面に表示される主要名称には連番プレフィックスを付けない。内部識別が必要な値は、メール、URL、外部識別用フィールド、ファイルパスなどに保持する。

### 作成しない対象

`Knowledge`, `Report`, `Dashboard`, `User` は画面上の集計対象に含まれていても、この DML seed では作成しません。Knowledge article sObject は org の機能状態に依存し、Report / Dashboard は metadata-backed、追加 User はライセンスとプロファイル設計が必要なためです。

## データ追加時の注意

- 実在の個人情報、顧客情報、秘密情報を入れない。
- org 固有の ID を固定しない。
- validation rule、required field、picklist 値を describe で確認する。
- 親子関係のあるデータは親から投入する。
- Trigger / Flow の bulk 動作を見たい場合は、200 件境界を超える件数を用意する。
- データ投入は metadata deploy ではないため、投入したレコードを Git 差分や manifest に含めない。
