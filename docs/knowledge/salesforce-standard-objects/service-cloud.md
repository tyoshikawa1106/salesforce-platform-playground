# Service Cloud の標準オブジェクト

Service Cloud は、問い合わせ、サポート対応、SLA、メール、ナレッジを中心に扱います。

製品ページ: [Service Cloud](https://www.salesforce.com/service/)

| ラベル                   | API 名                    | 役割                                 |
| ------------------------ | ------------------------- | ------------------------------------ |
| 取引先                   | `Account`                 | 問い合わせ元の顧客企業、組織         |
| 取引先責任者             | `Contact`                 | 問い合わせ元の人物                   |
| ケース                   | `Case`                    | 問い合わせ、サポート案件、障害対応   |
| ケースコメント           | `CaseComment`             | ケースに対するコメント               |
| ケースチームメンバー     | `CaseTeamMember`          | ケース対応に参加するユーザー         |
| メールメッセージ         | `EmailMessage`            | ケースなどに紐づくメール本文と履歴   |
| メール関連               | `EmailMessageRelation`    | メールと送受信者、関連レコードの関係 |
| エンタイトルメント       | `Entitlement`             | サポート権利、SLA、対応条件          |
| エンタイトルメント連絡先 | `EntitlementContact`      | サポート権利に紐づく取引先責任者     |
| マイルストーン種別       | `MilestoneType`           | SLA マイルストーンの定義             |
| ケースマイルストーン     | `CaseMilestone`           | ケース SLA の達成状況                |
| サービス契約             | `ServiceContract`         | 保守、サービス提供契約               |
| 納入商品                 | `Asset`                   | 保守、問い合わせ、交換の対象商品     |
| ナレッジ                 | `KnowledgeArticleVersion` | FAQ、手順書、サポートナレッジ        |
| ToDo                     | `Task`                    | フォローアップ、作業タスク           |
