# Sales / Service で使う主要な標準オブジェクト

Sales Cloud と Service Cloud では、顧客、商談、商品、契約、問い合わせ、活動などを複数の標準オブジェクトで表します。

このページは、Sales と Service の製品領域でよく使う標準オブジェクトを重複なしで整理した早見表です。組織のライセンス、機能有効化、権限によって利用可否や見え方は変わります。

## 主要オブジェクト

| 表示名             | API 名                    | 主な用途                             |
| ------------------ | ------------------------- | ------------------------------------ |
| 取引先             | `Account`                 | 顧客企業、組織、個人取引先           |
| 取引先責任者       | `Contact`                 | 顧客側の担当者                       |
| リード             | `Lead`                    | 見込み客、未評価の商談候補           |
| 商談               | `Opportunity`             | 案件、売上見込み、営業パイプライン   |
| 商談商品           | `OpportunityLineItem`     | 商談に含まれる商品明細               |
| 商品               | `Product2`                | 販売、契約、サポート対象の商品       |
| 価格表             | `Pricebook2`              | 商品価格のまとまり                   |
| 価格表エントリ     | `PricebookEntry`          | 価格表ごとの商品価格                 |
| 納入商品           | `Asset`                   | 顧客が保有、利用している商品         |
| キャンペーン       | `Campaign`                | マーケティング施策、リード獲得活動   |
| ケース             | `Case`                    | 問い合わせ、サポート案件、障害対応   |
| 契約               | `Contract`                | 顧客との契約情報                     |
| 注文               | `Order`                   | 受注、注文、販売確定後の取引         |
| 注文商品           | `OrderItem`               | 注文に含まれる商品明細               |
| エンタイトルメント | `Entitlement`             | サポート権利、SLA、対応条件          |
| サービス契約       | `ServiceContract`         | 保守契約、サービス提供契約           |
| 作業指示           | `WorkOrder`               | 現地作業、修理、保守作業             |
| 作業指示品目       | `WorkOrderLineItem`       | 作業指示に含まれる作業明細           |
| ナレッジ           | `KnowledgeArticleVersion` | FAQ、手順書、サポートナレッジ        |
| 行動               | `Event`                   | カレンダー予定、会議、訪問           |
| ToDo               | `Task`                    | タスク、架電、フォローアップ         |
| メールメッセージ   | `EmailMessage`            | ケースなどに紐づくメール本文と履歴   |
| メールテンプレート | `EmailTemplate`           | メール文面テンプレート               |
| 承認申請           | `ProcessInstance`         | 承認プロセスに送信された申請         |
| 承認作業項目       | `ProcessInstanceWorkitem` | 未処理の承認依頼、承認待ち作業       |
| 承認履歴           | `ProcessInstanceStep`     | 承認、却下、再割り当てなどの履歴     |
| ユーザー           | `User`                    | 所有者、担当者、承認者、実行ユーザー |

## 見方

Sales の中心は `Lead`、`Account`、`Contact`、`Opportunity`、`OpportunityLineItem`、`Product2`、`Pricebook2` です。

Service の中心は `Case`、`Entitlement`、`ServiceContract`、`WorkOrder`、`KnowledgeArticleVersion`、`EmailMessage` です。

`Account`、`Contact`、`Product2`、`Asset`、`Contract`、`Order`、`Task`、`Event`、`ProcessInstance`、`User` は Sales と Service の両方で参照されやすい共通オブジェクトです。

## 関連・補助オブジェクト

次のオブジェクトは中心データではありませんが、Sales / Service の周辺機能、履歴、ロール、添付、チャネル連携を扱うときによく出てきます。

| 表示名                   | API 名                   | 主な用途                                 |
| ------------------------ | ------------------------ | ---------------------------------------- |
| 取引先責任者関連         | `AccountContactRelation` | 複数取引先と取引先責任者の関係           |
| 商談責任者の役割         | `OpportunityContactRole` | 商談に関わる取引先責任者の役割           |
| 見積                     | `Quote`                  | 商談に紐づく見積                         |
| 見積品目                 | `QuoteLineItem`          | 見積に含まれる商品明細                   |
| キャンペーンメンバー     | `CampaignMember`         | キャンペーンとリード、取引先責任者の関係 |
| 契約品目                 | `ContractLineItem`       | 契約に含まれる商品、サービス明細         |
| ケースコメント           | `CaseComment`            | ケースに対するコメント                   |
| ケースチームメンバー     | `CaseTeamMember`         | ケース対応に参加するユーザー             |
| ケースマイルストーン     | `CaseMilestone`          | ケース SLA の達成状況                    |
| マイルストーン種別       | `MilestoneType`          | SLA マイルストーンの定義                 |
| エンタイトルメント連絡先 | `EntitlementContact`     | サポート権利に紐づく取引先責任者         |
| ファイル                 | `ContentDocument`        | Salesforce Files の文書単位              |
| ファイルバージョン       | `ContentVersion`         | ファイルの版                             |
| ファイルリンク           | `ContentDocumentLink`    | ファイルとレコードの関連                 |
| フィード項目             | `FeedItem`               | Chatter 投稿、レコードフィード           |
| メール関連               | `EmailMessageRelation`   | メールと送受信者、関連レコードの関係     |
| 承認プロセス定義         | `ProcessDefinition`      | 承認プロセスの定義                       |
| チャット記録             | `LiveChatTranscript`     | Web チャットの会話履歴                   |
| メッセージングセッション | `MessagingSession`       | デジタルチャネルの会話セッション         |
| 音声通話                 | `VoiceCall`              | 電話連携、コンタクトセンター通話         |
| サービス予定             | `ServiceAppointment`     | Field Service の訪問、作業予定           |
| サービスリソース         | `ServiceResource`        | Field Service の作業者、設備             |
| サービス区域             | `ServiceTerritory`       | Field Service の担当エリア               |
| 作業種別                 | `WorkType`               | 作業指示やサービス予定の作業テンプレート |
| 返品注文                 | `ReturnOrder`            | 返品、交換、返金などの依頼               |
| 返品注文品目             | `ReturnOrderLineItem`    | 返品注文に含まれる商品明細               |

## 参考リンク

- [Object Reference for the Salesforce Platform](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference)
