# Revenue Cloud / CPQ の標準オブジェクト

Revenue Cloud / CPQ 領域では、商品、価格、見積、契約、注文を中心に扱います。

製品ページ: [Revenue Cloud](https://www.salesforce.com/sales/revenue-lifecycle-management/revenue-cloud/)

| ラベル         | API 名                | 役割                             |
| -------------- | --------------------- | -------------------------------- |
| 取引先         | `Account`             | 契約、注文、請求先の顧客         |
| 取引先責任者   | `Contact`             | 顧客側の担当者                   |
| 商談           | `Opportunity`         | 案件、売上見込み                 |
| 商談商品       | `OpportunityLineItem` | 商談に含まれる商品明細           |
| 商品           | `Product2`            | 販売、契約、サポート対象の商品   |
| 価格表         | `Pricebook2`          | 商品価格のまとまり               |
| 価格表エントリ | `PricebookEntry`      | 価格表ごとの商品価格             |
| 見積           | `Quote`               | 顧客へ提示する見積               |
| 見積品目       | `QuoteLineItem`       | 見積に含まれる商品明細           |
| 契約           | `Contract`            | 顧客との契約情報                 |
| 契約品目       | `ContractLineItem`    | 契約に含まれる商品、サービス明細 |
| 注文           | `Order`               | 受注、注文、販売確定後の取引     |
| 注文商品       | `OrderItem`           | 注文に含まれる商品明細           |
| 納入商品       | `Asset`               | 契約、販売後に顧客が保有する商品 |
