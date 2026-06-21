# Financial Services Cloud の標準オブジェクト

Financial Services Cloud は、顧客、世帯、関係者、金融口座を中心に扱います。組織や導入方式によって、業界固有オブジェクトの API 名や名前空間が異なる場合があります。

製品ページ: [Financial Services Cloud](https://www.salesforce.com/financial-services/)

| ラベル           | API 名                   | 役割                         |
| ---------------- | ------------------------ | ---------------------------- |
| 取引先           | `Account`                | 世帯、法人、顧客グループ     |
| 取引先責任者     | `Contact`                | 個人顧客、関係者             |
| 取引先責任者関連 | `AccountContactRelation` | 世帯、法人、個人の関係       |
| 金融口座         | `FinancialAccount`       | 銀行口座、投資口座、保険契約 |
| 商談             | `Opportunity`            | 金融商品、契約、提案案件     |
| ケース           | `Case`                   | 顧客相談、手続き、問い合わせ |
| ToDo             | `Task`                   | フォローアップ、手続きタスク |
| 行動             | `Event`                  | 面談、相談、訪問             |
| 承認申請         | `ProcessInstance`        | 申請、承認プロセス           |
