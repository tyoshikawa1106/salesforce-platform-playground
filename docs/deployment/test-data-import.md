# テストデータ投入手順

Salesforce CLI で、リポジトリ管理された合成テストデータを org に投入する手順です。

## 使い分け

この仕組みは、画面操作や Flow / Trigger の動作確認など、org 上に一時的なテストレコードが必要な場合に使います。

Apex テストでは、組織内データに依存せず、テスト内で `TestDataFactory` などを使ってデータを作成します。

## ファイル構成

`scripts/` 全体の配置方針は `scripts/scripts-guide.md` を参照します。`scripts/setup/` は初期セットアップの実行起点とplanを置く場所です。匿名Apexのシード、クリーンアップ、修復用スクリプトは、ファイル種別に合わせて`scripts/apex/`に置きます。

- `scripts/setup/import-plan.json`: 主要標準オブジェクト seed の実行計画。
- `scripts/apex/test-data/*.apex`: 関連レコードを作成・削除する anonymous Apex。
- `scripts/soql/test-data-check-queries/*.soql`: 初期データ投入後の横断確認用 SOQL。
- `scripts/soql/object-queries/<object>/*.soql`: オブジェクトごとの調査・運用確認用 SOQL。
- `scripts/setup/import-test-data.js`: import plan を読み、`sf apex run` を順番に実行する。

## 事前確認

対象 org を確認します。

```sh
sf config get target-org
```

default target org と異なる組織へ投入する場合は、確認済みの alias を `--target-org <alias>` で明示します。
alias だけでは判断できない場合に限り、必要な範囲で `sf org display --target-org <alias>` を使います。
報告には対象 org alias を書き、実ユーザー名や org 固有 URL は書きません。

## dry-run

実行前に、ローカルファイルと実行予定コマンドを確認します。

```sh
npm run setup:data:standard:dry-run -- --target-org <alias>
```

## 主要標準オブジェクト seed

### 実行単位

主要標準オブジェクトは親子関係や価格表 ID を必要とするため、CSV の一括投入ではなく、Salesforce CLI から anonymous Apex を実行します。

execute anonymous の CPU / サイズ制限を避けるため、1 つの primary object につき 1 つの anonymous Apex ファイルに分け、`scripts/setup/import-plan.json` の順序で実行します。

件数や固定マスタの扱いは、このセクションの作成対象一覧の後にまとめます。

```sh
npm run setup:data:standard:dry-run -- --target-org <alias>
npm run setup:data:standard -- --target-org <alias>
```

一部だけ投入する場合は、`import-plan.json` の `label` を指定します。

```sh
npm run setup:data:standard -- --target-org <alias> --only standard-objects-accounts
```

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
- Scratch Org では、`scripts/scratch-org/internal-import-test-data.js` が `--default-repeat 40` を指定し、2,000 件規模へ拡張する。
- 組織の機能や権限で作成できない optional object は、debug log に理由を出し、作成可能な範囲を続行する。
- キャンペーンは、前年・今年・来年の各月 1 件ずつ作成する。
- 商品価格はカスタム価格表を作成せず、標準価格表を有効化して `PricebookEntry` を作成する。
- 商品マスターは、ノート PC、モニター、会議機器、オフィス家具、ソフトウェアなどの office product catalog として作成する。
- `Account.Name` は `[TEST] さくらデータ企画株式会社` のように、テスト接頭辞と自然な会社名で構成する。
- 請求先・納入先住所の都道府県は `State` で設定し、State/Country Picklist の有無に依存しないようにする。
- `Name`、`LastName`、`Subject`、`Title` など画面に表示される主要名称には連番プレフィックスを付けない。内部識別が必要な値は、メール、URL、外部識別用フィールド、ファイルパスなどに保持する。

### 作成しない対象

`Knowledge`, `Report`, `Dashboard`, `User` は画面上の集計対象に含まれていても、この DML seed では作成しません。Knowledge article sObject は org の機能状態に依存し、Report / Dashboard は metadata-backed、追加 User はライセンスとプロファイル設計が必要なためです。

## クリーンアップ

投入後は、必要に応じて対象を確認してから削除します。

```sh
sf data query \
  --query "SELECT Id, Name FROM Account WHERE Name LIKE '[TEST]%'" \
  --target-org <alias>
```

少量であれば ID を確認して削除します。

```sh
sf data delete record --sobject Account --record-id <record-id> --target-org <alias>
```

主要標準オブジェクトのシードデータは、接頭辞`[TEST]`を使ってクリーンアップします。

- governor limit を避けるため、各オブジェクト最大 100 件ずつ削除する。
- 大量投入後は `Deleted records: none` になるまで複数回実行する。

```sh
sf apex run --file scripts/apex/test-data/cleanup-standard-objects.apex --target-org <alias>
```

## データ追加時の注意

- 実在の個人情報、顧客情報、秘密情報を入れない。
- org 固有の ID を固定しない。
- 大量データや自動化検証用データは、投入前にクリーンアップ方針を決める。
- validation rule、required field、picklist 値を describe で確認する。
- 親子関係のあるデータは親から投入する。
- Trigger / Flow の bulk 動作を見たい場合は、200 件境界を超える件数を用意する。
- データ投入は metadata deploy ではないため、投入したレコードを Git 差分や manifest に含めない。
- 失敗しても作成済みレコードが残る場合があるため、再実行前に確認SOQLまたはクリーンアップ方針を確認する。
