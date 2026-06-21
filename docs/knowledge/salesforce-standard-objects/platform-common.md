# Platform 共通の標準オブジェクト

Platform 共通のオブジェクトは、製品横断で所有者、活動、ファイル、フィード、承認申請などを支えます。

製品ページ: [Salesforce Platform](https://www.salesforce.com/platform/)

| ラベル             | API 名                    | 役割                                 |
| ------------------ | ------------------------- | ------------------------------------ |
| ユーザー           | `User`                    | 所有者、担当者、承認者、実行ユーザー |
| 行動               | `Event`                   | カレンダー予定、会議、訪問           |
| ToDo               | `Task`                    | タスク、架電、フォローアップ         |
| ファイル           | `ContentDocument`         | Salesforce Files の文書単位          |
| ファイルバージョン | `ContentVersion`          | ファイルの版                         |
| ファイルリンク     | `ContentDocumentLink`     | ファイルとレコードの関連             |
| フィード項目       | `FeedItem`                | Chatter 投稿、レコードフィード       |
| 承認申請           | `ProcessInstance`         | 承認プロセスに送信された申請         |
| 承認作業項目       | `ProcessInstanceWorkitem` | 未処理の承認依頼、承認待ち作業       |
| 承認履歴           | `ProcessInstanceStep`     | 承認、却下、再割り当てなどの履歴     |
| 承認プロセス定義   | `ProcessDefinition`       | 承認プロセスの定義                   |
| メールテンプレート | `EmailTemplate`           | メール文面テンプレート               |
