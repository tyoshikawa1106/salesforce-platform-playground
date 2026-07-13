# Field Service の標準オブジェクト

Field Service は、現地作業、作業予定、作業者、担当エリア、納入商品を中心に扱います。

製品ページ: [Field Service](https://www.salesforce.com/service/field-service-management/)

| ラベル           | API 名               | 役割                                     |
| ---------------- | -------------------- | ---------------------------------------- |
| 取引先           | `Account`            | 作業先の顧客企業、組織                   |
| 取引先責任者     | `Contact`            | 作業先の担当者                           |
| ケース           | `Case`               | 作業につながる問い合わせ、依頼           |
| 作業指示         | `WorkOrder`          | 現地作業、修理、保守作業                 |
| 作業指示品目     | `WorkOrderLineItem`  | 作業指示に含まれる作業明細               |
| サービス予定     | `ServiceAppointment` | 訪問、作業予定、派遣スケジュール         |
| サービスリソース | `ServiceResource`    | 作業者、設備、車両などのリソース         |
| サービス区域     | `ServiceTerritory`   | 作業担当エリア                           |
| 作業種別         | `WorkType`           | 作業指示やサービス予定の作業テンプレート |
| 納入商品         | `Asset`              | 保守、修理、交換の対象商品               |
| サービス契約     | `ServiceContract`    | 保守、サービス提供契約                   |
| 商品             | `Product2`           | 交換、作業、契約対象の商品               |
