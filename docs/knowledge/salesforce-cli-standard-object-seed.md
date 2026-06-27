# Salesforce CLI で主要標準オブジェクトの seed を作る考え方

Salesforce CLI でテストデータを作る場合、単体オブジェクトの投入と、親子関係を持つ標準オブジェクト一式の投入では適した方法が異なります。

単純な `Account` だけの投入であれば、CSV と Bulk API を使う `sf data import bulk` が扱いやすいです。一方で、`Account`、`Contact`、`Opportunity`、`Product2`、`PricebookEntry`、`OpportunityLineItem`、`Case` のように関係 ID を受け渡すデータでは、CSV だけで順序と参照関係を保つのが難しくなります。

このような標準オブジェクト一式の seed では、Salesforce CLI から anonymous Apex を実行する形が実用的です。

```sh
sf apex run --file scripts/apex/setup/standard-objects/seed-standard-objects.apex --target-org <alias>
```

## CSV import と Apex seed の使い分け

| 方法                  | 向いている用途                                               | 注意点                                                  |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `sf data import bulk` | 単体オブジェクト、大量 CSV、外部 ID による upsert            | 親子関係の ID 解決を別途考える必要がある                |
| `sf apex run`         | 関連レコードを同一処理で作る seed、cleanup、検証用データ作成 | 実行先 org の機能、権限、validation rule の影響を受ける |

CSV import は「既に ID や外部 ID が揃っているデータ」を投入する用途に向いています。

Apex seed は「作った親レコードの ID を、その場で子レコードへ渡す」用途に向いています。

## 標準オブジェクト seed の基本順序

主要な Sales / Service のデータを作る場合は、参照される側から作成します。

1. `Account`
2. `Contact`
3. `Lead`
4. `Campaign`
5. `CampaignMember`
6. `Product2`
7. `Pricebook2`
8. `PricebookEntry`
9. `Opportunity`
10. `OpportunityContactRole`
11. `OpportunityLineItem`
12. `Contract`
13. `Order`
14. `OrderItem`
15. `Asset`
16. `Case`
17. `ServiceContract`
18. `Entitlement`
19. `WorkOrder`
20. `WorkOrderLineItem`
21. `Task`
22. `Event`
23. `EmailMessage`
24. `ContentVersion`

`PricebookEntry` は `Product2` と価格表に依存します。`OpportunityLineItem` と `OrderItem` は `PricebookEntry` に依存します。`Task` や `Event` は `WhoId`、`WhatId` で `Contact` や `Opportunity` に関連付けられます。

レイアウトにある項目でも、`CreatedById`、自動採番、集計項目、標準価格、合計金額などは insert できません。seed では対象 org の describe で createable な標準項目だけに値を設定します。

## 固定値を避けたい項目

標準 picklist の値は、組織設定や翻訳、機能有効化状態で変わることがあります。

特に次のような値は、固定文字列で決め打ちしすぎない方が安全です。

- `Lead.Status`
- `Opportunity.StageName`
- `Case.Status`
- `Account.Type`
- `Account.Industry`
- `Campaign.Status`
- `Case.Origin`
- `Task.Status`
- `Task.Priority`

必須の状態値は、可能であれば setup object から取得します。

```apex
LeadStatus defaultLeadStatus = [
    SELECT MasterLabel
    FROM LeadStatus
    WHERE IsDefault = TRUE
    LIMIT 1
];
```

```apex
OpportunityStage openStage = [
    SELECT MasterLabel
    FROM OpportunityStage
    WHERE IsActive = TRUE AND IsClosed = FALSE
    ORDER BY SortOrder
    LIMIT 1
];
```

任意項目であれば、seed の安定性を優先して設定しない選択もあります。

## 機能依存オブジェクトの扱い

`WorkOrder`、`WorkOrderLineItem`、Knowledge article のように、組織の機能やライセンス状態で利用可否が変わるオブジェクトがあります。

このようなオブジェクトを anonymous Apex で直接型参照すると、利用できない org では seed 全体が compile で止まることがあります。

機能依存の標準オブジェクトは、`Schema.getGlobalDescribe()` で存在確認し、使える場合だけ dynamic SObject として作成すると影響を狭められます。

```apex
Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();

if (globalDescribe.containsKey('WorkOrder')) {
    SObject workOrder = globalDescribe.get('WorkOrder').newSObject();
    workOrder.put('Subject', 'Example Work Order');
    insert workOrder;
}
```

`Report` と `Dashboard` は metadata-backed なので、通常の DML seed では作成しません。追加 `User` はライセンス、プロファイル、ユーザー名の一意性、メール設定の判断が必要なため、標準オブジェクト seed からは分けます。

## cleanup を先に考える

org に seed データを作る場合は、作成より先に削除方法を決めておきます。

実用的な cleanup では、seed 専用の接頭辞を `Name`、`Subject`、`Description` などに入れ、子オブジェクトから順に削除します。

```apex
String seedPrefix = '[TEST]%';

List<Case> cases = [
    SELECT Id
    FROM Case
    WHERE Subject LIKE :seedPrefix
];
delete cases;
```

削除順序は作成順序の逆を基本にします。たとえば `OpportunityLineItem` を削除してから `Opportunity`、`Contact` を削除してから `Account`、という順序です。

## 実行前の確認

実 org に対して seed を流す前に、対象 org を確認します。

```sh
sf org display --target-org <alias>
```

項目や picklist の前提が不明な場合は、describe で確認します。

```sh
sf sobject describe --sobject Account --target-org <alias> --json
```

リポジトリで再利用する場合は、dry-run 用の wrapper を用意し、実行予定の `sf` コマンドを確認してから実行できるようにすると安全です。

## このリポジトリでの実装例

このリポジトリでは、具体的な運用手順を [Salesforce CLI テストデータインポート](../development/test-data-import.md) に置いています。

主要標準オブジェクト seed の実体は次です。

- `scripts/apex/setup/standard-objects/seed-standard-objects.apex`
- `scripts/apex/setup/standard-objects/cleanup-standard-objects.apex`
- `scripts/setup/standard-objects/import-plan.json`
