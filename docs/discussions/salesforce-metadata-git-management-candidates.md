# Salesforce メタデータの Git 管理候補

Salesforce CLI で別組織へデプロイして同じ環境を再現したい場合、retrieve できるメタデータを Git 管理するものと除外するものに分けて扱います。

Trailhead Playground などの学習用組織は、初期パッケージ、サンプル設定、標準プロファイル、組織固有の接続設定が混ざりやすいため、広い `package.xml` の retrieve 結果をそのまま Git 管理の基準にしないようにします。

この文書では、Salesforce 組織から別の Salesforce 組織へ再現する用途を前提にします。管理対象にすると決めた metadata ディレクトリは、個別ファイルを部分選別せず、原則として取得結果をまとめて管理します。

## 基本方針

| 方針         | 内容                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------- |
| 管理する     | Apex、LWC、オブジェクト、画面、Settings など、Salesforce 環境として別組織へ再現したいメタデータ   |
| 全部管理する | 管理対象にしたディレクトリは、同じ type 内で個別ファイルを選別せず、retrieve 結果をまとめて扱う   |
| 原則除外する | Playground 初期状態、標準プロファイル、インストール済みパッケージ、ロール、メニュー、組織固有設定 |
| 慎重に扱う   | OAuth、SAML、外部URL、セキュリティ設定など、機密情報や環境依存値を含み得るもの                    |

## 管理対象候補

| ディレクトリ            | 管理するもの                                            | 判断                                              |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| `classes/`              | Apex クラス、テストクラス                               | 管理対象                                          |
| `triggers/`             | Apex トリガ                                             | 管理対象                                          |
| `lwc/`                  | Lightning Web Components                                | 管理対象                                          |
| `objects/`              | オブジェクト定義、項目、RecordType、ValidationRule など | 管理対象。`listViews/` は除外                     |
| `applications/`         | Lightning アプリ、Classic アプリ                        | 管理対象。取得結果をまとめて管理                  |
| `permissionsets/`       | 権限セット                                              | 管理対象。取得結果をまとめて管理                  |
| `permissionsetgroups/`  | 権限セットグループ                                      | 管理対象。取得結果をまとめて管理                  |
| `flexipages/`           | Lightning Record Page、App Page、Home Page              | 管理対象。取得結果をまとめて管理                  |
| `layouts/`              | ページレイアウト                                        | 管理対象。取得結果をまとめて管理                  |
| `quickActions/`         | クイックアクション                                      | 管理対象。取得結果をまとめて管理                  |
| `flows/`                | Flow 本体                                               | 管理対象。取得結果をまとめて管理                  |
| `flowDefinitions/`      | Flow の有効バージョン指定                               | Flow とセットで管理                               |
| `settings/`             | 組織設定                                                | 管理対象。ユーザー名や My Domain を含む設定は除外 |
| `sharingRules/`         | 共有ルール                                              | 管理対象。取得結果をまとめて管理                  |
| `matchingRules/`        | 重複判定用の一致ルール                                  | 管理対象。取得結果をまとめて管理                  |
| `duplicateRules/`       | 重複ルール                                              | 管理対象。取得結果をまとめて管理                  |
| `workflows/`            | Workflow Rule、Alert、Field Update など                 | 管理対象。取得結果をまとめて管理                  |
| `entitlementProcesses/` | エンタイトルメントプロセス                              | 管理対象。取得結果をまとめて管理                  |
| `milestoneTypes/`       | マイルストーン種別                                      | Entitlement とセットで管理                        |
| `communities/`          | Experience Cloud の旧形式メタデータ                     | 利用する場合はディレクトリ単位で管理              |
| `reportTypes/`          | カスタムレポートタイプ                                  | 管理対象。取得結果をまとめて管理                  |
| `translations/`         | 翻訳                                                    | 管理対象。取得結果をまとめて管理                  |

## 除外候補

| ディレクトリ                             | 管理するもの                             | 判断                                             |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| `installedPackages/`                     | インストール済みパッケージ               | Trailhead や組織初期状態が混ざるため原則除外     |
| `profiles/`                              | プロファイル権限                         | 差分が巨大で組織依存。PermissionSet へ寄せる     |
| `profilePasswordPolicies/`               | プロファイル別パスワードポリシー         | 原則除外                                         |
| `profileSessionSettings/`                | プロファイル別セッション設定             | 原則除外                                         |
| `roles/`                                 | ロール階層                               | 組織体制依存が強いため原則除外                   |
| `appMenus/`                              | アプリランチャー、モバイルメニュー表示順 | 組織状態依存のため原則除外                       |
| `homePageLayouts/`                       | Classic ホームページレイアウト           | 原則除外                                         |
| `topicsForObjects/`                      | オブジェクトのトピック有効化設定         | 通常は除外寄り                                   |
| `notificationTypeConfig/`                | 通知種別設定                             | 通知運用に属するため除外                         |
| `transactionSecurityPolicies/`           | Transaction Security ポリシー            | セキュリティ運用に属するため原則除外             |
| `managedContentTypes/`                   | CMS 管理コンテンツタイプ                 | CMS を使う場合だけ管理                           |
| `cleanDataServices/`                     | Data.com / Clean 系設定                  | 原則除外                                         |
| `objects/*/listViews/`                   | リストビュー                             | Git 管理対象外                                   |
| `apexEmailNotifications/`                | Apex 例外メール通知                      | 通知先を含み得るため除外                         |
| `assignmentRules/`                       | Lead/Case 割り当てルール                 | ユーザー名/メール参照を含み得るため除外          |
| `autoResponseRules/`                     | 自動返信ルール                           | メール送信設定を含み得るため除外                 |
| `escalationRules/`                       | Case エスカレーションルール              | ユーザー名/メール通知先を含み得るため除外        |
| `settings/Case.settings-meta.xml`        | Case 設定                                | デフォルト所有者などユーザー名を含み得るため除外 |
| `settings/Forecasting.settings-meta.xml` | Forecasting 設定                         | 商談カスタム項目ID参照を含み得るため一旦除外     |
| `settings/MyDomain.settings-meta.xml`    | My Domain 設定                           | 組織固有のドメイン名を含むため除外               |

## 機密・環境依存が強いもの

| ディレクトリ                        | 管理するもの                                  | 判断                                 |
| ----------------------------------- | --------------------------------------------- | ------------------------------------ |
| `remoteSiteSettings/`               | 外部接続先 URL 許可                           | URL 依存。必要なら環境別値として扱う |
| `samlssoconfigs/`                   | SAML SSO 設定                                 | 機密・環境依存が強いため除外         |
| `externalClientApps/`               | External Client App                           | OAuth や接続設定を含むため原則除外   |
| `extlClntAppGlobalOauthSets/`       | External Client App の OAuth 共通設定         | 機密・環境依存が強いため除外         |
| `extlClntAppOauthPolicies/`         | External Client App の OAuth ポリシー         | 機密・環境依存が強いため除外         |
| `extlClntAppOauthSecuritySettings/` | External Client App の OAuth セキュリティ設定 | 機密・環境依存が強いため除外         |
| `extlClntAppOauthSettings/`         | External Client App の OAuth 設定             | 機密・環境依存が強いため除外         |
| `extlClntAppPolicies/`              | External Client App のポリシー                | 機密・環境依存が強いため除外         |
| `iframeWhiteListUrlSettings/`       | iframe 許可 URL                               | URL 依存。必要なら環境別値として扱う |

## BusinessHours の扱い

`BusinessHours` は `CustomObject` の member として取得できません。営業時間設定をメタデータとして管理する場合は、`Settings` の member として扱います。

```xml
<types>
    <members>BusinessHours</members>
    <name>Settings</name>
</types>
```

retrieve 後の出力先は次の形式です。

```text
force-app/main/default/settings/BusinessHours.settings-meta.xml
```

## 運用上の注意

広い `package.xml` は棚卸しには有効ですが、コミット用 manifest にする場合は、取得する metadata type と除外する metadata type を明確にします。

別組織を Salesforce CLI で再現したい場合は、次のように分けます。

1. 棚卸し用 manifest で retrieve して候補を確認する。
2. Git 管理する metadata type は、取得結果をまとめて `force-app/main/default` に残す。
3. 管理しない metadata type は、ディレクトリごと除外する。
4. 別組織では Git 管理対象だけを `sf project deploy start` でデプロイする。
