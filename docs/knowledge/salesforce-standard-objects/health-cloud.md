# Health Cloud の標準オブジェクト

Health Cloud は、患者、関係者、ケア計画、問い合わせを中心に扱います。組織や導入方式によって、業界固有オブジェクトの API 名や名前空間が異なる場合があります。

製品ページ: [Health Cloud](https://www.salesforce.com/healthcare-life-sciences/)

| ラベル               | API 名                    | 役割                       |
| -------------------- | ------------------------- | -------------------------- |
| 取引先               | `Account`                 | 医療機関、世帯、組織       |
| 取引先責任者         | `Contact`                 | 患者、家族、関係者         |
| ケース               | `Case`                    | 問い合わせ、相談、支援依頼 |
| ケア計画             | `CarePlan`                | 患者ごとのケア計画         |
| ケア計画テンプレート | `CarePlanTemplate`        | ケア計画のひな形           |
| ToDo                 | `Task`                    | ケアタスク、フォローアップ |
| 行動                 | `Event`                   | 面談、診療、訪問予定       |
| ナレッジ             | `KnowledgeArticleVersion` | 医療、支援、手順ナレッジ   |
| ファイル             | `ContentDocument`         | 診断書、添付資料           |
