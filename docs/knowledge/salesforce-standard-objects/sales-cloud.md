# Sales Cloud の標準オブジェクト

Sales Cloud は、見込み客、顧客、商談、商品、見積、営業活動を中心に扱います。

製品ページ: [Sales Cloud](https://www.salesforce.com/sales/)

| ラベル               | API 名                   | 役割                                     |
| -------------------- | ------------------------ | ---------------------------------------- |
| リード               | `Lead`                   | 見込み客、未評価の商談候補               |
| 取引先               | `Account`                | 顧客企業、組織、個人取引先               |
| 取引先責任者         | `Contact`                | 顧客側の担当者                           |
| 取引先責任者関連     | `AccountContactRelation` | 複数取引先と取引先責任者の関係           |
| 商談                 | `Opportunity`            | 案件、売上見込み、営業パイプライン       |
| 商談商品             | `OpportunityLineItem`    | 商談に含まれる商品明細                   |
| 商談責任者の役割     | `OpportunityContactRole` | 商談に関わる取引先責任者の役割           |
| 商品                 | `Product2`               | 販売対象の商品                           |
| 価格表               | `Pricebook2`             | 商品価格のまとまり                       |
| 価格表エントリ       | `PricebookEntry`         | 価格表ごとの商品価格                     |
| 見積                 | `Quote`                  | 商談に紐づく見積                         |
| 見積品目             | `QuoteLineItem`          | 見積に含まれる商品明細                   |
| キャンペーン         | `Campaign`               | マーケティング施策、リード獲得活動       |
| キャンペーンメンバー | `CampaignMember`         | キャンペーンとリード、取引先責任者の関係 |
| 行動                 | `Event`                  | 営業予定、会議、訪問                     |
| ToDo                 | `Task`                   | 架電、フォローアップ、営業タスク         |
