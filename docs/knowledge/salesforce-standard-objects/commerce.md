# Commerce の標準オブジェクト

Commerce 領域では、商品、価格、顧客、注文、返品を中心に扱います。

製品ページ: [Commerce Cloud](https://www.salesforce.com/commerce/)

| ラベル         | API 名                | 役割                       |
| -------------- | --------------------- | -------------------------- |
| 取引先         | `Account`             | 購入企業、購入者の所属先   |
| 取引先責任者   | `Contact`             | 購入者、担当者             |
| 商品           | `Product2`            | 販売商品                   |
| 価格表         | `Pricebook2`          | 商品価格のまとまり         |
| 価格表エントリ | `PricebookEntry`      | 商品ごとの価格             |
| 注文           | `Order`               | 注文                       |
| 注文商品       | `OrderItem`           | 注文に含まれる商品明細     |
| 返品注文       | `ReturnOrder`         | 返品、交換、返金などの依頼 |
| 返品注文品目   | `ReturnOrderLineItem` | 返品注文に含まれる商品明細 |
| 納入商品       | `Asset`               | 購入後に顧客が保有する商品 |
