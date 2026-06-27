# Salesforce CLI テストデータインポート

Salesforce CLI で、リポジトリ管理された合成テストデータを org に投入する手順です。

## 使い分け

この仕組みは、画面操作や Flow / Trigger の動作確認など、org 上に一時的なテストレコードが必要な場合に使います。

Apex テストでは、組織内データに依存せず、テスト内で `TestDataFactory` などを使ってデータを作成します。

## ファイル構成

- `data/test-data/import-plan.json`: 投入対象の順序、SObject、CSV を定義する。
- `data/test-data/standard-objects/import-plan.json`: 主要標準オブジェクト seed の実行計画。
- `data/test-data/*.csv`: Salesforce CLI に渡す CSV。
- `data/test-data/standard-objects/*.apex`: 関連レコードを作成・削除する anonymous Apex。
- `scripts/data/import-test-data.js`: import plan を読み、`sf data import bulk` または `sf apex run` を実行する。

## 事前確認

対象 org を確認します。

```sh
sf org display --target-org <alias>
```

CSV の列が対象 SObject に作成可能か不明な場合は describe を確認します。

```sh
sf sobject describe --sobject Account --target-org <alias> --json
```

## dry-run

実行前に、ローカルファイルと実行予定コマンドを確認します。

```sh
npm run data:import:test:dry-run
```

## import

接続済み org に投入します。明示的に `--target-org` を指定します。

```sh
npm run data:import:test -- --target-org <alias>
```

特定の plan entry だけ投入します。

```sh
npm run data:import:test -- --target-org <alias> --only accounts
```

## 主要標準オブジェクト seed

主要標準オブジェクトは親子関係や価格表 ID を必要とするため、CSV の一括投入ではなく、Salesforce CLI から anonymous Apex を実行します。

各オブジェクトにつき 2,000 件を目安に作成します。`Account` は標準 Duplicate Rule の 200 件チャンク判定を避けるため 1 回で 2,000 件作成し、その他の関連オブジェクトは 1 回 50 件ずつ、plan の `repeat` で 40 サイクル実行します。関連先の親レコードはサイクルごとにローテーションし、最新 50 件だけに偏らないようにします。レイアウトにある標準項目のうち、対象 org で DML insert 可能な項目には合成値を設定します。

execute anonymous の CPU / サイズ制限を避けるため、accounts、contacts-leads、campaign-product-price、sales、service、activity-content の 6 フェーズに分けて実行します。

```sh
npm run data:seed:standard:dry-run
npm run data:seed:standard -- --target-org <alias>
```

作成対象は次のとおりです。

| 分類             | API 名                                                         |
| ---------------- | -------------------------------------------------------------- |
| 顧客             | `Account`, `Contact`, `Lead`                                   |
| キャンペーン     | `Campaign`, `CampaignMember`                                   |
| 商品・価格       | `Product2`, `Pricebook2`, `PricebookEntry`                     |
| 商談             | `Opportunity`, `OpportunityContactRole`, `OpportunityLineItem` |
| 契約・注文       | `Contract`, `Order`, `OrderItem`                               |
| サポート         | `Asset`, `Case`, `Entitlement`, `ServiceContract`              |
| 作業指示         | `WorkOrder`, `WorkOrderLineItem`                               |
| 活動             | `Task`, `Event`                                                |
| メール・ファイル | `EmailMessage`, `ContentVersion`                               |

組織の機能や権限で作成できない optional object は、debug log に理由を出して、作成可能な範囲を続行します。`Account.Name` は `[TEST] さくらデータ企画株式会社` のように、テスト接頭辞と自然な会社名で構成します。請求先/納入先住所の都道府県は `State` で設定し、State/Country Picklist の有無に依存しないようにします。`Name`、`LastName`、`Subject`、`Title` など画面に表示される主要名称には連番プレフィックスを付けず、内部識別が必要な値はメール、URL、外部識別用フィールド、ファイルパスなどに保持します。

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

大量データを扱う場合は、削除用 CSV を作って `sf data delete bulk` を使います。

```sh
sf data delete bulk --file data/test-data/delete-accounts.csv --sobject Account --target-org <alias> --wait 30
```

主要標準オブジェクト seed は、接頭辞 `[TEST]` を使って cleanup します。cleanup は governor limit を避けるため、各オブジェクト最大 100 件ずつ削除します。大量投入後は `Deleted records: none` になるまで複数回実行します。

```sh
sf apex run --file data/test-data/standard-objects/cleanup-standard-objects.apex --target-org <alias>
```

## データ追加時の注意

- 実在の個人情報、顧客情報、秘密情報を入れない。
- org 固有の ID を固定しない。
- validation rule、required field、picklist 値を describe で確認する。
- 親子関係のあるデータは親から投入する。
- Trigger / Flow の bulk 動作を見たい場合は、200 件境界を超える件数を用意する。
