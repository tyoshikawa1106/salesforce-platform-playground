# 主要標準オブジェクト seed

Sales / Service でよく使う標準オブジェクトの合成テストデータを作成します。

各オブジェクトにつき 2,000 件を目安に作成します。`Account` は標準 Duplicate Rule の 200 件チャンク判定を避けるため 1 回で 2,000 件作成し、その他の関連オブジェクトは 1 回 50 件ずつ、plan の `repeat` で 40 サイクル実行します。関連先の親レコードはサイクルごとにローテーションし、最新 50 件だけに偏らないようにします。レイアウトにある標準項目のうち、対象 org で DML insert 可能な項目には合成値を設定します。

## 作成対象

- `Account`
- `Contact`
- `Lead`
- `Campaign`
- `CampaignMember`
- `Product2`
- `Pricebook2`
- `PricebookEntry`
- `Opportunity`
- `OpportunityContactRole`
- `OpportunityLineItem`
- `Contract`
- `Order`
- `OrderItem`
- `Asset`
- `Case`
- `Entitlement`
- `ServiceContract`
- `Task`
- `Event`
- `WorkOrder`
- `WorkOrderLineItem`
- `EmailMessage`
- `ContentVersion`

次の表示対象は DML seed の対象外です。

- `Knowledge`: 対象 Scratch Org で Knowledge article sObject が利用できない場合がある。
- `Report`, `Dashboard`: metadata-backed のため、DML seed では作成しない。
- `User`: 追加ユーザーはライセンスとプロファイル設計が必要なため、seed では作成しない。
- `EmailTemplate`: Email folder がある org だけ optional に作成する。

## 実行

dry-run で実行予定コマンドを確認します。

```sh
npm run data:seed:standard:dry-run
```

接続済み org に seed を投入します。

```sh
npm run data:seed:standard -- --target-org <alias>
```

seed は execute anonymous の CPU / サイズ制限を避けるため、次のフェーズで順番に実行します。

- `seed-standard-accounts.apex`
- `seed-standard-contacts-leads.apex`
- `seed-standard-campaign-product-price.apex`
- `seed-standard-sales.apex`
- `seed-standard-service.apex`
- `seed-standard-activity-content.apex`

## cleanup

seed 実行時の接頭辞 `[TEST]` で対象を削除します。cleanup は governor limit を避けるため、各オブジェクト最大 100 件ずつ削除します。大量投入後は `Deleted records: none` になるまで複数回実行します。

```sh
sf apex run --file data/test-data/standard-objects/cleanup-standard-objects.apex --target-org <alias>
```

## 注意

- 実行前に `sf org display --target-org <alias>` で対象 org を確認する。
- 組織の機能や権限によって、一部の標準オブジェクトは作成できない場合がある。
- seed script は optional object の失敗を debug log に出し、作成可能な範囲を続行する。
- `Account.Name` は `[TEST]A0001` 形式のテスト番号を先頭に含める。名称中の都道府県と請求先/納入先住所の都道府県は一致させる。
