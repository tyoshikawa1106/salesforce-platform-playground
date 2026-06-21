# package.xml のメタデータ一覧

このメモは、`manifest/package.xml` に含めている Salesforce metadata の範囲を整理します。

現時点の manifest は API 67.0 を前提に、metadata type 202 件をカテゴリ別に並べています。`CustomObject` は標準オブジェクトを個別指定し、最後にカスタムオブジェクト用の `*` を残しています。

## Apex / Visualforce

| Metadata type   | 取得できる内容             |
| --------------- | -------------------------- |
| `ApexClass`     | Apex クラスとテストクラス  |
| `ApexTrigger`   | Apex トリガー              |
| `ApexPage`      | Visualforce ページ         |
| `ApexComponent` | Visualforce コンポーネント |
| `ApexTestSuite` | Apex テストスイート        |

## Lightning コンポーネント

| Metadata type              | 取得できる内容                                |
| -------------------------- | --------------------------------------------- |
| `AuraDefinitionBundle`     | Aura コンポーネントバンドル                   |
| `LightningComponentBundle` | Lightning Web Component バンドル              |
| `LightningMessageChannel`  | Lightning Message Service のチャネル          |
| `StaticResource`           | 静的リソース                                  |
| `ContentAsset`             | Experience Cloud などで使うコンテンツアセット |
| `DataWeaveResource`        | Apex から使う DataWeave スクリプト            |

## アプリケーション / ナビゲーション

| Metadata type       | 取得できる内容                     |
| ------------------- | ---------------------------------- |
| `CustomApplication` | Lightning アプリ、Classic アプリ   |
| `CustomTab`         | カスタムタブ、Web タブ             |
| `AppMenu`           | アプリランチャーやモバイルメニュー |

## 画面 / レイアウト

| Metadata type              | 取得できる内容                         |
| -------------------------- | -------------------------------------- |
| `FlexiPage`                | Lightning Record Page や Home Page     |
| `Layout`                   | ページレイアウト                       |
| `CompactLayout`            | コンパクトレイアウト                   |
| `QuickAction`              | クイックアクション                     |
| `LightningExperienceTheme` | Lightning Experience のテーマ設定      |
| `BrandingSet`              | ブランドカラーやロゴなどのブランド設定 |

## オブジェクト / データモデル

| Metadata type      | 取得できる内容                             |
| ------------------ | ------------------------------------------ |
| `CustomObject`     | カスタムオブジェクトと標準オブジェクト定義 |
| `CustomField`      | オブジェクト項目                           |
| `RecordType`       | レコードタイプ                             |
| `BusinessProcess`  | 商談、ケース、リードなどの業務プロセス     |
| `FieldSet`         | Field Set                                  |
| `ListView`         | リストビュー                               |
| `ValidationRule`   | 入力規則                                   |
| `WebLink`          | カスタムボタン、リンク                     |
| `CustomMetadata`   | カスタムメタデータレコード                 |
| `CustomLabels`     | カスタム表示ラベル                         |
| `CustomPermission` | カスタム権限                               |
| `GlobalValueSet`   | グローバル選択リスト値セット               |
| `StandardValueSet` | 標準項目の選択リスト値セット               |

### CustomObject の標準オブジェクト指定

`CustomObject` の `*` はカスタムオブジェクト取得用です。標準オブジェクトのカスタマイズ情報を取得するため、次の標準オブジェクトを個別指定しています。

| Member                   | 取得できる内容                               |
| ------------------------ | -------------------------------------------- |
| `Account`                | 取引先オブジェクトの項目、レイアウト等       |
| `Asset`                  | 納入商品オブジェクトの項目、レイアウト等     |
| `BusinessHours`          | 営業時間オブジェクト                         |
| `Campaign`               | キャンペーンオブジェクトの項目、レイアウト等 |
| `CampaignMember`         | キャンペーンメンバーの項目、レイアウト等     |
| `Case`                   | ケースオブジェクトの項目、レイアウト等       |
| `Contact`                | 取引先責任者オブジェクトの項目、レイアウト等 |
| `ContentDocument`        | ファイルの文書単位オブジェクト定義           |
| `Contract`               | 契約オブジェクトの項目、レイアウト等         |
| `EmailMessage`           | メールメッセージオブジェクト定義             |
| `Entitlement`            | エンタイトルメントオブジェクト定義           |
| `Event`                  | 行動オブジェクトの項目、レイアウト等         |
| `Lead`                   | リードオブジェクトの項目、レイアウト等       |
| `Opportunity`            | 商談オブジェクトの項目、レイアウト等         |
| `OpportunityContactRole` | 商談取引先責任者ロールの定義                 |
| `OpportunityLineItem`    | 商談商品の項目、レイアウト等                 |
| `Order`                  | 注文オブジェクトの項目、レイアウト等         |
| `OrderItem`              | 注文商品の項目、レイアウト等                 |
| `Pricebook2`             | 価格表オブジェクトの項目、レイアウト等       |
| `PricebookEntry`         | 価格表エントリの項目、レイアウト等           |
| `Product2`               | 商品オブジェクトの項目、レイアウト等         |
| `ServiceContract`        | サービス契約オブジェクト定義                 |
| `Task`                   | ToDo オブジェクトの項目、レイアウト等        |
| `User`                   | ユーザーオブジェクトの項目、レイアウト等     |
| `WorkOrder`              | 作業指示オブジェクト定義                     |
| `WorkOrderLineItem`      | 作業指示品目オブジェクト定義                 |
| `*`                      | カスタムオブジェクト                         |

## 自動化 / プロセス

| Metadata type       | 取得できる内容                     |
| ------------------- | ---------------------------------- |
| `Flow`              | フロー本体、各バージョンの定義     |
| `FlowDefinition`    | フローの有効バージョンなどの定義   |
| `Workflow`          | ワークフロールール、項目自動更新等 |
| `ApprovalProcess`   | 承認プロセス定義                   |
| `AssignmentRules`   | リード、ケースなどの割り当てルール |
| `AutoResponseRules` | 自動レスポンスルール               |
| `EscalationRules`   | ケースエスカレーションルール       |
| `DuplicateRule`     | 重複ルール                         |
| `MatchingRules`     | 重複判定に使う一致ルール           |

## 権限 / 共有

| Metadata type           | 取得できる内容                   |
| ----------------------- | -------------------------------- |
| `PermissionSet`         | 権限セット                       |
| `PermissionSetGroup`    | 権限セットグループ               |
| `MutingPermissionSet`   | 権限セットグループのミュート権限 |
| `Profile`               | プロファイル権限                 |
| `Queue`                 | キュー定義                       |
| `Role`                  | ロール階層                       |
| `Group`                 | 公開グループ                     |
| `SharingRules`          | 共有ルール                       |
| `SharingSet`            | Experience Cloud の共有セット    |
| `RestrictionRule`       | 制限ルール                       |
| `FieldRestrictionRule`  | 項目制限ルール                   |
| `ProfilePasswordPolicy` | プロファイル別パスワードポリシー |
| `ProfileSessionSetting` | プロファイル別セッション設定     |

## 認証 / セキュリティ

| Metadata type                           | 取得できる内容                                  |
| --------------------------------------- | ----------------------------------------------- |
| `ConnectedApp`                          | Connected App 定義                              |
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
| `ExtlClntAppNotificationSettings`       | 通知設定                                        |
| `ExternalAuthIdentityProvider`          | 外部認証 ID プロバイダー設定                    |
| `NamedCredential`                       | Named Credential                                |
| `ExternalCredential`                    | External Credential                             |
| `AuthProvider`                          | 認証プロバイダー                                |
| `SamlSsoConfig`                         | SAML SSO 設定                                   |
| `OauthCustomScope`                      | OAuth カスタムスコープ                          |
| `OauthTokenExchangeHandler`             | OAuth トークン交換ハンドラー                    |
| `RemoteSiteSetting`                     | Remote Site Settings                            |
| `CspTrustedSite`                        | CSP 信頼済みサイト                              |
| `CorsWhitelistOrigin`                   | CORS 許可オリジン                               |
| `IframeWhiteListUrlSettings`            | iframe 許可 URL 設定                            |
| `IPAddressRange`                        | IP アドレス範囲設定                             |
| `MyDomainDiscoverableLogin`             | My Domain の検出可能ログイン設定                |
| `Certificate`                           | 証明書と鍵の metadata                           |
| `PublicKeyCertificate`                  | 公開鍵証明書                                    |
| `PublicKeyCertificateSet`               | 公開鍵証明書セット                              |

## 外部接続 / API

| Metadata type                     | 取得できる内容                       |
| --------------------------------- | ------------------------------------ |
| `ExternalDataSource`              | 外部オブジェクト用の外部データソース |
| `ExternalServiceRegistration`     | External Services 登録               |
| `ApiNamedQuery`                   | API Named Query 定義                 |
| `CanvasMetadata`                  | Canvas アプリ metadata               |
| `CatalogedApi`                    | API Catalog の API 定義              |
| `CatalogedApiArtifactVersionInfo` | API Catalog の成果物バージョン情報   |
| `CatalogedApiVersion`             | API Catalog の API バージョン        |
| `InboundNetworkConnection`        | インバウンドネットワーク接続設定     |
| `OutboundNetworkConnection`       | アウトバウンドネットワーク接続設定   |
| `InvocableActionExtension`        | Invocable Action 拡張                |
| `McpServerDefinition`             | MCP Server 定義                      |

## イベント / メッセージング

| Metadata type                   | 取得できる内容                  |
| ------------------------------- | ------------------------------- |
| `PlatformEventChannel`          | Platform Event チャネル         |
| `PlatformEventChannelMember`    | Platform Event チャネルメンバー |
| `PlatformEventSubscriberConfig` | Platform Event 購読設定         |
| `PlatformEventMigration`        | Platform Event の移行 metadata  |
| `ManagedEventSubscription`      | 管理イベント購読設定            |
| `EventRelayConfig`              | Event Relay 設定                |

## レポート / 分析

| Metadata type                 | 取得できる内容                     |
| ----------------------------- | ---------------------------------- |
| `Report`                      | レポート定義                       |
| `ReportType`                  | カスタムレポートタイプ             |
| `Dashboard`                   | ダッシュボード定義                 |
| `Document`                    | Classic Document                   |
| `AnalyticSnapshot`            | レポートスナップショット           |
| `WaveAnalyticAssetCollection` | CRM Analytics アセットコレクション |

## メール / 通知

| Metadata type            | 取得できる内容                           |
| ------------------------ | ---------------------------------------- |
| `EmailTemplate`          | メールテンプレート                       |
| `Letterhead`             | Classic メールテンプレートのレターヘッド |
| `CustomNotificationType` | カスタム通知タイプ                       |
| `EmailServicesFunction`  | Apex Email Service の関数設定            |
| `ApexEmailNotifications` | Apex 例外メール通知設定                  |

## Experience / サイト

| Metadata type                  | 取得できる内容                       |
| ------------------------------ | ------------------------------------ |
| `DigitalExperienceBundle`      | Experience Cloud サイトバンドル      |
| `Community`                    | Community metadata                   |
| `NetworkBranding`              | Experience Cloud のブランド設定      |
| `CustomSite`                   | Salesforce Site 設定                 |
| `SiteDotCom`                   | Site.com metadata                    |
| `ExperienceContainer`          | Experience Builder コンテナ metadata |
| `ExperiencePropertyTypeBundle` | Experience Property Type Bundle      |
| `ChannelLayout`                | チャネルレイアウト                   |
| `LightningBolt`                | Lightning Bolt ソリューション        |

## Service 設定

| Metadata type                 | 取得できる内容                         |
| ----------------------------- | -------------------------------------- |
| `CallCenter`                  | CTI Call Center 定義                   |
| `MilestoneType`               | エンタイトルメントのマイルストーン種別 |
| `EntitlementProcess`          | エンタイトルメントプロセス             |
| `EntitlementTemplate`         | エンタイトルメントテンプレート         |
| `MessagingChannel`            | Messaging チャネル                     |
| `EmbeddedServiceConfig`       | Embedded Service 設定                  |
| `EmbeddedServiceBranding`     | Embedded Service のブランド設定        |
| `EmbeddedServiceFlowConfig`   | Embedded Service と Flow の関連設定    |
| `EmbeddedServiceMenuSettings` | Embedded Service のメニュー設定        |
| `LiveChatSensitiveDataRule`   | Live Chat の機密データルール           |

## モバイル / オフライン

| Metadata type             | 取得できる内容                       |
| ------------------------- | ------------------------------------ |
| `BriefcaseDefinition`     | Salesforce モバイルの Briefcase 定義 |
| `MobileApplicationDetail` | モバイルアプリ詳細設定               |

## AI / 機械学習

| Metadata type                | 取得できる内容                  |
| ---------------------------- | ------------------------------- |
| `AIApplication`              | AI アプリケーション定義         |
| `AIApplicationConfig`        | AI アプリケーション設定         |
| `ExternalAIModel`            | 外部 AI モデル定義              |
| `ServiceAISetupDefinition`   | Service AI のセットアップ定義   |
| `ServiceAISetupField`        | Service AI のセットアップ項目   |
| `Prompt`                     | Prompt Builder のプロンプト定義 |
| `MLPredictionDefinition`     | Einstein 予測定義               |
| `MLRecommendationDefinition` | Einstein 推奨定義               |
| `MLDataDefinition`           | 機械学習向けデータ定義          |

## コンテンツ / CMS

| Metadata type        | 取得できる内容               |
| -------------------- | ---------------------------- |
| `ContentTypeBundle`  | CMS コンテンツタイプバンドル |
| `ManagedContentType` | 管理コンテンツタイプ         |
| `DataCategoryGroup`  | データカテゴリグループ       |
| `TagSet`             | タグセット                   |

## 検索 / ナレッジ補助

| Metadata type               | 取得できる内容                   |
| --------------------------- | -------------------------------- |
| `SearchCustomization`       | 検索 UI や検索結果のカスタマイズ |
| `SearchOrgWideObjectConfig` | 組織全体のオブジェクト検索設定   |
| `SynonymDictionary`         | 検索同義語辞書                   |
| `TopicsForObjects`          | オブジェクトごとのトピック設定   |

## 組織設定

| Metadata type                    | 取得できる内容                 |
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

| Metadata type       | 取得できる内容                     |
| ------------------- | ---------------------------------- |
| `HomePageComponent` | Classic ホームページコンポーネント |
| `HomePageLayout`    | Classic ホームページレイアウト     |
| `Scontrol`          | S-Control                          |

## その他のプラットフォーム設定

| Metadata type                         | 取得できる内容                                  |
| ------------------------------------- | ----------------------------------------------- |
| `ActionLauncherItemDef`               | アクションランチャー項目定義                    |
| `ActionLinkGroupTemplate`             | アクションリンクグループテンプレート            |
| `AnimationRule`                       | アニメーションルール                            |
| `AppFrameworkTemplateBundle`          | アプリフレームワークテンプレート                |
| `BatchProcessJobDefinition`           | バッチプロセスジョブ定義                        |
| `BlacklistedConsumer`                 | ブロック対象コンシューマー設定                  |
| `CallCoachingMediaProvider`           | 通話コーチングのメディアプロバイダー            |
| `ChatterExtension`                    | Chatter 拡張                                    |
| `ChoiceList`                          | 選択肢リスト定義                                |
| `CleanDataService`                    | データクレンジングサービス設定                  |
| `ConvIntelligenceSignalRule`          | 会話インテリジェンスのシグナルルール            |
| `ConversationMessageDefinition`       | 会話メッセージ定義                              |
| `CustomApplicationComponent`          | カスタムアプリケーションコンポーネント          |
| `CustomFeedFilter`                    | Chatter フィードフィルター                      |
| `CustomHelpMenuSection`               | ヘルプメニューのカスタムセクション              |
| `CustomIndex`                         | カスタムインデックス                            |
| `CustomPageWebLink`                   | カスタムページリンク                            |
| `DgtAssetMgmtProvider`                | デジタルアセット管理プロバイダー                |
| `DgtAssetMgmtPrvdLghtCpnt`            | デジタルアセット管理用 Lightning コンポーネント |
| `EclairGeoData`                       | Eclair 地理データ                               |
| `ExtlClntAppPushConfigurablePolicies` | 外部クライアントアプリの Push 設定可能ポリシー  |
| `FlowCategory`                        | Flow カテゴリ                                   |
| `FlowTest`                            | Flow テスト定義                                 |
| `FlowValueMap`                        | Flow 値マップ                                   |
| `GatewayProviderPaymentMethodType`    | 決済ゲートウェイプロバイダーの支払方法種別      |
| `LightningOnboardingConfig`           | Lightning オンボーディング設定                  |
| `LightningTypeBundle`                 | Lightning Type Bundle                           |
| `PathAssistant`                       | パス設定                                        |
| `PaymentGatewayProvider`              | 決済ゲートウェイプロバイダー                    |
| `PostTemplate`                        | 投稿テンプレート                                |
| `ProcessFlowMigration`                | Process Builder から Flow への移行 metadata     |
| `RecommendationStrategy`              | 推奨戦略                                        |
| `RecordActionDeployment`              | レコードアクション配置                          |
| `RedirectWhitelistUrl`                | リダイレクト許可 URL                            |
| `TransactionSecurityPolicy`           | トランザクションセキュリティポリシー            |
| `UIBundle`                            | UI Bundle                                       |
| `UiFormatSpecificationSet`            | UI 表示形式仕様セット                           |

## 翻訳

| Metadata type                 | 取得できる内容           |
| ----------------------------- | ------------------------ |
| `Translations`                | 言語別翻訳               |
| `CustomObjectTranslation`     | カスタムオブジェクト翻訳 |
| `GlobalValueSetTranslation`   | グローバル値セット翻訳   |
| `StandardValueSetTranslation` | 標準値セット翻訳         |

## 取得に注意が必要なもの

| 対象                                | 注意点                                 |
| ----------------------------------- | -------------------------------------- |
| `PlatformEventMigration`            | 今回の CLI registry では未対応         |
| `ExperienceContainer`               | 今回の CLI registry では未対応         |
| `TagSet`                            | 今回の CLI registry では未対応         |
| `Report`                            | `*` 指定だけでは取得できない場合がある |
| `Dashboard`                         | `*` 指定だけでは取得できない場合がある |
| `BusinessHours`                     | `CustomObject` として取得できない      |
| Survey 系 `Flow` / `FlowDefinition` | 権限や機能により取得できない場合がある |
