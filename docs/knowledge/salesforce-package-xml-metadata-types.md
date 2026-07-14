# retrieve 対象メタデータ一覧

この文書は、組織から retrieve する Salesforce メタデータの主要カテゴリを整理します。

各 manifest は API 67.0 を前提にしています。

- `manifest/retrieve-all.xml` は、取得対象とするメタデータ型 217 件の確認用 catalog。
- `manifest/retrieve-profile.xml` は、スクリプトでProfileと関連メタデータ14件を同時に取得する最初の retrieve scope。
- applicationとorganizationのメタデータ199件は、1回のretrieveが10,000ファイルを超えないよう、責務別の25個のretrieve scopeに分ける。
- `manifest/retrieve-translations.xml` は、4種類の翻訳メタデータと内容を構成する関連メタデータ8件を同時に取得する最後の retrieve scope。
- `manifest/package.xml` は、Apex、Aura、LWC、静的リソース、Flowを手動で取得する9件の作業用 manifest。
- `CustomObject` は標準オブジェクトを個別指定し、最後にカスタムオブジェクト用の `*` を残す。

## コード / UI コンポーネント

| メタデータ型               | 取得できる内容                   |
| -------------------------- | -------------------------------- |
| `ApexClass`                | Apex クラスとテストクラス        |
| `ApexTrigger`              | Apex トリガー                    |
| `ApexPage`                 | Visualforce ページ               |
| `ApexComponent`            | Visualforce コンポーネント       |
| `ApexTestSuite`            | Apex テストスイート              |
| `AuraDefinitionBundle`     | Aura コンポーネントバンドル      |
| `LightningComponentBundle` | Lightning Web Component バンドル |
| `StaticResource`           | 静的リソース                     |

## 共有 / 補助リソース

| メタデータ型              | 取得できる内容                       |
| ------------------------- | ------------------------------------ |
| `LightningMessageChannel` | Lightning Message Service のチャネル |
| `DataWeaveResource`       | Apex から使う DataWeave スクリプト   |

## アプリケーション / ナビゲーション

| メタデータ型        | 取得できる内容                     |
| ------------------- | ---------------------------------- |
| `CustomApplication` | Lightning アプリ、Classic アプリ   |
| `CustomTab`         | カスタムタブ、Web タブ             |
| `AppMenu`           | アプリランチャーやモバイルメニュー |

## 画面 / レイアウト

| メタデータ型               | 取得できる内容                         |
| -------------------------- | -------------------------------------- |
| `FlexiPage`                | Lightning Record Page や Home Page     |
| `Layout`                   | ページレイアウト                       |
| `CompactLayout`            | コンパクトレイアウト                   |
| `QuickAction`              | クイックアクション                     |
| `LightningExperienceTheme` | Lightning Experience のテーマ設定      |
| `BrandingSet`              | ブランドカラーやロゴなどのブランド設定 |

## オブジェクト / データモデル

| メタデータ型           | 取得できる内容                             |
| ---------------------- | ------------------------------------------ |
| `CustomObject`         | カスタムオブジェクトと標準オブジェクト定義 |
| `CustomField`          | オブジェクト項目                           |
| `RecordType`           | レコードタイプ                             |
| `BusinessProcess`      | 商談、ケース、リードなどの業務プロセス     |
| `FieldSet`             | 項目セット                                 |
| `ListView`             | リストビュー                               |
| `ValidationRule`       | 入力規則                                   |
| `WebLink`              | カスタムボタン、リンク                     |
| `CustomMetadata`       | カスタムメタデータレコード                 |
| `CustomLabels`         | カスタム表示ラベル                         |
| `CustomPermission`     | カスタム権限                               |
| `GlobalValueSet`       | グローバル選択リスト値セット               |
| `StandardValueSet`     | 標準項目の選択リスト値セット               |
| `BusinessProcessGroup` | ビジネスプロセスグループ                   |
| `Index`                | インデックス                               |
| `CustomIndex`          | カスタムインデックス                       |

### CustomObject の標準オブジェクト指定

`CustomObject` の `*` はカスタムオブジェクト取得用です。標準オブジェクトのカスタマイズ情報を取得するため、次の標準オブジェクトを個別指定しています。

| Member                       | 取得できる内容                                 |
| ---------------------------- | ---------------------------------------------- |
| `Account`                    | 取引先オブジェクトの項目、レイアウト等         |
| `Activity`                   | 活動の項目、レイアウト等                       |
| `Asset`                      | 納入商品オブジェクトの項目、レイアウト等       |
| `AssetRelationship`          | 納入商品リレーションの項目、レイアウト等       |
| `AssociatedLocation`         | 関連付けられたロケーションの項目、レイアウト等 |
| `Campaign`                   | キャンペーンオブジェクトの項目、レイアウト等   |
| `CampaignMember`             | キャンペーンメンバーの項目、レイアウト等       |
| `Case`                       | ケースオブジェクトの項目、レイアウト等         |
| `Contact`                    | 取引先責任者オブジェクトの項目、レイアウト等   |
| `ContentDocument`            | ファイルの文書単位オブジェクト定義             |
| `ContentVersion`             | ファイルバージョンの項目、レイアウト等         |
| `ConsumptionRate`            | 消費率の項目、レイアウト等                     |
| `ConsumptionSchedule`        | 消費スケジュールの項目、レイアウト等           |
| `Contract`                   | 契約オブジェクトの項目、レイアウト等           |
| `ContractLineItem`           | 契約品目の項目、レイアウト等                   |
| `EmailMessage`               | メールメッセージオブジェクト定義               |
| `Entitlement`                | エンタイトルメントオブジェクト定義             |
| `Event`                      | 行動オブジェクトの項目、レイアウト等           |
| `Individual`                 | 個人オブジェクトの項目、レイアウト等           |
| `Lead`                       | リードオブジェクトの項目、レイアウト等         |
| `Location`                   | ロケーションの項目、レイアウト等               |
| `Macro`                      | マクロの項目、レイアウト等                     |
| `Opportunity`                | 商談オブジェクトの項目、レイアウト等           |
| `OpportunityContactRole`     | 商談取引先責任者ロールの定義                   |
| `OpportunityLineItem`        | 商談商品の項目、レイアウト等                   |
| `Order`                      | 注文オブジェクトの項目、レイアウト等           |
| `OrderItem`                  | 注文商品の項目、レイアウト等                   |
| `Pricebook2`                 | 価格表オブジェクトの項目、レイアウト等         |
| `PricebookEntry`             | 価格表エントリの項目、レイアウト等             |
| `Product2`                   | 商品オブジェクトの項目、レイアウト等           |
| `ProductConsumptionSchedule` | 商品消費スケジュールの項目、レイアウト等       |
| `QuickText`                  | クイックテキストの項目、レイアウト等           |
| `ServiceContract`            | サービス契約オブジェクト定義                   |
| `Solution`                   | ソリューションの項目、レイアウト等             |
| `Task`                       | ToDo オブジェクトの項目、レイアウト等          |
| `User`                       | ユーザーオブジェクトの項目、レイアウト等       |
| `WorkOrder`                  | 作業指示オブジェクト定義                       |
| `WorkOrderLineItem`          | 作業指示品目オブジェクト定義                   |
| `WorkPlan`                   | 作業プランの項目、レイアウト等                 |
| `WorkPlanTemplate`           | 作業プランテンプレートの項目、レイアウト等     |
| `WorkStep`                   | 作業ステップの項目、レイアウト等               |
| `*`                          | カスタムオブジェクト                           |

## 自動化 / プロセス

| メタデータ型               | 取得できる内容                         |
| -------------------------- | -------------------------------------- |
| `Flow`                     | フロー本体、各バージョンの定義         |
| `Workflow`                 | ワークフロールール、項目自動更新等     |
| `ApprovalProcess`          | 承認プロセス定義                       |
| `AssignmentRules`          | リード、ケースなどの割り当てルール     |
| `AutoResponseRules`        | 自動レスポンスルール                   |
| `EscalationRules`          | ケースエスカレーションルール           |
| `DuplicateRule`            | 重複ルール                             |
| `MatchingRules`            | 重複判定に使う一致ルール               |
| `WorkflowAlert`            | ワークフローアラート                   |
| `WorkflowFieldUpdate`      | ワークフロー項目自動更新               |
| `WorkflowFlowAction`       | ワークフローフローアクション           |
| `WorkflowKnowledgePublish` | ワークフローナレッジ公開アクション     |
| `WorkflowOutboundMessage`  | ワークフローアウトバウンドメッセージ   |
| `WorkflowRule`             | ワークフロールール                     |
| `WorkflowSend`             | ワークフロー送信アクション             |
| `WorkflowTask`             | ワークフローToDo                       |
| `FlowCategory`             | フローカテゴリ                         |
| `FlowTest`                 | フローテスト                           |
| `FlowValueMap`             | フロー値マップ                         |
| `ProcessFlowMigration`     | Process Builder からフローへの移行設定 |

## 権限 / 共有

| メタデータ型            | 取得できる内容                   |
| ----------------------- | -------------------------------- |
| `PermissionSet`         | 権限セット                       |
| `PermissionSetGroup`    | 権限セットグループ               |
| `MutingPermissionSet`   | 権限セットグループのミュート権限 |
| `Queue`                 | キュー定義                       |
| `Role`                  | ロール階層                       |
| `Group`                 | 公開グループ                     |
| `SharingRules`          | 共有ルール                       |
| `SharingSet`            | Experience Cloud の共有セット    |
| `RestrictionRule`       | 制限ルール                       |
| `FieldRestrictionRule`  | 項目制限ルール                   |
| `ProfilePasswordPolicy` | プロファイル別パスワードポリシー |
| `ProfileSessionSetting` | プロファイル別セッション設定     |
| `SharingCriteriaRule`   | 条件ベース共有ルール             |
| `SharingGuestRule`      | ゲストユーザー共有ルール         |
| `SharingOwnerRule`      | 所有者ベース共有ルール           |
| `SharingReason`         | 共有理由                         |
| `SharingTerritoryRule`  | テリトリーベース共有ルール       |

## 組織依存メタデータ

| メタデータ型     | 取得できる内容 |
| ---------------- | -------------- |
| `FlowDefinition` | フロー定義     |
| `Profile`        | プロファイル   |

## 認証 / セキュリティ

| メタデータ型                            | 取得できる内容                                  |
| --------------------------------------- | ----------------------------------------------- |
| `ConnectedApp`                          | 接続アプリケーション定義                        |
| `ExternalClientApplication`             | 外部クライアントアプリ定義                      |
| `ExtlClntAppOauthSettings`              | 外部クライアントアプリの OAuth 設定             |
| `ExtlClntAppGlobalOauthSettings`        | 外部クライアントアプリのグローバル OAuth 設定   |
| `ExtlClntAppOauthSecuritySettings`      | 外部クライアントアプリの OAuth セキュリティ設定 |
| `ExtlClntAppOauthConfigurablePolicies`  | OAuth の設定可能ポリシー                        |
| `ExtlClntAppConfigurablePolicies`       | 外部クライアントアプリの設定可能ポリシー        |
| `ExtlClntAppSamlConfigurablePolicies`   | SAML の設定可能ポリシー                         |
| `ExtlClntAppMobileSettings`             | モバイルクライアント設定                        |
| `ExtlClntAppMobileConfigurablePolicies` | モバイルの設定可能ポリシー                      |
| `ExtlClntAppCanvasSettings`             | Canvas アプリ設定                               |
| `ExtlClntAppPushSettings`               | プッシュ通知設定                                |
| `ExtlClntAppPushConfigurablePolicies`   | プッシュ通知の設定可能ポリシー                  |
| `ExtlClntAppNotificationSettings`       | 通知設定                                        |
| `ExternalAuthIdentityProvider`          | 外部認証 ID プロバイダー設定                    |
| `NamedCredential`                       | 指定ログイン情報                                |
| `ExternalCredential`                    | 外部ログイン情報                                |
| `AuthProvider`                          | 認証プロバイダー                                |
| `SamlSsoConfig`                         | SAML SSO 設定                                   |
| `OauthCustomScope`                      | OAuth カスタムスコープ                          |
| `OauthTokenExchangeHandler`             | OAuth トークン交換ハンドラー                    |
| `RemoteSiteSetting`                     | リモートサイト設定                              |
| `CspTrustedSite`                        | CSP 信頼済みサイト                              |
| `CorsWhitelistOrigin`                   | CORS 許可オリジン                               |
| `IframeWhiteListUrlSettings`            | iframe 許可 URL 設定                            |
| `IPAddressRange`                        | IP アドレス範囲設定                             |
| `MyDomainDiscoverableLogin`             | 私のドメインの検出可能ログイン設定              |
| `Certificate`                           | 証明書と鍵のメタデータ                          |
| `PublicKeyCertificate`                  | 公開鍵証明書                                    |
| `PublicKeyCertificateSet`               | 公開鍵証明書セット                              |
| `TransactionSecurityPolicy`             | トランザクションセキュリティポリシー            |

## 外部接続 / API

| メタデータ型                      | 取得できる内容                       |
| --------------------------------- | ------------------------------------ |
| `ExternalDataSource`              | 外部オブジェクト用の外部データソース |
| `ExternalServiceRegistration`     | 外部サービス登録                     |
| `ApiNamedQuery`                   | API 名前付きクエリ定義               |
| `CanvasMetadata`                  | Canvas アプリのメタデータ            |
| `CatalogedApi`                    | API カタログ定義                     |
| `CatalogedApiArtifactVersionInfo` | API カタログ成果物バージョン情報     |
| `CatalogedApiVersion`             | API カタログバージョン               |
| `InboundNetworkConnection`        | インバウンドネットワーク接続設定     |
| `OutboundNetworkConnection`       | アウトバウンドネットワーク接続設定   |
| `InvocableActionExtension`        | 呼び出し可能アクション拡張           |
| `McpServerDefinition`             | MCP サーバー定義                     |
| `ExternalDataTranObject`          | 外部データ変換オブジェクト           |

## イベント / メッセージング

| メタデータ型                    | 取得できる内容                           |
| ------------------------------- | ---------------------------------------- |
| `PlatformEventChannel`          | プラットフォームイベントチャネル         |
| `PlatformEventChannelMember`    | プラットフォームイベントチャネルメンバー |
| `PlatformEventSubscriberConfig` | プラットフォームイベント購読者設定       |
| `ManagedEventSubscription`      | 管理イベント購読設定                     |
| `EventRelayConfig`              | イベントリレー設定                       |

## レポート / 分析

| メタデータ型                  | 取得できる内容                     |
| ----------------------------- | ---------------------------------- |
| `ReportType`                  | カスタムレポートタイプ             |
| `Document`                    | Classic ドキュメント               |
| `AnalyticSnapshot`            | レポートスナップショット           |
| `WaveAnalyticAssetCollection` | CRM Analytics アセットコレクション |
| `DocumentFolder`              | Classic ドキュメントフォルダー     |

## メール / 通知

| メタデータ型             | 取得できる内容                           |
| ------------------------ | ---------------------------------------- |
| `EmailTemplate`          | メールテンプレート                       |
| `Letterhead`             | Classic メールテンプレートのレターヘッド |
| `CustomNotificationType` | カスタム通知タイプ                       |
| `EmailServicesFunction`  | Apex メールサービスの関数設定            |
| `ApexEmailNotifications` | Apex 例外メール通知設定                  |
| `EmailFolder`            | メールフォルダー                         |
| `EmailTemplateFolder`    | メールテンプレートフォルダー             |

## Experience / サイト

| メタデータ型                   | 取得できる内容                      |
| ------------------------------ | ----------------------------------- |
| `DigitalExperienceBundle`      | Experience Cloud サイトバンドル     |
| `Community`                    | Experience Cloud コミュニティ設定   |
| `NetworkBranding`              | Experience Cloud のブランド設定     |
| `CustomSite`                   | Salesforce サイト設定               |
| `SiteDotCom`                   | Site.com サイト設定                 |
| `ExperiencePropertyTypeBundle` | Experience プロパティタイプバンドル |
| `ChannelLayout`                | チャネルレイアウト                  |
| `LightningBolt`                | Lightning Bolt ソリューション       |
| `DigitalExperience`            | デジタルエクスペリエンス            |

## サービス設定

| メタデータ型                  | 取得できる内容                         |
| ----------------------------- | -------------------------------------- |
| `CallCenter`                  | CTI Call Center 定義                   |
| `MilestoneType`               | エンタイトルメントのマイルストーン種別 |
| `EntitlementProcess`          | エンタイトルメントプロセス             |
| `EntitlementTemplate`         | エンタイトルメントテンプレート         |
| `MessagingChannel`            | Messaging チャネル                     |
| `EmbeddedServiceConfig`       | 組み込みサービス設定                   |
| `EmbeddedServiceBranding`     | 組み込みサービスのブランド設定         |
| `EmbeddedServiceFlowConfig`   | 組み込みサービスとフローの関連設定     |
| `EmbeddedServiceMenuSettings` | 組み込みサービスのメニュー設定         |
| `LiveChatSensitiveDataRule`   | Live Chat の機密データルール           |

## モバイル / オフライン

| メタデータ型              | 取得できる内容                       |
| ------------------------- | ------------------------------------ |
| `BriefcaseDefinition`     | Salesforce モバイルの Briefcase 定義 |
| `MobileApplicationDetail` | モバイルアプリ詳細設定               |

## AI / 機械学習

| メタデータ型                 | 取得できる内容                      |
| ---------------------------- | ----------------------------------- |
| `AIApplication`              | AI アプリケーション定義             |
| `AIApplicationConfig`        | AI アプリケーション設定             |
| `Prompt`                     | Prompt Builder のプロンプト定義     |
| `MLPredictionDefinition`     | Einstein 予測定義                   |
| `MLRecommendationDefinition` | Einstein 推奨定義                   |
| `MLDataDefinition`           | 機械学習向けデータ定義              |
| `AIScoringModelDefVersion`   | AI スコアリングモデル定義バージョン |

## コンテンツ / CMS

| メタデータ型               | 取得できる内容                                  |
| -------------------------- | ----------------------------------------------- |
| `ContentTypeBundle`        | CMS コンテンツタイプバンドル                    |
| `ManagedContentType`       | 管理コンテンツタイプ                            |
| `DataCategoryGroup`        | データカテゴリグループ                          |
| `DgtAssetMgmtProvider`     | デジタルアセット管理プロバイダー                |
| `DgtAssetMgmtPrvdLghtCpnt` | デジタルアセット管理用 Lightning コンポーネント |

## 検索 / ナレッジ補助

| メタデータ型                | 取得できる内容                   |
| --------------------------- | -------------------------------- |
| `SearchCustomization`       | 検索 UI や検索結果のカスタマイズ |
| `SearchOrgWideObjectConfig` | 組織全体のオブジェクト検索設定   |
| `SynonymDictionary`         | 検索同義語辞書                   |
| `TopicsForObjects`          | オブジェクトごとのトピック設定   |

## 組織設定

| メタデータ型                     | 取得できる内容                 |
| -------------------------------- | ------------------------------ |
| `InstalledPackage`               | インストール済みパッケージ参照 |
| `Settings`                       | 組織設定一式                   |
| `LeadConvertSettings`            | リード取引開始設定             |
| `DelegateGroup`                  | 委任管理グループ               |
| `NotificationTypeConfig`         | 通知タイプ設定                 |
| `PermissionSetLicenseDefinition` | 権限セットライセンス定義       |
| `PlatformCachePartition`         | Platform Cache パーティション  |
| `UserProvisioningConfig`         | ユーザープロビジョニング設定   |

## Classic UI

| メタデータ型        | 取得できる内容                     |
| ------------------- | ---------------------------------- |
| `HomePageComponent` | Classic ホームページコンポーネント |
| `HomePageLayout`    | Classic ホームページレイアウト     |
| `Scontrol`          | S-Control 定義                     |

## UI / アクション拡張

| メタデータ型                 | 取得できる内容                         |
| ---------------------------- | -------------------------------------- |
| `ActionLauncherItemDef`      | アクションランチャー項目定義           |
| `ActionLinkGroupTemplate`    | アクションリンクグループテンプレート   |
| `AppFrameworkTemplateBundle` | アプリフレームワークテンプレート       |
| `ChatterExtension`           | Chatter 拡張                           |
| `ChoiceList`                 | 選択肢リスト定義                       |
| `CustomApplicationComponent` | カスタムアプリケーションコンポーネント |
| `CustomFeedFilter`           | Chatter フィードフィルター             |
| `CustomHelpMenuSection`      | ヘルプメニューのカスタムセクション     |
| `CustomPageWebLink`          | カスタムページリンク                   |
| `LightningOnboardingConfig`  | Lightning オンボーディング設定         |
| `LightningTypeBundle`        | Lightning 型バンドル                   |
| `PathAssistant`              | パス設定                               |
| `PostTemplate`               | 投稿テンプレート                       |
| `RecordActionDeployment`     | レコードアクション配置                 |
| `RedirectWhitelistUrl`       | リダイレクト許可 URL                   |
| `UIBundle`                   | UI バンドル                            |
| `UiFormatSpecificationSet`   | UI 表示形式仕様セット                  |

## 会話インテリジェンス

| メタデータ型                    | 取得できる内容                       |
| ------------------------------- | ------------------------------------ |
| `CallCoachingMediaProvider`     | 通話コーチングのメディアプロバイダー |
| `ConvIntelligenceSignalRule`    | 会話インテリジェンスのシグナルルール |
| `ConversationMessageDefinition` | 会話メッセージ定義                   |

## 決済

| メタデータ型                       | 取得できる内容                             |
| ---------------------------------- | ------------------------------------------ |
| `GatewayProviderPaymentMethodType` | 決済ゲートウェイプロバイダーの支払方法種別 |
| `PaymentGatewayProvider`           | 決済ゲートウェイプロバイダー               |

## プラットフォーム機能

| メタデータ型                | 取得できる内容                 |
| --------------------------- | ------------------------------ |
| `AnimationRule`             | アニメーションルール           |
| `BatchProcessJobDefinition` | バッチプロセスジョブ定義       |
| `BlacklistedConsumer`       | ブロック対象コンシューマー設定 |
| `CleanDataService`          | データクレンジングサービス設定 |
| `EclairGeoData`             | Eclair 地理データ              |
| `RecommendationStrategy`    | 推奨戦略                       |
| `FeatureParameterBoolean`   | Boolean 型機能パラメーター     |
| `FeatureParameterDate`      | 日付型機能パラメーター         |
| `FeatureParameterInteger`   | 整数型機能パラメーター         |

## 翻訳

| メタデータ型                  | 取得できる内容           |
| ----------------------------- | ------------------------ |
| `Translations`                | 言語別翻訳               |
| `CustomObjectTranslation`     | カスタムオブジェクト翻訳 |
| `GlobalValueSetTranslation`   | グローバル値セット翻訳   |
| `StandardValueSetTranslation` | 標準値セット翻訳         |

## 取得に注意が必要なもの

| 対象                     | 扱い                                                                       |
| ------------------------ | -------------------------------------------------------------------------- |
| `FlowDefinition`         | 本番 / Sandbox で差分が出やすいため `retrieve-automation.xml` で取得する。 |
| `Profile`                | 関連メタデータと同時に `retrieve-profile.xml` で取得する。                 |
| `ExperienceContainer`    | 対象 org には見えるが、今回の CLI registry では未対応のため含めない。      |
| `PlatformEventMigration` | 対象 org には見えるが、今回の CLI registry では未対応のため含めない。      |
| `SurveyStyleSet`         | 対象 org には見えるが、今回の CLI registry では未対応のため含めない。      |
| `TagSet`                 | 対象 org には見えるが、今回の CLI registry では未対応のため含めない。      |
| `Report` / `Dashboard`   | `*` 指定では取得エラーになるため含めない。                                 |
| `Bot` / `BotVersion`     | Playground 組織で利用できないため含めない。                                |
