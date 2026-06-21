# Data Cloud の標準オブジェクト

Data Cloud は CRM の標準オブジェクトとは別に、データストリーム、Data Lake Object、Data Model Object などのデータモデルを扱います。CRM 側の標準オブジェクトとして見る場合は、同期元または連携先として次のオブジェクトが中心になります。

製品ページ: [Data Cloud](https://www.salesforce.com/data/)

| ラベル       | API 名       | 役割                         |
| ------------ | ------------ | ---------------------------- |
| 取引先       | `Account`    | 顧客企業、統合対象の組織     |
| 取引先責任者 | `Contact`    | 顧客担当者、個人プロファイル |
| リード       | `Lead`       | 見込み客                     |
| 個人         | `Individual` | プライバシー、同意管理の対象 |
| ケース       | `Case`       | 顧客対応履歴                 |
| 注文         | `Order`      | 購買履歴                     |
| 注文商品     | `OrderItem`  | 購買明細                     |
| 納入商品     | `Asset`      | 保有商品、利用中の商品       |
