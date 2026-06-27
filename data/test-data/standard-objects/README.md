# 主要標準オブジェクト seed

Sales / Service でよく使う標準オブジェクトの合成テストデータを作成します。

各オブジェクトにつき 2,000 件を目安に作成します。`Account` は標準 Duplicate Rule の 200 件チャンク判定を避けるため 1 回で 2,000 件作成し、その他の関連オブジェクトは 1 回 50 件ずつ、plan の `repeat` で 40 サイクル実行します。`Campaign` は前年・今年・来年の月次キャンペーン 36 件、`Product2` / `PricebookEntry` はオフィス備品販売を想定した定義済み商品カタログとして作成・更新し、repeat で件数を増やしません。関連先の親レコードはサイクルごとにローテーションし、最新 50 件だけに偏らないようにします。レイアウトにある標準項目のうち、対象 org で DML insert 可能な項目には合成値を設定します。

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
- `Pricebook2`: seed はカスタム価格表を作成せず、標準価格表を有効化して `PricebookEntry` を作成する。
- `Campaign`: 前年・今年・来年の各月 1 件ずつ、月次の office product campaign として作成する。
- `Product2`: ノートPC、モニター、会議機器、オフィス家具、ソフトウェアなどの office product catalog として作成する。

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
- `Account.Name` は `[TEST] さくらデータ企画株式会社` のように、テスト接頭辞と自然な会社名で構成する。請求先/納入先住所の都道府県は `State` で設定し、State/Country Picklist の有無に依存しない。
- `Name`、`LastName`、`Subject`、`Title` など画面に表示される主要名称には、連番プレフィックスを付けない。内部識別が必要な値はメール、URL、外部識別用フィールド、ファイルパスなどに保持する。
