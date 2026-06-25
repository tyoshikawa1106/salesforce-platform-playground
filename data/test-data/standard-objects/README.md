# 主要標準オブジェクト seed

Sales / Service でよく使う標準オブジェクトの合成テストデータを作成します。

## 作成対象

- `Account`
- `Contact`
- `Lead`
- `Campaign`
- `CampaignMember`
- `Product2`
- `PricebookEntry`
- `Opportunity`
- `OpportunityContactRole`
- `OpportunityLineItem`
- `Contract`
- `Order`
- `OrderItem`
- `Asset`
- `Case`
- `Task`
- `Event`
- `WorkOrder`
- `WorkOrderLineItem`

## 実行

dry-run で実行予定コマンドを確認します。

```sh
npm run data:seed:standard:dry-run
```

接続済み org に seed を投入します。

```sh
npm run data:seed:standard -- --target-org <alias>
```

## cleanup

seed 実行時の接頭辞 `CLI Standard Seed` で対象を削除します。

```sh
sf apex run --file data/test-data/standard-objects/cleanup-standard-objects.apex --target-org <alias>
```

## 注意

- 実行前に `sf org display --target-org <alias>` で対象 org を確認する。
- 組織の機能や権限によって、一部の標準オブジェクトは作成できない場合がある。
- seed script は optional object の失敗を debug log に出し、作成可能な範囲を続行する。
