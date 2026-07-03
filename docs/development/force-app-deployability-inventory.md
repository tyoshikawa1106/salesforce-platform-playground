# force-app deployability 棚卸し

`force-app/main/default` を丸ごと Dev 組織へ validate / deploy するのではなく、どの metadata を標準 deploy scope に含めるかを判断するための棚卸しです。

このリポジトリでは `force-app/main/default` を source の正本にします。
ただし、`force-app` には Dev 組織から広く retrieve した org 固有 metadata も含まれるため、標準の Dev 組織 validate / deploy 入口は `manifest/rebuild-developer-org.xml` とします。

## 現在の標準入口

| 用途                 | コマンド                                                          | scope                                |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| Dev 組織 validate    | `npm run sf:validate:dev`                                         | `manifest/rebuild-developer-org.xml` |
| Dev 組織 deploy      | `npm run sf:deploy:dev`                                           | `manifest/rebuild-developer-org.xml` |
| Scratch Org 初期反映 | `node scripts/deploy/scratch-org/run-constructive-scratch-org.js` | `manifest/rebuild-scratch-org.xml`   |

`sf project deploy validate --source-dir force-app` は、標準の成功条件ではなく、広く retrieve した metadata の分類調査として扱います。

## force-app 配下の metadata

`force-app/main/default` には次の top-level metadata directory があります。

| ディレクトリ                        | ファイル数 | 標準 Dev manifest | 判断                                                                                        |
| ----------------------------------- | ---------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `classes/`                          | 38         | 対象              | Apex とテスト。標準 deploy scope に含める。                                                 |
| `triggers/`                         | 2          | 対象              | Apex Trigger。標準 deploy scope に含める。                                                  |
| `lwc/`                              | 15         | 対象              | LWC bundle。`__tests__` は manifest に含めない。                                            |
| `objects/`                          | 687        | 一部対象          | Object / Field / ListView / ValidationRule / WebLink を manifest で明示する。               |
| `flexipages/`                       | 10         | 対象              | Lightning Page。標準 deploy scope に含める。                                                |
| `layouts/`                          | 120        | 一部対象          | manifest に含めた Layout だけを Dev 標準 scope にする。                                     |
| `quickActions/`                     | 25         | 対象              | 標準 deploy scope に含める。                                                                |
| `flows/`                            | 3          | 一部対象          | 有効化や org 前提を確認し、必要な Flow だけを manifest に含める。                           |
| `flowDefinitions/`                  | 3          | 対象外            | Flow active version 指定は org 状態の影響を受けるため、標準 Dev scope には入れない。        |
| `permissionsets/`                   | 3          | 対象              | Profile ではなく Permission Set を優先する。                                                |
| `permissionsetgroups/`              | 1          | 対象外            | 権限セットグループ運用を決めたときに個別 manifest で扱う。                                  |
| `reportTypes/`                      | 6          | 一部対象          | manifest に含めた ReportType だけを Dev 標準 scope にする。                                 |
| `matchingRules/`                    | 4          | 対象              | DuplicateRule と依存する場合はセットで確認する。                                            |
| `duplicateRules/`                   | 2          | 対象外            | Dev 組織由来の標準 DuplicateRule は Scratch Org / 別 org で前提差が出やすい。               |
| `milestoneTypes/`                   | 3          | 対象              | Entitlement と依存するため変更時はセットで確認する。                                        |
| `entitlementProcesses/`             | 1          | 対象外            | 使用中 SLA process は更新できないことがあるため、標準 Dev scope には入れない。              |
| `workflows/`                        | 1          | 対象              | 標準 deploy scope に含める。                                                                |
| `assignmentRules/`                  | 2          | 対象              | ユーザー、キュー、メール参照が混じる場合は個別確認する。                                    |
| `autoResponseRules/`                | 2          | 対象              | メール送信設定の差分に注意する。                                                            |
| `escalationRules/`                  | 1          | 対象外            | ユーザー、キュー、BusinessHours、メール通知先の前提が強い。                                 |
| `sharingRules/`                     | 147        | 対象外            | 空ルールや標準オブジェクト由来のノイズが多く、標準 Dev scope には入れない。                 |
| `roles/`                            | 18         | 対象              | 現在の Dev manifest には含めるが、組織体制依存のため別 org への移植時は要確認。             |
| `applications/`                     | 25         | 一部対象          | ユーザー作成 app は標準 deploy scope に含める。標準 app / namespace 由来の app は個別判断。 |
| `appMenus/`                         | 2          | 対象外            | 組織の表示順や標準アプリ状態に依存する。                                                    |
| `communities/`                      | 1          | 対象外            | Experience Cloud の org 前提が強い。                                                        |
| `managedContentTypes/`              | 3          | 対象外            | 更新不可または CMS 状態依存のものがあるため標準 Dev scope には入れない。                    |
| `settings/`                         | 154        | 対象外            | org 固有、未有効化機能、接続設定が混ざるため、設定ごとに個別判断する。                      |
| `profiles/`                         | 41         | 対象外            | 標準 Profile / 標準タブ設定のノイズが多く、Permission Set へ寄せる。                        |
| `profilePasswordPolicies/`          | 1          | 対象外            | Profile と同じく org / 権限運用依存。                                                       |
| `profileSessionSettings/`           | 1          | 対象外            | Profile と同じく org / 権限運用依存。                                                       |
| `translations/`                     | 8          | 対象外            | 標準項目や有効化機能の前提が広いため、標準 Dev scope には入れない。                         |
| `externalClientApps/`               | 2          | 対象外            | OAuth link や配信状態など org 依存値があるため、通常の Scratch Org 初期反映には含めない。   |
| `extlClntAppGlobalOauthSets/`       | 2          | 対象外            | OAuth / secret / token 関連の設定名を含むため、標準 Dev scope には入れない。                |
| `extlClntAppOauthPolicies/`         | 2          | 対象外            | OAuth policy は org 状態に依存する。                                                        |
| `extlClntAppOauthSecuritySettings/` | 2          | 対象外            | OAuth security は org 状態に依存する。                                                      |
| `extlClntAppOauthSettings/`         | 2          | 対象外            | OAuth settings は org 状態に依存する。                                                      |
| `extlClntAppPolicies/`              | 2          | 対象外            | External Client App policy は org 状態に依存する。                                          |
| `remoteSiteSettings/`               | 2          | 対象              | URL 依存。必要な接続先だけを manifest に含める。                                            |
| `iframeWhiteListUrlSettings/`       | 1          | 対象              | URL 依存。必要な接続先だけを manifest に含める。                                            |
| `samlssoconfigs/`                   | 1          | 対象外            | SSO / 証明書 / IdP など環境依存が強い。                                                     |
| `apexEmailNotifications/`           | 1          | 対象              | 通知先を含み得るため変更時は差分確認する。                                                  |
| `cleanDataServices/`                | 1          | 対象              | Dev manifest に含めるが、機能有効化前提を確認する。                                         |
| `homePageLayouts/`                  | 1          | 対象              | Classic UI 前提。必要性を確認して維持する。                                                 |
| `notificationTypeConfig/`           | 1          | 対象外            | 通知運用の org 前提が強い。                                                                 |
| `topicsForObjects/`                 | 27         | 対象外            | Chatter / topic 有効化状態に依存する。                                                      |
| `transactionSecurityPolicies/`      | 1          | 対象              | セキュリティ運用への影響があるため変更時は個別確認する。                                    |

## 標準 Dev manifest に含める metadata type

`manifest/rebuild-developer-org.xml` は、次の metadata type を標準 Dev validate / deploy scope とします。

- `ApexClass`
- `ApexEmailNotifications`
- `ApexTrigger`
- `AssignmentRules`
- `AutoResponseRules`
- `CleanDataService`
- `CustomField`
- `CustomObject`
- `FlexiPage`
- `Flow`
- `HomePageLayout`
- `IframeWhiteListUrlSettings`
- `Layout`
- `LightningComponentBundle`
- `ListView`
- `MatchingRules`
- `MilestoneType`
- `PermissionSet`
- `QuickAction`
- `RemoteSiteSetting`
- `ReportType`
- `Role`
- `TransactionSecurityPolicy`
- `ValidationRule`
- `WebLink`
- `Workflow`

この一覧は「常にすべての org で安全」という意味ではありません。
この Dev 組織で通常作業の validate / deploy 入口として使う scope です。
別 org や Scratch Org に移す場合は、対象 org の機能有効化、標準 app、接続先 URL、権限、ユーザー / キュー参照を確認します。

## 標準 scope から外す主な metadata

次の metadata は Git 管理していても、`manifest/rebuild-developer-org.xml` には含めません。

| 種別                          | 理由                                                           | 今後の扱い                                                                         |
| ----------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `settings/`                   | org 固有値、未有効化機能、接続設定、セキュリティ設定が混ざる。 | 設定ごとに scratch definition、個別 manifest、または手順 docs で扱う。             |
| `profiles/` / profile 系      | 標準 Profile や標準タブ設定のノイズが大きい。                  | Permission Set / Permission Set Group へ寄せる。                                   |
| External Client App 系        | OAuth link、配信状態、security settings など org 依存が強い。  | 通常の初期反映から外し、必要になった時点で org 固有値を含まない手順を設計する。    |
| `managedContentTypes/`        | CMS 状態依存、更新不可のものがある。                           | CMS を作業対象にする Issue で個別に検証する。                                      |
| `entitlementProcesses/`       | 使用中 SLA process は更新不可になることがある。                | 新規 / 変更が必要なときだけ専用 manifest で検証する。                              |
| `applications/` / `appMenus/` | 標準 app、tab、namespace、表示順に依存する。                   | ユーザー作成 app は標準 deploy scope に含め、標準 app / AppMenu は個別に管理する。 |
| `sharingRules/`               | 空の標準 object rule や org 由来のノイズが多い。               | 実際に共有ルールを設計する Issue で対象 object のみ扱う。                          |
| `translations/`               | 標準項目や有効化機能に依存する。                               | 翻訳作業の Issue で対象言語と component を絞る。                                   |
| `communities/`                | Experience Cloud の site / domain / network 前提が強い。       | Experience Cloud を扱う Issue で専用手順に分ける。                                 |
| `samlssoconfigs/`             | 証明書、IdP、SSO 設定など環境依存が強い。                      | 実値を含めず、必要なら設定手順 docs として管理する。                               |

## 今後 force-app を deployable に寄せる手順

`force-app` 全体を deployable に近づける場合は、まとめて削除や移動をしません。
metadata type ごとに次の順で進めます。

1. 対象 metadata type の目的を決める。
2. Dev 組織に残す source と、Scratch Org / 別 org 用に分離する source を決める。
3. `manifest/rebuild-developer-org.xml` に入れる場合は、追加前に対象 org で validate する。
4. 標準 scope から外す場合は、理由をこの docs か該当 deployment docs に残す。
5. retrieve で再混入しやすい metadata は、取得 manifest 側を絞る。

優先して見直す候補は次です。

| 優先度 | 対象                                     | 理由                                                                         |
| ------ | ---------------------------------------- | ---------------------------------------------------------------------------- |
| 高     | `settings/`                              | 154 files あり、org 固有値と有効化機能差分が混ざりやすい。                   |
| 高     | External Client App 系                   | Dev / Scratch Org / 生成物の境界を明確にすると再現性が上がる。               |
| 中     | `profiles/`                              | Permission Set へ寄せるほど差分管理が安定する。                              |
| 中     | `applications/` / `appMenus/`            | ユーザー作成 app と標準 app / AppMenu を分けると deploy scope を狭められる。 |
| 中     | `sharingRules/`                          | 空ルールや標準 object 由来の差分を減らせる可能性がある。                     |
| 低     | `translations/` / `managedContentTypes/` | 使う機能が明確になってから扱う方が安全。                                     |

## 関連 docs

- [変更チェックリスト](change-checklist.md)
- [メタデータ開発ルール](metadata-rules.md)
- [Salesforce 組織反映ルール](../deployment/salesforce-org-deploy-rules.md)
- [Scratch Org 再現ルール](../deployment/scratch-org-rebuild-rules.md)
- [Salesforce メタデータの Git 管理候補](salesforce-metadata-git-management-candidates.md)
