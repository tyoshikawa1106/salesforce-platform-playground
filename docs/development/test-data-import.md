# Salesforce CLI テストデータインポート

Salesforce CLI で、リポジトリ管理された合成テストデータを org に投入する手順です。

## 使い分け

この仕組みは、画面操作や Flow / Trigger の動作確認など、org 上に一時的なテストレコードが必要な場合に使います。

Apex テストでは、組織内データに依存せず、テスト内で `TestDataFactory` などを使ってデータを作成します。

## ファイル構成

- `data/test-data/standard-objects/import-plan.json`: 主要標準オブジェクト seed の実行計画。
- `scripts/apex/test-data/standard-objects/*.apex`: 関連レコードを作成・削除する anonymous Apex。
- `scripts/data/import-test-data.js`: import plan を読み、`sf data import bulk` または `sf apex run` を実行する。

## 事前確認

対象 org を確認します。

```sh
sf org display --target-org <alias>
```

## dry-run

実行前に、ローカルファイルと実行予定コマンドを確認します。

```sh
npm run data:seed:standard:dry-run
```

## 主要標準オブジェクト seed

主要標準オブジェクトは親子関係や価格表 ID を必要とするため、CSV の一括投入ではなく、Salesforce CLI から anonymous Apex を実行します。

通常 org では各オブジェクトにつき 50 件、Scratch Org では各オブジェクトにつき 2,000 件を目安に作成します。`Account` は通常 org では 1 回で 50 件、Scratch Org では一時 Apex ファイルで 2,000 件作成し、その他の関連オブジェクトは 1 回 50 件ずつ、plan の `repeat` / `scratchOrgRepeat` で実行します。`Campaign` は前年・今年・来年の月次キャンペーン 36 件、`Product2` / `PricebookEntry` はオフィス備品販売を想定した定義済み商品カタログとして作成・更新し、repeat で件数を増やしません。関連先の親レコードはサイクルごとにローテーションし、最新 50 件だけに偏らないようにします。レイアウトにある標準項目のうち、対象 org で DML insert 可能な項目には合成値を設定します。

execute anonymous の CPU / サイズ制限を避けるため、1 つの primary object につき 1 つの anonymous Apex ファイルに分け、`data/test-data/standard-objects/import-plan.json` の順序で実行します。

```sh
npm run data:seed:standard:dry-run
npm run data:seed:standard -- --target-org <alias>
```

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

通常 org では各オブジェクト 50 件規模で作成します。Scratch Org では `sf org list --all --json` の scratch org 一覧に対象 alias / username / orgId が含まれる場合、`scratchOrgRepeat` と `scratchOrgCountPerObject` を使って 2,000 件規模へ自動拡張します。組織の機能や権限で作成できない optional object は、debug log に理由を出して、作成可能な範囲を続行します。キャンペーンは前年・今年・来年の各月 1 件ずつ作成します。商品価格はカスタム価格表を作成せず、標準価格表を有効化して `PricebookEntry` を作成します。商品マスターはノートPC、モニター、会議機器、オフィス家具、ソフトウェアなどの office product catalog として作成します。`Account.Name` は `[TEST] さくらデータ企画株式会社` のように、テスト接頭辞と自然な会社名で構成します。請求先/納入先住所の都道府県は `State` で設定し、State/Country Picklist の有無に依存しないようにします。`Name`、`LastName`、`Subject`、`Title` など画面に表示される主要名称には連番プレフィックスを付けず、内部識別が必要な値はメール、URL、外部識別用フィールド、ファイルパスなどに保持します。

`Knowledge`, `Report`, `Dashboard`, `User` は画面上の集計対象に含まれていても、この DML seed では作成しません。Knowledge article sObject は org の機能状態に依存し、Report / Dashboard は metadata-backed、追加 User はライセンスとプロファイル設計が必要なためです。

## cleanup

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

主要標準オブジェクト seed は、接頭辞 `[TEST]` を使って cleanup します。cleanup は governor limit を避けるため、各オブジェクト最大 100 件ずつ削除します。大量投入後は `Deleted records: none` になるまで複数回実行します。

```sh
sf apex run --file scripts/apex/test-data/standard-objects/cleanup-standard-objects.apex --target-org <alias>
```

## データ追加時の注意

- 実在の個人情報、顧客情報、秘密情報を入れない。
- org 固有の ID を固定しない。
- validation rule、required field、picklist 値を describe で確認する。
- 親子関係のあるデータは親から投入する。
- Trigger / Flow の bulk 動作を見たい場合は、200 件境界を超える件数を用意する。
