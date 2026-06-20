# Nonprofit / Education の標準オブジェクト

Nonprofit Cloud や Education Cloud は、支援者、世帯、寄付、相談、学生や関係者を中心に扱います。組織や導入方式によって、業界固有オブジェクトの API 名や名前空間が異なる場合があります。

製品ページ: [Nonprofit Cloud](https://www.salesforce.org/nonprofit/) / [Education Cloud](https://www.salesforce.org/education/)

| ラベル               | API 名                   | 役割                         |
| -------------------- | ------------------------ | ---------------------------- |
| 取引先               | `Account`                | 世帯、法人、団体、教育機関   |
| 取引先責任者         | `Contact`                | 支援者、学生、保護者、関係者 |
| 取引先責任者関連     | `AccountContactRelation` | 世帯、団体、個人の関係       |
| 商談                 | `Opportunity`            | 寄付、助成、入学、支援案件   |
| キャンペーン         | `Campaign`               | 募金、イベント、募集施策     |
| キャンペーンメンバー | `CampaignMember`         | 施策への参加、反応           |
| ケース               | `Case`                   | 相談、支援依頼、問い合わせ   |
| ToDo                 | `Task`                   | フォローアップ、支援タスク   |
| 行動                 | `Event`                  | 面談、イベント、訪問         |
