# 要依存確認

[Salesforce Settings の有効化状況](../salesforce-settings-enable-status.md)に戻る。

機能自体は有効化候補ですが、関連機能、データモデル、権限、運用前提を確認してから進めるものです。

対象: 365 件（有効 65 件 / 無効 300 件）

| 設定種別                | 機能名                                                                          | 機能概要                                                                                  | 状態 |
| ----------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---- |
| `Apex`                  | `enableAggregateCodeCoverageOnly`                                               | Apex の Aggregate Code Coverage Only を有効化/無効化する                                  | 無効 |
| `Apex`                  | `enableApexAccessRightsPref`                                                    | Apex の Apex Access Rights Pref を有効化/無効化する                                       | 無効 |
| `Apex`                  | `enableApexApprovalLockUnlock`                                                  | Apex の Apex Approval Lock Unlock を有効化/無効化する                                     | 無効 |
| `Apex`                  | `enableApexCtrlImplicitWithSharingPref`                                         | Apex の Apex Ctrl Implicit With Sharing Pref を有効化/無効化する                          | 無効 |
| `Apex`                  | `enableApexPropertyGetterPref`                                                  | Apex の Apex Property Getter Pref を有効化/無効化する                                     | 無効 |
| `Apex`                  | `enableAsyncApexElasticExecutions`                                              | Apex の Async Apex Elastic Executions を有効化/無効化する                                 | 無効 |
| `Apex`                  | `enableAuraApexCtrlAuthUserAccessCheckPref`                                     | Apex の Aura Apex Ctrl Auth User Access Check Pref を有効化/無効化する                    | 無効 |
| `Apex`                  | `enableAuraApexCtrlGuestUserAccessCheckPref`                                    | Apex の Aura Apex Ctrl Guest User Access Check Pref を有効化/無効化する                   | 無効 |
| `Apex`                  | `enableBlockPackagedApexExecAnon`                                               | Apex の Block Packaged Apex Exec Anon を有効化/無効化する                                 | 無効 |
| `Apex`                  | `enableCompileOnDeploy`                                                         | Apex の Compile On Deploy を有効化/無効化する                                             | 無効 |
| `Apex`                  | `enableDebugLogsDuringDeployment`                                               | Apex の Debug Logs During Deployment を有効化/無効化する                                  | 無効 |
| `Apex`                  | `enableDisableParallelApexTesting`                                              | Apex の Disable Parallel Apex Testing を有効化/無効化する                                 | 無効 |
| `Apex`                  | `enableGaplessTestAutoNum`                                                      | Apex の Gapless Test Auto Num を有効化/無効化する                                         | 有効 |
| `Apex`                  | `enableMngdCtrlActionAccessPref`                                                | Apex の Mngd Ctrl Action Access Pref を有効化/無効化する                                  | 無効 |
| `Apex`                  | `enableNonCertifiedApexMdCrud`                                                  | Apex の Non Certified Apex Md Crud を有効化/無効化する                                    | 無効 |
| `Apex`                  | `enableRestrictCommunityExecAnon`                                               | Apex の Restrict Community Exec Anon を有効化/無効化する                                  | 無効 |
| `Apex`                  | `enableSecureNoArgConstructorPref`                                              | Apex の Secure No Arg Constructor Pref を有効化/無効化する                                | 無効 |
| `Apex`                  | `enableTestSetupSkipTestResults`                                                | Apex の Test Setup Skip Test Results を有効化/無効化する                                  | 無効 |
| `BusinessHours`         | `businessHours[Default].active`                                                 | Default の Default を有効化/無効化する                                                    | 有効 |
| `Campaign`              | `enableAccountsAsCM`                                                            | Campaign の Accounts As CM を有効化/無効化する                                            | 無効 |
| `Campaign`              | `enableAutoCampInfluenceDisabled`                                               | Campaign の Auto Camp Influence Disabled を有効化/無効化する                              | 無効 |
| `Campaign`              | `enableCampaignHistoryTrackEnabled`                                             | Campaign の Campaign History Track Enabled を有効化/無効化する                            | 無効 |
| `Campaign`              | `enableCampaignInfluence2`                                                      | Campaign の Campaign Influence2 を有効化/無効化する                                       | 無効 |
| `Campaign`              | `enableCampaignMemberTWCF`                                                      | Campaign の Campaign Member TWCF を有効化/無効化する                                      | 有効 |
| `Case`                  | `emailToCase.enableEmailToCase`                                                 | Case の Email To Case を有効化/無効化する                                                 | 無効 |
| `Case`                  | `enableCaseFeed`                                                                | Case の Case Feed を有効化/無効化する                                                     | 有効 |
| `Case`                  | `enableCaseSwarming`                                                            | Case の Case Swarming を有効化/無効化する                                                 | 無効 |
| `Case`                  | `enableCollapseEmailThread`                                                     | Case の Collapse Email Thread を有効化/無効化する                                         | 有効 |
| `Case`                  | `enableEarlyEscalationRuleTriggers`                                             | Case の Early Escalation Rule Triggers を有効化/無効化する                                | 無効 |
| `Case`                  | `enableEscalateQfiToCaseInternal`                                               | Case の Escalate Qfi To Case Internal を有効化/無効化する                                 | 無効 |
| `Case`                  | `enableMultiLangSolnSrchCSS`                                                    | Case の Multi Lang Soln Srch CSS を有効化/無効化する                                      | 無効 |
| `Case`                  | `enableMultiLangSolnSrchPKB`                                                    | Case の Multi Lang Soln Srch PKB を有効化/無効化する                                      | 無効 |
| `Case`                  | `enableMultiLangSolution`                                                       | Case の Multi Lang Solution を有効化/無効化する                                           | 無効 |
| `Case`                  | `enableSolutionCategory`                                                        | Case の Solution Category を有効化/無効化する                                             | 無効 |
| `Case`                  | `enableSolutionInlineCategory`                                                  | Case の Solution Inline Category を有効化/無効化する                                      | 有効 |
| `Case`                  | `enableSolutionShortSummary`                                                    | Case の Solution Short Summary を有効化/無効化する                                        | 有効 |
| `Case`                  | `enableSuggestedSolutions`                                                      | Case の Suggested Solutions を有効化/無効化する                                           | 有効 |
| `Case`                  | `webToCase.enableWebToCase`                                                     | Case の Web To Case を有効化/無効化する                                                   | 有効 |
| `CustomAddressField`    | `enableCustomAddressField`                                                      | CustomAddressField の Custom Address Field を有効化/無効化する                            | 無効 |
| `DevHub`                | `enableALMDevopsCorePref`                                                       | DevHub の ALM Devops Core Pref を有効化/無効化する                                        | 無効 |
| `DevHub`                | `enableALMSimpleDeployDataPref`                                                 | DevHub の ALM Simple Deploy Data Pref を有効化/無効化する                                 | 無効 |
| `DevHub`                | `enableALMSimpleDeployPref`                                                     | DevHub の ALM Simple Deploy Pref を有効化/無効化する                                      | 無効 |
| `DevHub`                | `enableDevOpsCenter`                                                            | DevHub の Dev Ops Center を有効化/無効化する                                              | 無効 |
| `DevHub`                | `enableDevOpsCenterGA`                                                          | DevHub の Dev Ops Center GA を有効化/無効化する                                           | 無効 |
| `DevHub`                | `enableDevopsTestingPref`                                                       | DevHub の Devops Testing Pref を有効化/無効化する                                         | 無効 |
| `DevHub`                | `enablePackaging2`                                                              | DevHub の Packaging2 を有効化/無効化する                                                  | 無効 |
| `DevHub`                | `enableScratchOrgManagementPref`                                                | DevHub の Scratch Org Management Pref を有効化/無効化する                                 | 有効 |
| `DevHub`                | `enableScratchOrgSnapshotPref`                                                  | DevHub の Scratch Org Snapshot Pref を有効化/無効化する                                   | 無効 |
| `DevHub`                | `enableShapeExportPref`                                                         | DevHub の Shape Export Pref を有効化/無効化する                                           | 無効 |
| `EAC`                   | `enableActivityAnalyticsPref`                                                   | EAC の Activity Analytics Pref を有効化/無効化する                                        | 無効 |
| `EAC`                   | `enableEACForEveryonePref`                                                      | EAC の EAC For Everyone Pref を有効化/無効化する                                          | 無効 |
| `EAC`                   | `enableInboxActivitySharing`                                                    | EAC の Inbox Activity Sharing を有効化/無効化する                                         | 無効 |
| `EAC`                   | `enableInsightsInTimeline`                                                      | EAC の Insights In Timeline を有効化/無効化する                                           | 有効 |
| `EAC`                   | `enableInsightsInTimelineEacStd`                                                | EAC の Insights In Timeline Eac Std を有効化/無効化する                                   | 無効 |
| `EmailAdministration`   | `enableComplianceBcc`                                                           | EmailAdministration の Compliance Bcc を有効化/無効化する                                 | 無効 |
| `EmailAdministration`   | `enableEmailConsentManagement`                                                  | EmailAdministration の Email Consent Management を有効化/無効化する                       | 無効 |
| `EmailAdministration`   | `enableEmailSenderIdCompliance`                                                 | EmailAdministration の Email Sender Id Compliance を有効化/無効化する                     | 無効 |
| `EmailAdministration`   | `enableEmailSpfCompliance`                                                      | EmailAdministration の Email Spf Compliance を有効化/無効化する                           | 有効 |
| `EmailAdministration`   | `enableEmailToSalesforce`                                                       | EmailAdministration の Email To Salesforce を有効化/無効化する                            | 無効 |
| `EmailAdministration`   | `enableEmailTrackingIPBlocklist`                                                | EmailAdministration の Email Tracking IP Blocklist を有効化/無効化する                    | 無効 |
| `EmailAdministration`   | `enableEmailWorkflowApproval`                                                   | EmailAdministration の Email Workflow Approval を有効化/無効化する                        | 無効 |
| `EmailAdministration`   | `enableEnhancedEmailEnabled`                                                    | EmailAdministration の Enhanced Email Enabled を有効化/無効化する                         | 有効 |
| `EmailAdministration`   | `enableHandleBouncedEmails`                                                     | EmailAdministration の Handle Bounced Emails を有効化/無効化する                          | 有効 |
| `EmailAdministration`   | `enableHtmlEmail`                                                               | EmailAdministration の Html Email を有効化/無効化する                                     | 無効 |
| `EmailAdministration`   | `enableInternationalEmailAddresses`                                             | EmailAdministration の International Email Addresses を有効化/無効化する                  | 無効 |
| `EmailAdministration`   | `enableListEmailLogActivities`                                                  | EmailAdministration の List Email Log Activities を有効化/無効化する                      | 有効 |
| `EmailAdministration`   | `enableResendBouncedEmails`                                                     | EmailAdministration の Resend Bounced Emails を有効化/無効化する                          | 無効 |
| `EmailAdministration`   | `enableRestrictTlsToDomains`                                                    | EmailAdministration の Restrict Tls To Domains を有効化/無効化する                        | 無効 |
| `EmailAdministration`   | `enableSendViaExchangePref`                                                     | EmailAdministration の Send Via Exchange Pref を有効化/無効化する                         | 無効 |
| `EmailAdministration`   | `enableSendViaGmailPref`                                                        | EmailAdministration の Send Via Gmail Pref を有効化/無効化する                            | 無効 |
| `EmailAdministration`   | `enableUseOrgFootersForExtTrans`                                                | EmailAdministration の Use Org Footers For Ext Trans を有効化/無効化する                  | 無効 |
| `EmailAdministration`   | `enableVerifyEmailDomainByDkim`                                                 | EmailAdministration の Verify Email Domain By Dkim を有効化/無効化する                    | 無効 |
| `EmailAuthorization`    | `enableSubstituteFromAddress`                                                   | EmailAuthorization の Substitute From Address を有効化/無効化する                         | 無効 |
| `EmailIntegration`      | `enableContactAndEventSync`                                                     | EmailIntegration の Contact And Event Sync を有効化/無効化する                            | 無効 |
| `EmailIntegration`      | `enableContextualEverywhere`                                                    | EmailIntegration の Contextual Everywhere を有効化/無効化する                             | 有効 |
| `EmailIntegration`      | `enableEmailTrackingInMobile`                                                   | EmailIntegration の Email Tracking In Mobile を有効化/無効化する                          | 有効 |
| `EmailIntegration`      | `enableEngageForOutlook`                                                        | EmailIntegration の Engage For Outlook を有効化/無効化する                                | 無効 |
| `EmailIntegration`      | `enableExtensionHostUnrestricted`                                               | EmailIntegration の Extension Host Unrestricted を有効化/無効化する                       | 有効 |
| `EmailIntegration`      | `enableGmailIntegration`                                                        | EmailIntegration の Gmail Integration を有効化/無効化する                                 | 有効 |
| `EmailIntegration`      | `enableInboxInternalEmailTracking`                                              | EmailIntegration の Inbox Internal Email Tracking を有効化/無効化する                     | 無効 |
| `EmailIntegration`      | `enableInboxMobileIntune`                                                       | EmailIntegration の Inbox Mobile Intune を有効化/無効化する                               | 無効 |
| `EmailIntegration`      | `enableInboxUseGraphApi`                                                        | EmailIntegration の Inbox Use Graph Api を有効化/無効化する                               | 無効 |
| `EmailIntegration`      | `enableOutlookIntegration`                                                      | EmailIntegration の Outlook Integration を有効化/無効化する                               | 無効 |
| `EmailIntegration`      | `enableProductivityFeatures`                                                    | EmailIntegration の Productivity Features を有効化/無効化する                             | 無効 |
| `EmailIntegration`      | `enableSupplementalContactInfoInMobile`                                         | EmailIntegration の Supplemental Contact Info In Mobile を有効化/無効化する               | 無効 |
| `EmailTemplate`         | `enableTemplateEnhancedFolderPref`                                              | EmailTemplate の Template Enhanced Folder Pref を有効化/無効化する                        | 無効 |
| `Entitlement`           | `enableEntitlementVersioning`                                                   | Entitlement の Entitlement Versioning を有効化/無効化する                                 | 無効 |
| `Entitlement`           | `enableEntitlements`                                                            | Entitlement の Entitlements を有効化/無効化する                                           | 有効 |
| `Entitlement`           | `enableMilestoneFeedItem`                                                       | Entitlement の Milestone Feed Item を有効化/無効化する                                    | 無効 |
| `Entitlement`           | `enableMilestoneStoppedTime`                                                    | Entitlement の Milestone Stopped Time を有効化/無効化する                                 | 無効 |
| `Forecasting`           | `enableForecasts`                                                               | Forecasting の Forecasts を有効化/無効化する                                              | 無効 |
| `Forecasting`           | `forecastingTypeSettings[LineItemQuantityProductDate].active`                   | LineItemQuantityProductDate の Line Item Quantity Product Date を有効化/無効化する        | 無効 |
| `Forecasting`           | `forecastingTypeSettings[LineItemQuantityScheduleDate].active`                  | LineItemQuantityScheduleDate の Line Item Quantity Schedule Date を有効化/無効化する      | 無効 |
| `Forecasting`           | `forecastingTypeSettings[LineItemRevenueProductDate].active`                    | LineItemRevenueProductDate の Line Item Revenue Product Date を有効化/無効化する          | 無効 |
| `Forecasting`           | `forecastingTypeSettings[LineItemRevenueScheduleDate].active`                   | LineItemRevenueScheduleDate の Line Item Revenue Schedule Date を有効化/無効化する        | 無効 |
| `Forecasting`           | `forecastingTypeSettings[OpportunityLineItemQuantity].active`                   | OpportunityLineItemQuantity の Opportunity Line Item Quantity を有効化/無効化する         | 無効 |
| `Forecasting`           | `forecastingTypeSettings[OpportunityLineItemRevenue].active`                    | OpportunityLineItemRevenue の Opportunity Line Item Revenue を有効化/無効化する           | 無効 |
| `Forecasting`           | `forecastingTypeSettings[OpportunityQuantityProductDate].active`                | OpportunityQuantityProductDate の Opportunity Quantity Product Date を有効化/無効化する   | 無効 |
| `Forecasting`           | `forecastingTypeSettings[OpportunityQuantityScheduleDate].active`               | OpportunityQuantityScheduleDate の Opportunity Quantity Schedule Date を有効化/無効化する | 無効 |
| `Forecasting`           | `forecastingTypeSettings[OpportunityQuantity].active`                           | OpportunityQuantity の Opportunity Quantity を有効化/無効化する                           | 無効 |
| `Forecasting`           | `forecastingTypeSettings[OpportunityRevenueProductDate].active`                 | OpportunityRevenueProductDate の Opportunity Revenue Product Date を有効化/無効化する     | 無効 |
| `Forecasting`           | `forecastingTypeSettings[OpportunityRevenueScheduleDate].active`                | OpportunityRevenueScheduleDate の Opportunity Revenue Schedule Date を有効化/無効化する   | 無効 |
| `Forecasting`           | `forecastingTypeSettings[OpportunityRevenue].active`                            | OpportunityRevenue の Opportunity Revenue を有効化/無効化する                             | 有効 |
| `Forecasting`           | `globalAdjustmentsSettings.enableAdjustments`                                   | Forecasting の Adjustments を有効化/無効化する                                            | 無効 |
| `Forecasting`           | `globalAdjustmentsSettings.enableOwnerAdjustments`                              | Forecasting の Owner Adjustments を有効化/無効化する                                      | 無効 |
| `Ideas`                 | `enableChatterProfile`                                                          | Ideas の Chatter Profile を有効化/無効化する                                              | 有効 |
| `Ideas`                 | `enableHtmlIdea`                                                                | Ideas の Html Idea を有効化/無効化する                                                    | 有効 |
| `Ideas`                 | `enableIdeaMultipleCategory`                                                    | Ideas の Idea Multiple Category を有効化/無効化する                                       | 有効 |
| `Ideas`                 | `enableIdeaThemes`                                                              | Ideas の Idea Themes を有効化/無効化する                                                  | 無効 |
| `Ideas`                 | `enableIdeas`                                                                   | Ideas の Ideas を有効化/無効化する                                                        | 有効 |
| `Ideas`                 | `enableIdeasControllerExtensions`                                               | Ideas の Ideas Controller Extensions を有効化/無効化する                                  | 無効 |
| `Ideas`                 | `enableIdeasReputation`                                                         | Ideas の Ideas Reputation を有効化/無効化する                                             | 無効 |
| `Knowledge`             | `enableKnowledge`                                                               | Knowledge の Knowledge を有効化/無効化する                                                | 無効 |
| `LeadConfig`            | `enableConversionsOnMobile`                                                     | LeadConfig の Conversions On Mobile を有効化/無効化する                                   | 無効 |
| `LeadConfig`            | `enableOrgWideMergeAndDelete`                                                   | LeadConfig の Org Wide Merge And Delete を有効化/無効化する                               | 有効 |
| `LightningExperience`   | `enableAccessCheckCrucPref`                                                     | LightningExperience の Access Check Cruc Pref を有効化/無効化する                         | 無効 |
| `LightningExperience`   | `enableApiUserLtngOutAccessPref`                                                | LightningExperience の Api User Ltng Out Access Pref を有効化/無効化する                  | 無効 |
| `LightningExperience`   | `enableAuraBoxcarReductionPref`                                                 | LightningExperience の Aura Boxcar Reduction Pref を有効化/無効化する                     | 無効 |
| `LightningExperience`   | `enableAuraCDNPref`                                                             | LightningExperience の Aura CDN Pref を有効化/無効化する                                  | 有効 |
| `LightningExperience`   | `enableAuraSecStaticResCRUCPref`                                                | LightningExperience の Aura Sec Static Res CRUC Pref を有効化/無効化する                  | 無効 |
| `LightningExperience`   | `enableDeferRenderingWorkspacePage`                                             | LightningExperience の Defer Rendering Workspace Page を有効化/無効化する                 | 有効 |
| `LightningExperience`   | `enableErrorExperienceEnabled`                                                  | LightningExperience の Error Experience Enabled を有効化/無効化する                       | 無効 |
| `LightningExperience`   | `enableFeedbackInMobile`                                                        | LightningExperience の Feedback In Mobile を有効化/無効化する                             | 有効 |
| `LightningExperience`   | `enableHideOpenInQuip`                                                          | LightningExperience の Hide Open In Quip を有効化/無効化する                              | 無効 |
| `LightningExperience`   | `enableIE11DeprecationMsgHidden`                                                | LightningExperience の IE11 Deprecation Msg Hidden を有効化/無効化する                    | 無効 |
| `LightningExperience`   | `enableIE11LEXCrucPref`                                                         | LightningExperience の IE11 LEX Cruc Pref を有効化/無効化する                             | 無効 |
| `LightningExperience`   | `enableInAppTooltips`                                                           | LightningExperience の In App Tooltips を有効化/無効化する                                | 有効 |
| `LightningExperience`   | `enableLEXExtensionComponentCustomization`                                      | LightningExperience の LEX Extension Component Customization を有効化/無効化する          | 無効 |
| `LightningExperience`   | `enableLEXExtensionDarkMode`                                                    | LightningExperience の LEX Extension Dark Mode を有効化/無効化する                        | 無効 |
| `LightningExperience`   | `enableLEXExtensionInlineEditModifier`                                          | LightningExperience の LEX Extension Inline Edit Modifier を有効化/無効化する             | 無効 |
| `LightningExperience`   | `enableLEXExtensionLinkGrabber`                                                 | LightningExperience の LEX Extension Link Grabber を有効化/無効化する                     | 無効 |
| `LightningExperience`   | `enableLEXExtensionRelatedLists`                                                | LightningExperience の LEX Extension Related Lists を有効化/無効化する                    | 無効 |
| `LightningExperience`   | `enableLEXExtensionRequiredFields`                                              | LightningExperience の LEX Extension Required Fields を有効化/無効化する                  | 無効 |
| `LightningExperience`   | `enableLEXExtensionTrailhead`                                                   | LightningExperience の LEX Extension Trailhead を有効化/無効化する                        | 無効 |
| `LightningExperience`   | `enableLEXOnIpadEnabled`                                                        | LightningExperience の LEX On Ipad Enabled を有効化/無効化する                            | 無効 |
| `LightningExperience`   | `enableLexEndUsersNoSwitching`                                                  | LightningExperience の Lex End Users No Switching を有効化/無効化する                     | 無効 |
| `LightningExperience`   | `enableLightningDomainSidCHIPS`                                                 | LightningExperience の Lightning Domain Sid CHIPS を有効化/無効化する                     | 無効 |
| `LightningExperience`   | `enableLightningPreviewPref`                                                    | LightningExperience の Lightning Preview Pref を有効化/無効化する                         | 無効 |
| `LightningExperience`   | `enableNavPersonalizationOptOut`                                                | LightningExperience の Nav Personalization Opt Out を有効化/無効化する                    | 無効 |
| `LightningExperience`   | `enableNoBackgroundNavigations`                                                 | LightningExperience の No Background Navigations を有効化/無効化する                      | 無効 |
| `LightningExperience`   | `enableQuip`                                                                    | LightningExperience の Quip を有効化/無効化する                                           | 無効 |
| `LightningExperience`   | `enableRemoveThemeBrandBanner`                                                  | LightningExperience の Remove Theme Brand Banner を有効化/無効化する                      | 無効 |
| `LightningExperience`   | `enableS1BannerPref`                                                            | LightningExperience の S1 Banner Pref を有効化/無効化する                                 | 有効 |
| `LightningExperience`   | `enableS1BrowserEnabled`                                                        | LightningExperience の S1 Browser Enabled を有効化/無効化する                             | 有効 |
| `LightningExperience`   | `enableS1DesktopEnabled`                                                        | LightningExperience の S1 Desktop Enabled を有効化/無効化する                             | 有効 |
| `LightningExperience`   | `enableS1UiLoggingEnabled`                                                      | LightningExperience の S1 Ui Logging Enabled を有効化/無効化する                          | 有効 |
| `LightningExperience`   | `enableSidToken3rdPartyAuraApp`                                                 | LightningExperience の Sid Token3rd Party Aura App を有効化/無効化する                    | 無効 |
| `LightningExperience`   | `enableStackedModalManagerEnabled`                                              | LightningExperience の Stacked Modal Manager Enabled を有効化/無効化する                  | 有効 |
| `LightningExperience`   | `enableTryLightningOptOut`                                                      | LightningExperience の Try Lightning Opt Out を有効化/無効化する                          | 無効 |
| `LightningExperience`   | `enableUseS1AlohaDesktop`                                                       | LightningExperience の Use S1 Aloha Desktop を有効化/無効化する                           | 無効 |
| `LightningExperience`   | `enableUsersAreLightningOnly`                                                   | LightningExperience の Users Are Lightning Only を有効化/無効化する                       | 無効 |
| `LiveAgent`             | `enableLiveAgent`                                                               | LiveAgent の Live Agent を有効化/無効化する                                               | 無効 |
| `Mobile`                | `dashboardMobile.enableDashboardIPadApp`                                        | Mobile の Dashboard I Pad App を有効化/無効化する                                         | 有効 |
| `Mobile`                | `enableConfigureMobileHome`                                                     | Mobile の Configure Mobile Home を有効化/無効化する                                       | 無効 |
| `Mobile`                | `enableDRLOnMobile`                                                             | Mobile の DRL On Mobile を有効化/無効化する                                               | 無効 |
| `Mobile`                | `enableEnhancedContactsOnMobile`                                                | Mobile の Enhanced Contacts On Mobile を有効化/無効化する                                 | 無効 |
| `Mobile`                | `enableEnhancedReportsOnMobile`                                                 | Mobile の Enhanced Reports On Mobile を有効化/無効化する                                  | 有効 |
| `Mobile`                | `enableEnhancedSalesMobileBuilder`                                              | Mobile の Enhanced Sales Mobile Builder を有効化/無効化する                               | 有効 |
| `Mobile`                | `enableEnhancedSalesMobileExp`                                                  | Mobile の Enhanced Sales Mobile Exp を有効化/無効化する                                   | 有効 |
| `Mobile`                | `enableImportContactFromDevice`                                                 | Mobile の Import Contact From Device を有効化/無効化する                                  | 有効 |
| `Mobile`                | `enableLandscapeSupportOnPhone`                                                 | Mobile の Landscape Support On Phone を有効化/無効化する                                  | 無効 |
| `Mobile`                | `enablePopulateNameManuallyInToday`                                             | Mobile の Populate Name Manually In Today を有効化/無効化する                             | 無効 |
| `Mobile`                | `enableS1EncryptedStoragePref2`                                                 | Mobile の S1 Encrypted Storage Pref2 を有効化/無効化する                                  | 無効 |
| `Mobile`                | `enableS1OfflinePref`                                                           | Mobile の S1 Offline Pref を有効化/無効化する                                             | 有効 |
| `Mobile`                | `enableUserCustomizationMH`                                                     | Mobile の User Customization MH を有効化/無効化する                                       | 無効 |
| `OmniChannel`           | `enableOmniChannel`                                                             | OmniChannel の Omni Channel を有効化/無効化する                                           | 無効 |
| `OmniChannel`           | `enableOmniSkillsRouting`                                                       | OmniChannel の Omni Skills Routing を有効化/無効化する                                    | 無効 |
| `Order`                 | `enableEnhancedCommerceOrders`                                                  | Order の Enhanced Commerce Orders を有効化/無効化する                                     | 無効 |
| `Order`                 | `enableNegativeQuantity`                                                        | Order の Negative Quantity を有効化/無効化する                                            | 無効 |
| `Order`                 | `enableOptionalPricebook`                                                       | Order の Optional Pricebook を有効化/無効化する                                           | 無効 |
| `Order`                 | `enableOrderEvents`                                                             | Order の Order Events を有効化/無効化する                                                 | 無効 |
| `Order`                 | `enableOrders`                                                                  | Order の Orders を有効化/無効化する                                                       | 有効 |
| `Order`                 | `enableReductionOrders`                                                         | Order の Reduction Orders を有効化/無効化する                                             | 無効 |
| `Order`                 | `enableZeroQuantity`                                                            | Order の Zero Quantity を有効化/無効化する                                                | 無効 |
| `PartyDataModel`        | `enableAutoSelectIndividualOnMerge`                                             | PartyDataModel の Auto Select Individual On Merge を有効化/無効化する                     | 無効 |
| `PartyDataModel`        | `enableConsentManagement`                                                       | PartyDataModel の Consent Management を有効化/無効化する                                  | 有効 |
| `PartyDataModel`        | `enableIndividualAutoCreate`                                                    | PartyDataModel の Individual Auto Create を有効化/無効化する                              | 無効 |
| `Privacy`               | `enableConsentEventStream`                                                      | Privacy の Consent Event Stream を有効化/無効化する                                       | 無効 |
| `Privacy`               | `enableDefaultMetadataValues`                                                   | Privacy の Default Metadata Values を有効化/無効化する                                    | 無効 |
| `RecommendationBuilder` | `enableErbEnabledPref`                                                          | RecommendationBuilder の Erb Enabled Pref を有効化/無効化する                             | 無効 |
| `RecommendationBuilder` | `enableErbStartedPref`                                                          | RecommendationBuilder の Erb Started Pref を有効化/無効化する                             | 無効 |
| `Search`                | `documentContentSearchEnabled`                                                  | Search の document Content Search の有効化状態を管理する                                  | 有効 |
| `Search`                | `enableAdvancedSearchInAlohaSidebar`                                            | Search の Advanced Search In Aloha Sidebar を有効化/無効化する                            | 無効 |
| `Search`                | `enableEinsteinSearchAssistantDialog`                                           | Search の Einstein Search Assistant Dialog を有効化/無効化する                            | 有効 |
| `Search`                | `enableEinsteinSearchEs4kPilot`                                                 | Search の Einstein Search Es4k Pilot を有効化/無効化する                                  | 無効 |
| `Search`                | `enableEinsteinSearchNLSFilters`                                                | Search の Einstein Search NLS Filters を有効化/無効化する                                 | 無効 |
| `Search`                | `enableEinsteinSearchNaturalLanguage`                                           | Search の Einstein Search Natural Language を有効化/無効化する                            | 有効 |
| `Search`                | `enableEinsteinSearchPersonalization`                                           | Search の Einstein Search Personalization を有効化/無効化する                             | 有効 |
| `Search`                | `enablePersonalTagging`                                                         | Search の Personal Tagging を有効化/無効化する                                            | 無効 |
| `Search`                | `enablePublicTagging`                                                           | Search の Public Tagging を有効化/無効化する                                              | 無効 |
| `Search`                | `enableQuerySuggestionPigOn`                                                    | Search の Query Suggestion Pig On を有効化/無効化する                                     | 無効 |
| `Search`                | `enableSalesforceGeneratedSynonyms`                                             | Search の Salesforce Generated Synonyms を有効化/無効化する                               | 有効 |
| `Search`                | `enableSetupSearch`                                                             | Search の Setup Search を有効化/無効化する                                                | 有効 |
| `Search`                | `enableSuggestArticlesLinksOnly`                                                | Search の Suggest Articles Links Only を有効化/無効化する                                 | 無効 |
| `Search`                | `optimizeSearchForCJKEnabled`                                                   | Search の optimize Search For CJK の有効化状態を管理する                                  | 無効 |
| `Search`                | `recentlyViewedUsersForBlankLookupEnabled`                                      | Search の recently Viewed Users For Blank Lookup の有効化状態を管理する                   | 有効 |
| `Search`                | `searchSettingsByObject[Account].enhancedLookupEnabled`                         | Account の enhanced Lookup の有効化状態を管理する                                         | 無効 |
| `Search`                | `searchSettingsByObject[Account].lookupAutoCompleteEnabled`                     | Account の lookup Auto Complete の有効化状態を管理する                                    | 無効 |
| `Search`                | `searchSettingsByObject[ActiveScratchOrg].enhancedLookupEnabled`                | ActiveScratchOrg の enhanced Lookup の有効化状態を管理する                                | 無効 |
| `Search`                | `searchSettingsByObject[ActiveScratchOrg].lookupAutoCompleteEnabled`            | ActiveScratchOrg の lookup Auto Complete の有効化状態を管理する                           | 無効 |
| `Search`                | `searchSettingsByObject[Activity].enhancedLookupEnabled`                        | Activity の enhanced Lookup の有効化状態を管理する                                        | 無効 |
| `Search`                | `searchSettingsByObject[Activity].lookupAutoCompleteEnabled`                    | Activity の lookup Auto Complete の有効化状態を管理する                                   | 無効 |
| `Search`                | `searchSettingsByObject[AssetActionSource].enhancedLookupEnabled`               | AssetActionSource の enhanced Lookup の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[AssetActionSource].lookupAutoCompleteEnabled`           | AssetActionSource の lookup Auto Complete の有効化状態を管理する                          | 無効 |
| `Search`                | `searchSettingsByObject[AssetAction].enhancedLookupEnabled`                     | AssetAction の enhanced Lookup の有効化状態を管理する                                     | 無効 |
| `Search`                | `searchSettingsByObject[AssetAction].lookupAutoCompleteEnabled`                 | AssetAction の lookup Auto Complete の有効化状態を管理する                                | 無効 |
| `Search`                | `searchSettingsByObject[AssetRelationship].enhancedLookupEnabled`               | AssetRelationship の enhanced Lookup の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[AssetRelationship].lookupAutoCompleteEnabled`           | AssetRelationship の lookup Auto Complete の有効化状態を管理する                          | 無効 |
| `Search`                | `searchSettingsByObject[AssetStatePeriod].enhancedLookupEnabled`                | AssetStatePeriod の enhanced Lookup の有効化状態を管理する                                | 無効 |
| `Search`                | `searchSettingsByObject[AssetStatePeriod].lookupAutoCompleteEnabled`            | AssetStatePeriod の lookup Auto Complete の有効化状態を管理する                           | 無効 |
| `Search`                | `searchSettingsByObject[Asset].enhancedLookupEnabled`                           | Asset の enhanced Lookup の有効化状態を管理する                                           | 無効 |
| `Search`                | `searchSettingsByObject[Asset].lookupAutoCompleteEnabled`                       | Asset の lookup Auto Complete の有効化状態を管理する                                      | 無効 |
| `Search`                | `searchSettingsByObject[Attachment].enhancedLookupEnabled`                      | Attachment の enhanced Lookup の有効化状態を管理する                                      | 無効 |
| `Search`                | `searchSettingsByObject[Attachment].lookupAutoCompleteEnabled`                  | Attachment の lookup Auto Complete の有効化状態を管理する                                 | 無効 |
| `Search`                | `searchSettingsByObject[AuthorizationFormConsent].enhancedLookupEnabled`        | AuthorizationFormConsent の enhanced Lookup の有効化状態を管理する                        | 無効 |
| `Search`                | `searchSettingsByObject[AuthorizationFormConsent].lookupAutoCompleteEnabled`    | AuthorizationFormConsent の lookup Auto Complete の有効化状態を管理する                   | 無効 |
| `Search`                | `searchSettingsByObject[AuthorizationFormDataUse].enhancedLookupEnabled`        | AuthorizationFormDataUse の enhanced Lookup の有効化状態を管理する                        | 無効 |
| `Search`                | `searchSettingsByObject[AuthorizationFormDataUse].lookupAutoCompleteEnabled`    | AuthorizationFormDataUse の lookup Auto Complete の有効化状態を管理する                   | 無効 |
| `Search`                | `searchSettingsByObject[AuthorizationFormText].enhancedLookupEnabled`           | AuthorizationFormText の enhanced Lookup の有効化状態を管理する                           | 無効 |
| `Search`                | `searchSettingsByObject[AuthorizationFormText].lookupAutoCompleteEnabled`       | AuthorizationFormText の lookup Auto Complete の有効化状態を管理する                      | 無効 |
| `Search`                | `searchSettingsByObject[AuthorizationForm].enhancedLookupEnabled`               | AuthorizationForm の enhanced Lookup の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[AuthorizationForm].lookupAutoCompleteEnabled`           | AuthorizationForm の lookup Auto Complete の有効化状態を管理する                          | 無効 |
| `Search`                | `searchSettingsByObject[BatchJobPartFailedRecord].enhancedLookupEnabled`        | BatchJobPartFailedRecord の enhanced Lookup の有効化状態を管理する                        | 無効 |
| `Search`                | `searchSettingsByObject[BatchJobPartFailedRecord].lookupAutoCompleteEnabled`    | BatchJobPartFailedRecord の lookup Auto Complete の有効化状態を管理する                   | 無効 |
| `Search`                | `searchSettingsByObject[BatchJobPart].enhancedLookupEnabled`                    | BatchJobPart の enhanced Lookup の有効化状態を管理する                                    | 無効 |
| `Search`                | `searchSettingsByObject[BatchJobPart].lookupAutoCompleteEnabled`                | BatchJobPart の lookup Auto Complete の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[BatchJob].enhancedLookupEnabled`                        | BatchJob の enhanced Lookup の有効化状態を管理する                                        | 無効 |
| `Search`                | `searchSettingsByObject[BatchJob].lookupAutoCompleteEnabled`                    | BatchJob の lookup Auto Complete の有効化状態を管理する                                   | 無効 |
| `Search`                | `searchSettingsByObject[Calendar].enhancedLookupEnabled`                        | Calendar の enhanced Lookup の有効化状態を管理する                                        | 無効 |
| `Search`                | `searchSettingsByObject[Calendar].lookupAutoCompleteEnabled`                    | Calendar の lookup Auto Complete の有効化状態を管理する                                   | 無効 |
| `Search`                | `searchSettingsByObject[Campaign].enhancedLookupEnabled`                        | Campaign の enhanced Lookup の有効化状態を管理する                                        | 無効 |
| `Search`                | `searchSettingsByObject[Campaign].lookupAutoCompleteEnabled`                    | Campaign の lookup Auto Complete の有効化状態を管理する                                   | 無効 |
| `Search`                | `searchSettingsByObject[CaseComment].enhancedLookupEnabled`                     | CaseComment の enhanced Lookup の有効化状態を管理する                                     | 無効 |
| `Search`                | `searchSettingsByObject[CaseComment].lookupAutoCompleteEnabled`                 | CaseComment の lookup Auto Complete の有効化状態を管理する                                | 無効 |
| `Search`                | `searchSettingsByObject[Case].enhancedLookupEnabled`                            | Case の enhanced Lookup の有効化状態を管理する                                            | 無効 |
| `Search`                | `searchSettingsByObject[Case].lookupAutoCompleteEnabled`                        | Case の lookup Auto Complete の有効化状態を管理する                                       | 無効 |
| `Search`                | `searchSettingsByObject[CollaborationGroup].enhancedLookupEnabled`              | CollaborationGroup の enhanced Lookup の有効化状態を管理する                              | 無効 |
| `Search`                | `searchSettingsByObject[CollaborationGroup].lookupAutoCompleteEnabled`          | CollaborationGroup の lookup Auto Complete の有効化状態を管理する                         | 無効 |
| `Search`                | `searchSettingsByObject[CommSubscriptionChannelType].enhancedLookupEnabled`     | CommSubscriptionChannelType の enhanced Lookup の有効化状態を管理する                     | 無効 |
| `Search`                | `searchSettingsByObject[CommSubscriptionChannelType].lookupAutoCompleteEnabled` | CommSubscriptionChannelType の lookup Auto Complete の有効化状態を管理する                | 無効 |
| `Search`                | `searchSettingsByObject[CommSubscriptionConsent].enhancedLookupEnabled`         | CommSubscriptionConsent の enhanced Lookup の有効化状態を管理する                         | 無効 |
| `Search`                | `searchSettingsByObject[CommSubscriptionConsent].lookupAutoCompleteEnabled`     | CommSubscriptionConsent の lookup Auto Complete の有効化状態を管理する                    | 無効 |
| `Search`                | `searchSettingsByObject[CommSubscription].enhancedLookupEnabled`                | CommSubscription の enhanced Lookup の有効化状態を管理する                                | 無効 |
| `Search`                | `searchSettingsByObject[CommSubscription].lookupAutoCompleteEnabled`            | CommSubscription の lookup Auto Complete の有効化状態を管理する                           | 無効 |
| `Search`                | `searchSettingsByObject[ConsumptionSchedule].enhancedLookupEnabled`             | ConsumptionSchedule の enhanced Lookup の有効化状態を管理する                             | 無効 |
| `Search`                | `searchSettingsByObject[ConsumptionSchedule].lookupAutoCompleteEnabled`         | ConsumptionSchedule の lookup Auto Complete の有効化状態を管理する                        | 無効 |
| `Search`                | `searchSettingsByObject[ContactPointAddress].enhancedLookupEnabled`             | ContactPointAddress の enhanced Lookup の有効化状態を管理する                             | 無効 |
| `Search`                | `searchSettingsByObject[ContactPointAddress].lookupAutoCompleteEnabled`         | ContactPointAddress の lookup Auto Complete の有効化状態を管理する                        | 無効 |
| `Search`                | `searchSettingsByObject[ContactPointConsent].enhancedLookupEnabled`             | ContactPointConsent の enhanced Lookup の有効化状態を管理する                             | 無効 |
| `Search`                | `searchSettingsByObject[ContactPointConsent].lookupAutoCompleteEnabled`         | ContactPointConsent の lookup Auto Complete の有効化状態を管理する                        | 無効 |
| `Search`                | `searchSettingsByObject[ContactPointEmail].enhancedLookupEnabled`               | ContactPointEmail の enhanced Lookup の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[ContactPointEmail].lookupAutoCompleteEnabled`           | ContactPointEmail の lookup Auto Complete の有効化状態を管理する                          | 無効 |
| `Search`                | `searchSettingsByObject[ContactPointPhone].enhancedLookupEnabled`               | ContactPointPhone の enhanced Lookup の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[ContactPointPhone].lookupAutoCompleteEnabled`           | ContactPointPhone の lookup Auto Complete の有効化状態を管理する                          | 無効 |
| `Search`                | `searchSettingsByObject[ContactPointTypeConsent].enhancedLookupEnabled`         | ContactPointTypeConsent の enhanced Lookup の有効化状態を管理する                         | 無効 |
| `Search`                | `searchSettingsByObject[ContactPointTypeConsent].lookupAutoCompleteEnabled`     | ContactPointTypeConsent の lookup Auto Complete の有効化状態を管理する                    | 無効 |
| `Search`                | `searchSettingsByObject[Contact].enhancedLookupEnabled`                         | Contact の enhanced Lookup の有効化状態を管理する                                         | 無効 |
| `Search`                | `searchSettingsByObject[Contact].lookupAutoCompleteEnabled`                     | Contact の lookup Auto Complete の有効化状態を管理する                                    | 無効 |
| `Search`                | `searchSettingsByObject[ContentVersion].enhancedLookupEnabled`                  | ContentVersion の enhanced Lookup の有効化状態を管理する                                  | 無効 |
| `Search`                | `searchSettingsByObject[ContentVersion].lookupAutoCompleteEnabled`              | ContentVersion の lookup Auto Complete の有効化状態を管理する                             | 無効 |
| `Search`                | `searchSettingsByObject[ContractLineItem].enhancedLookupEnabled`                | ContractLineItem の enhanced Lookup の有効化状態を管理する                                | 無効 |
| `Search`                | `searchSettingsByObject[ContractLineItem].lookupAutoCompleteEnabled`            | ContractLineItem の lookup Auto Complete の有効化状態を管理する                           | 無効 |
| `Search`                | `searchSettingsByObject[Contract].enhancedLookupEnabled`                        | Contract の enhanced Lookup の有効化状態を管理する                                        | 無効 |
| `Search`                | `searchSettingsByObject[Contract].lookupAutoCompleteEnabled`                    | Contract の lookup Auto Complete の有効化状態を管理する                                   | 無効 |
| `Search`                | `searchSettingsByObject[CreditMemo].enhancedLookupEnabled`                      | CreditMemo の enhanced Lookup の有効化状態を管理する                                      | 無効 |
| `Search`                | `searchSettingsByObject[CreditMemo].lookupAutoCompleteEnabled`                  | CreditMemo の lookup Auto Complete の有効化状態を管理する                                 | 無効 |
| `Search`                | `searchSettingsByObject[DandBCompany].enhancedLookupEnabled`                    | DandBCompany の enhanced Lookup の有効化状態を管理する                                    | 無効 |
| `Search`                | `searchSettingsByObject[DandBCompany].lookupAutoCompleteEnabled`                | DandBCompany の lookup Auto Complete の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[DataUseLegalBasis].enhancedLookupEnabled`               | DataUseLegalBasis の enhanced Lookup の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[DataUseLegalBasis].lookupAutoCompleteEnabled`           | DataUseLegalBasis の lookup Auto Complete の有効化状態を管理する                          | 無効 |
| `Search`                | `searchSettingsByObject[DataUsePurpose].enhancedLookupEnabled`                  | DataUsePurpose の enhanced Lookup の有効化状態を管理する                                  | 無効 |
| `Search`                | `searchSettingsByObject[DataUsePurpose].lookupAutoCompleteEnabled`              | DataUsePurpose の lookup Auto Complete の有効化状態を管理する                             | 無効 |
| `Search`                | `searchSettingsByObject[Document].enhancedLookupEnabled`                        | Document の enhanced Lookup の有効化状態を管理する                                        | 無効 |
| `Search`                | `searchSettingsByObject[Document].lookupAutoCompleteEnabled`                    | Document の lookup Auto Complete の有効化状態を管理する                                   | 無効 |
| `Search`                | `searchSettingsByObject[EmailMessage].enhancedLookupEnabled`                    | EmailMessage の enhanced Lookup の有効化状態を管理する                                    | 無効 |
| `Search`                | `searchSettingsByObject[EmailMessage].lookupAutoCompleteEnabled`                | EmailMessage の lookup Auto Complete の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[EngagementChannelType].enhancedLookupEnabled`           | EngagementChannelType の enhanced Lookup の有効化状態を管理する                           | 無効 |
| `Search`                | `searchSettingsByObject[EngagementChannelType].lookupAutoCompleteEnabled`       | EngagementChannelType の lookup Auto Complete の有効化状態を管理する                      | 無効 |
| `Search`                | `searchSettingsByObject[EnhancedLetterhead].enhancedLookupEnabled`              | EnhancedLetterhead の enhanced Lookup の有効化状態を管理する                              | 無効 |
| `Search`                | `searchSettingsByObject[EnhancedLetterhead].lookupAutoCompleteEnabled`          | EnhancedLetterhead の lookup Auto Complete の有効化状態を管理する                         | 無効 |
| `Search`                | `searchSettingsByObject[Entitlement].enhancedLookupEnabled`                     | Entitlement の enhanced Lookup の有効化状態を管理する                                     | 無効 |
| `Search`                | `searchSettingsByObject[Entitlement].lookupAutoCompleteEnabled`                 | Entitlement の lookup Auto Complete の有効化状態を管理する                                | 無効 |
| `Search`                | `searchSettingsByObject[Folder].enhancedLookupEnabled`                          | Folder の enhanced Lookup の有効化状態を管理する                                          | 無効 |
| `Search`                | `searchSettingsByObject[Folder].lookupAutoCompleteEnabled`                      | Folder の lookup Auto Complete の有効化状態を管理する                                     | 無効 |
| `Search`                | `searchSettingsByObject[Idea].enhancedLookupEnabled`                            | Idea の enhanced Lookup の有効化状態を管理する                                            | 無効 |
| `Search`                | `searchSettingsByObject[Idea].lookupAutoCompleteEnabled`                        | Idea の lookup Auto Complete の有効化状態を管理する                                       | 無効 |
| `Search`                | `searchSettingsByObject[Individual].enhancedLookupEnabled`                      | Individual の enhanced Lookup の有効化状態を管理する                                      | 無効 |
| `Search`                | `searchSettingsByObject[Individual].lookupAutoCompleteEnabled`                  | Individual の lookup Auto Complete の有効化状態を管理する                                 | 無効 |
| `Search`                | `searchSettingsByObject[Lead].enhancedLookupEnabled`                            | Lead の enhanced Lookup の有効化状態を管理する                                            | 無効 |
| `Search`                | `searchSettingsByObject[Lead].lookupAutoCompleteEnabled`                        | Lead の lookup Auto Complete の有効化状態を管理する                                       | 無効 |
| `Search`                | `searchSettingsByObject[LegalEntity].enhancedLookupEnabled`                     | LegalEntity の enhanced Lookup の有効化状態を管理する                                     | 無効 |
| `Search`                | `searchSettingsByObject[LegalEntity].lookupAutoCompleteEnabled`                 | LegalEntity の lookup Auto Complete の有効化状態を管理する                                | 無効 |
| `Search`                | `searchSettingsByObject[ListEmail].enhancedLookupEnabled`                       | ListEmail の enhanced Lookup の有効化状態を管理する                                       | 無効 |
| `Search`                | `searchSettingsByObject[ListEmail].lookupAutoCompleteEnabled`                   | ListEmail の lookup Auto Complete の有効化状態を管理する                                  | 無効 |
| `Search`                | `searchSettingsByObject[Location].enhancedLookupEnabled`                        | Location の enhanced Lookup の有効化状態を管理する                                        | 無効 |
| `Search`                | `searchSettingsByObject[Location].lookupAutoCompleteEnabled`                    | Location の lookup Auto Complete の有効化状態を管理する                                   | 無効 |
| `Search`                | `searchSettingsByObject[Macro].enhancedLookupEnabled`                           | Macro の enhanced Lookup の有効化状態を管理する                                           | 無効 |
| `Search`                | `searchSettingsByObject[Macro].lookupAutoCompleteEnabled`                       | Macro の lookup Auto Complete の有効化状態を管理する                                      | 無効 |
| `Search`                | `searchSettingsByObject[MessagingEndUser].enhancedLookupEnabled`                | MessagingEndUser の enhanced Lookup の有効化状態を管理する                                | 無効 |
| `Search`                | `searchSettingsByObject[MessagingEndUser].lookupAutoCompleteEnabled`            | MessagingEndUser の lookup Auto Complete の有効化状態を管理する                           | 無効 |
| `Search`                | `searchSettingsByObject[MessagingSession].enhancedLookupEnabled`                | MessagingSession の enhanced Lookup の有効化状態を管理する                                | 無効 |
| `Search`                | `searchSettingsByObject[MessagingSession].lookupAutoCompleteEnabled`            | MessagingSession の lookup Auto Complete の有効化状態を管理する                           | 無効 |
| `Search`                | `searchSettingsByObject[NamespaceRegistry].enhancedLookupEnabled`               | NamespaceRegistry の enhanced Lookup の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[NamespaceRegistry].lookupAutoCompleteEnabled`           | NamespaceRegistry の lookup Auto Complete の有効化状態を管理する                          | 無効 |
| `Search`                | `searchSettingsByObject[Note].enhancedLookupEnabled`                            | Note の enhanced Lookup の有効化状態を管理する                                            | 無効 |
| `Search`                | `searchSettingsByObject[Note].lookupAutoCompleteEnabled`                        | Note の lookup Auto Complete の有効化状態を管理する                                       | 無効 |
| `Search`                | `searchSettingsByObject[Opportunity].enhancedLookupEnabled`                     | Opportunity の enhanced Lookup の有効化状態を管理する                                     | 無効 |
| `Search`                | `searchSettingsByObject[Opportunity].lookupAutoCompleteEnabled`                 | Opportunity の lookup Auto Complete の有効化状態を管理する                                | 無効 |
| `Search`                | `searchSettingsByObject[Order].enhancedLookupEnabled`                           | Order の enhanced Lookup の有効化状態を管理する                                           | 無効 |
| `Search`                | `searchSettingsByObject[Order].lookupAutoCompleteEnabled`                       | Order の lookup Auto Complete の有効化状態を管理する                                      | 無効 |
| `Search`                | `searchSettingsByObject[PartyConsent].enhancedLookupEnabled`                    | PartyConsent の enhanced Lookup の有効化状態を管理する                                    | 無効 |
| `Search`                | `searchSettingsByObject[PartyConsent].lookupAutoCompleteEnabled`                | PartyConsent の lookup Auto Complete の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[Pricebook2].enhancedLookupEnabled`                      | Pricebook2 の enhanced Lookup の有効化状態を管理する                                      | 無効 |
| `Search`                | `searchSettingsByObject[Pricebook2].lookupAutoCompleteEnabled`                  | Pricebook2 の lookup Auto Complete の有効化状態を管理する                                 | 無効 |
| `Search`                | `searchSettingsByObject[PricebookEntry].enhancedLookupEnabled`                  | PricebookEntry の enhanced Lookup の有効化状態を管理する                                  | 無効 |
| `Search`                | `searchSettingsByObject[PricebookEntry].lookupAutoCompleteEnabled`              | PricebookEntry の lookup Auto Complete の有効化状態を管理する                             | 無効 |
| `Search`                | `searchSettingsByObject[Product2].enhancedLookupEnabled`                        | Product2 の enhanced Lookup の有効化状態を管理する                                        | 無効 |
| `Search`                | `searchSettingsByObject[Product2].lookupAutoCompleteEnabled`                    | Product2 の lookup Auto Complete の有効化状態を管理する                                   | 無効 |
| `Search`                | `searchSettingsByObject[QuickText].enhancedLookupEnabled`                       | QuickText の enhanced Lookup の有効化状態を管理する                                       | 無効 |
| `Search`                | `searchSettingsByObject[QuickText].lookupAutoCompleteEnabled`                   | QuickText の lookup Auto Complete の有効化状態を管理する                                  | 無効 |
| `Search`                | `searchSettingsByObject[Recommendation].enhancedLookupEnabled`                  | Recommendation の enhanced Lookup の有効化状態を管理する                                  | 無効 |
| `Search`                | `searchSettingsByObject[Recommendation].lookupAutoCompleteEnabled`              | Recommendation の lookup Auto Complete の有効化状態を管理する                             | 無効 |
| `Search`                | `searchSettingsByObject[Report].enhancedLookupEnabled`                          | Report の enhanced Lookup の有効化状態を管理する                                          | 無効 |
| `Search`                | `searchSettingsByObject[Report].lookupAutoCompleteEnabled`                      | Report の lookup Auto Complete の有効化状態を管理する                                     | 無効 |
| `Search`                | `searchSettingsByObject[ScratchOrgInfo].enhancedLookupEnabled`                  | ScratchOrgInfo の enhanced Lookup の有効化状態を管理する                                  | 無効 |
| `Search`                | `searchSettingsByObject[ScratchOrgInfo].lookupAutoCompleteEnabled`              | ScratchOrgInfo の lookup Auto Complete の有効化状態を管理する                             | 無効 |
| `Search`                | `searchSettingsByObject[ServiceContract].enhancedLookupEnabled`                 | ServiceContract の enhanced Lookup の有効化状態を管理する                                 | 無効 |
| `Search`                | `searchSettingsByObject[ServiceContract].lookupAutoCompleteEnabled`             | ServiceContract の lookup Auto Complete の有効化状態を管理する                            | 無効 |
| `Search`                | `searchSettingsByObject[Solution].enhancedLookupEnabled`                        | Solution の enhanced Lookup の有効化状態を管理する                                        | 無効 |
| `Search`                | `searchSettingsByObject[Solution].lookupAutoCompleteEnabled`                    | Solution の lookup Auto Complete の有効化状態を管理する                                   | 無効 |
| `Search`                | `searchSettingsByObject[User].enhancedLookupEnabled`                            | User の enhanced Lookup の有効化状態を管理する                                            | 無効 |
| `Search`                | `searchSettingsByObject[User].lookupAutoCompleteEnabled`                        | User の lookup Auto Complete の有効化状態を管理する                                       | 無効 |
| `Search`                | `searchSettingsByObject[WorkBadgeDefinition].enhancedLookupEnabled`             | WorkBadgeDefinition の enhanced Lookup の有効化状態を管理する                             | 無効 |
| `Search`                | `searchSettingsByObject[WorkBadgeDefinition].lookupAutoCompleteEnabled`         | WorkBadgeDefinition の lookup Auto Complete の有効化状態を管理する                        | 無効 |
| `Search`                | `searchSettingsByObject[WorkBadge].enhancedLookupEnabled`                       | WorkBadge の enhanced Lookup の有効化状態を管理する                                       | 無効 |
| `Search`                | `searchSettingsByObject[WorkBadge].lookupAutoCompleteEnabled`                   | WorkBadge の lookup Auto Complete の有効化状態を管理する                                  | 無効 |
| `Search`                | `searchSettingsByObject[WorkOrderLineItem].enhancedLookupEnabled`               | WorkOrderLineItem の enhanced Lookup の有効化状態を管理する                               | 無効 |
| `Search`                | `searchSettingsByObject[WorkOrderLineItem].lookupAutoCompleteEnabled`           | WorkOrderLineItem の lookup Auto Complete の有効化状態を管理する                          | 無効 |
| `Search`                | `searchSettingsByObject[WorkOrder].enhancedLookupEnabled`                       | WorkOrder の enhanced Lookup の有効化状態を管理する                                       | 無効 |
| `Search`                | `searchSettingsByObject[WorkOrder].lookupAutoCompleteEnabled`                   | WorkOrder の lookup Auto Complete の有効化状態を管理する                                  | 無効 |
| `Search`                | `sidebarAutoCompleteEnabled`                                                    | Search の sidebar Auto Complete の有効化状態を管理する                                    | 有効 |
| `Search`                | `sidebarDropDownListEnabled`                                                    | Search の sidebar Drop Down List の有効化状態を管理する                                   | 有効 |
| `Search`                | `sidebarLimitToItemsIOwnCheckboxEnabled`                                        | Search の sidebar Limit To Items I Own Checkbox の有効化状態を管理する                    | 有効 |
| `Search`                | `singleSearchResultShortcutEnabled`                                             | Search の single Search Result Shortcut の有効化状態を管理する                            | 有効 |
| `Search`                | `spellCorrectKnowledgeSearchEnabled`                                            | Search の spell Correct Knowledge Search の有効化状態を管理する                           | 無効 |
| `SourceTracking`        | `enableSourceTrackingSandboxes`                                                 | SourceTracking の Source Tracking Sandboxes を有効化/無効化する                           | 無効 |
| `UserInterface`         | `enableAsyncRelatedLists`                                                       | UserInterface の Async Related Lists を有効化/無効化する                                  | 無効 |
| `UserInterface`         | `enableClickjackUserPageHeaderless`                                             | UserInterface の Clickjack User Page Headerless を有効化/無効化する                       | 無効 |
| `UserInterface`         | `enableCollapsibleSections`                                                     | UserInterface の Collapsible Sections を有効化/無効化する                                 | 有効 |
| `UserInterface`         | `enableCollapsibleSideBar`                                                      | UserInterface の Collapsible Side Bar を有効化/無効化する                                 | 無効 |
| `UserInterface`         | `enableCustomObjectTruncate`                                                    | UserInterface の Custom Object Truncate を有効化/無効化する                               | 無効 |
| `UserInterface`         | `enableCustomeSideBarOnAllPages`                                                | UserInterface の Custome Side Bar On All Pages を有効化/無効化する                        | 無効 |
| `UserInterface`         | `enableDeleteFieldHistory`                                                      | UserInterface の Delete Field History を有効化/無効化する                                 | 無効 |
| `UserInterface`         | `enableExternalObjectAsyncRelatedLists`                                         | UserInterface の External Object Async Related Lists を有効化/無効化する                  | 有効 |
| `UserInterface`         | `enableHoverDetails`                                                            | UserInterface の Hover Details を有効化/無効化する                                        | 有効 |
| `UserInterface`         | `enableInlineEdit`                                                              | UserInterface の Inline Edit を有効化/無効化する                                          | 有効 |
| `UserInterface`         | `enableNewPageLayoutEditor`                                                     | UserInterface の New Page Layout Editor を有効化/無効化する                               | 有効 |
| `UserInterface`         | `enablePersonalCanvas`                                                          | UserInterface の Personal Canvas を有効化/無効化する                                      | 有効 |
| `UserInterface`         | `enablePrintableListViews`                                                      | UserInterface の Printable List Views を有効化/無効化する                                 | 有効 |
| `UserInterface`         | `enableProfileCustomTabsets`                                                    | UserInterface の Profile Custom Tabsets を有効化/無効化する                               | 有効 |
| `UserInterface`         | `enableQuickCreate`                                                             | UserInterface の Quick Create を有効化/無効化する                                         | 有効 |
| `UserInterface`         | `enableRelatedListHovers`                                                       | UserInterface の Related List Hovers を有効化/無効化する                                  | 有効 |
| `UserInterface`         | `enableSldsV2`                                                                  | UserInterface の Slds V2 を有効化/無効化する                                              | 無効 |
| `UserInterface`         | `enableSldsV2DarkModeInCosmos`                                                  | UserInterface の Slds V2 Dark Mode In Cosmos を有効化/無効化する                          | 無効 |
| `UserInterface`         | `enableTabOrganizer`                                                            | UserInterface の Tab Organizer を有効化/無効化する                                        | 有効 |
