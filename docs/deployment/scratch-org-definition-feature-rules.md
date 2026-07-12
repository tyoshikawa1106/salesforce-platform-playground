# Scratch Org definition feature ルール

この文書は、AI エージェントが Scratch Org definition の features と settings を扱うときの判断ルールを定義します。

Salesforce DX の Scratch Org は、作成時の definition file で edition、features、settings を指定します。
標準オブジェクトや製品機能の一部は、作成後に Settings メタデータを deploy するだけでは追加されません。
そのため、再現したい機能がある場合は、Scratch Org 作成時点で `features` に指定できるかを先に確認します。

## 基本ルール

Scratch Org definition の主な項目:

| 項目       | 役割                                                                 |
| ---------- | -------------------------------------------------------------------- |
| `orgName`  | Scratch Org の表示名。                                               |
| `edition`  | 作成する org の edition。`Developer` などを指定する。                |
| `features` | 作成時に有効化する機能や追加ライセンス数。                           |
| `settings` | 作成後の組織設定。Scratch Org 作成時に適用できる範囲だけ指定できる。 |

`features` は Dev Hub 側で許可されているものだけが使えます。
Salesforce CLI の候補に出る feature でも、利用中の Dev Hub や edition で作成できない場合があります。

## 現在の設定例

`config/project-scratch-def.json` は、通常時の Scratch Org 再構築に必要な feature だけを指定します。
主要な標準オブジェクトや製品機能の再現性を検証する場合は、後述の feature 候補を一時的に追加して、Scratch Org 作成が通るか確認します。

```json
{
    "orgName": "Scratch Org",
    "edition": "Developer",
    "features": ["EnableSetPasswordInApi", "FieldService:5"],
    "settings": {
        "lightningExperienceSettings": {
            "enableS1DesktopEnabled": true
        },
        "mobileSettings": {
            "enableS1EncryptedStoragePref2": false
        }
    }
}
```

## feature 候補の位置づけ

主要な標準オブジェクトの再現性を上げる検証では、Sales / Service / Field Service / Knowledge / Experience Cloud / 開発・自動化系を広めに指定しました。
現在の通常設定には含めませんが、目的別に追加候補として使えます。

## feature 候補の分類

| 分類                     | 主な feature                                                                                                                      | 狙い                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| API / 開発               | `API`, `AuthorApex`, `DebugApex`, `ForceComPlatform`                                                                              | Apex、CLI、メタデータ deploy、開発操作の前提を揃える。                   |
| カスタマイズ上限         | `AddCustomApps:30`, `AddCustomObjects:30`, `AddCustomRelationships:10`, `AddCustomTabs:30`                                        | 検証用に app / object / relation / tab の作成枠を増やす。                |
| Sales                    | `SalesUser`, `ProductsAndSchedules`, `PersonAccounts`                                                                             | Account、Contact、Opportunity、Product、Pricebook 周辺の再現性を上げる。 |
| Service                  | `ServiceCloud`, `ServiceUser`, `Entitlements`, `CaseClassification`, `CaseWrapUp`, `LiveAgent`                                    | Case、Entitlement、Service Console、Live Agent 周辺の再現性を上げる。    |
| Field Service            | `FieldService:5`, `FieldServiceDispatcherUser:5`, `FieldServiceMobileUser:5`, `FieldServiceSchedulingUser:5`, `AssetScheduling:5` | Work Order、Work Plan、Service Resource 周辺の前提を作る。               |
| Knowledge / Content      | `Knowledge`, `SalesforceContentUser`                                                                                              | Knowledge、File / Content 周辺の前提を作る。                             |
| Experience Cloud / Sites | `Communities`, `Sites`, `FlowSites`                                                                                               | Site、Community、公開 flow 周辺の前提を作る。                            |
| 自動化 / イベント        | `Workflow`, `ProcessBuilder`, `WorkflowFlowActionFeature`, `ChangeDataCapture`, `StreamingAPI`, `GenericStreaming`                | Flow、Workflow、CDC、Streaming API 周辺の検証前提を作る。                |
| その他の標準機能         | `SharedActivities`, `ContactsToMultipleAccounts`, `StateAndCountryPicklist`, `Macros`, `ObjectLinking`                            | 標準 object や UI 機能の差分を減らす。                                   |

## feature 別の注意点

この節の数量や利用可否は、確認時点の Dev Hub、edition、Salesforce release、CLI schema に依存します。definition file または Dev Hub を変更するときは、記載値を固定仕様として流用せず、対象環境で Scratch Org 作成を再確認します。

| feature                                      | 注意点                                                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AddCustomRelationships`                     | 検証時点では `30` が無効な数量として失敗し、`10` で作成できた。再利用時は対象 Dev Hub で再確認する                                                                                                |
| `TransactionFinalizers`                      | 検証時点では CLI schema の候補に含まれたが、対象 Dev Hub で無効な feature として失敗した。再利用時は対象 Dev Hub と release で再確認する                                                          |
| `WorkPlan` / `WorkPlanTemplate` / `WorkStep` | Field Service feature に依存する。`FieldService.settings` の `enableWorkOrders=true` を deploy するだけでは既存 Scratch Org に追加されないため、作成時に `FieldService:<ライセンス数>` を指定する |
| `SharedActivities` など                      | 作成後に Metadata API で有効化、無効化、更新できない設定は、Settings メタデータを別 source として deploy せず、Scratch Org definition の `features` で扱う                                        |

## settings の扱い

`settings` には、Scratch Org 作成時に適用できる設定だけを置きます。
現在の設定例では Lightning Experience と mobile storage の設定だけを指定しています。

```json
"settings": {
    "lightningExperienceSettings": {
        "enableS1DesktopEnabled": true
    },
    "mobileSettings": {
        "enableS1EncryptedStoragePref2": false
    }
}
```

Salesforce 組織から retrieve した `force-app/main/default/settings` を、Scratch Org 用にそのまま deploy する方針は避けます。
Settings には、未有効化機能、証明書、メール、認証、Data Cloud、Territory など、org 固有または契約依存の値が混ざりやすいためです。

## 判断手順

Scratch Org の再現性を上げるときは、次の順で確認します。

1. 標準オブジェクトや機能が Scratch Org 作成時 feature に依存するか確認する。
2. 依存する場合は `features` に追加して、Scratch Org 作成が通るか確認する。
3. 作成後に `describe` や metadata deploy dry-run で対象オブジェクトと metadata が存在するか確認する。
4. Settings メタデータで後から有効化しようとせず、作成時 feature、個別 manifest、または手順 docs に分ける。

この整理は、Scratch Org を Salesforce 組織と完全一致させるためではなく、主要な開発・検証対象を再現できる最小限の作成条件を明確にするためのものです。
