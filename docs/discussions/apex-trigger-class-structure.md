# Apex Trigger クラス構成

## 位置づけ

この文書は、Codex が最初に提案した Apex trigger のクラス構成に対して、運用上の課題を整理し、Codex が途中で見直した構成案をまとめたものです。

## Codex の最初の構成案

```text
AccountTrigger
  -> AccountTriggerHandler
      -> AccountNameNormalizer
      -> AccountXxxAction
      -> AccountYyyAction
```

この構成は、処理ごとの責務が明確になる。
一方で、機能追加のたびにクラスが増えやすい。

## 課題

- 処理単位でクラスを増やすと、ファイル数が膨らみやすい。
- クラスが多くなると、改修時に確認すべき場所が増える。
- before / after で service を分けると、両方で使う処理の置き場に迷う。
- オブジェクト単位 selector は再利用しやすいが、大量の機能がある場合に用途を追いにくい。

## Codex が途中で見直した構成案

```text
AccountTrigger
  -> AccountTriggerHandler
      -> AccountTriggerService
          -> AccountTriggerSelector
```

### 役割

- `AccountTrigger`: trigger entry point。
- `AccountTriggerHandler`: trigger context の振り分け。
- `AccountTriggerService`: Account trigger の処理順序、変更判定、業務ロジックの入口。
- `AccountTriggerSelector`: Account trigger のために必要な SOQL。
- `TestDataFactory`: trigger / service test 用のテストデータ作成。

### クラス分割の考え方

- 最初から 1 処理 1 クラスにしない。
- 小さい処理は `AccountTriggerService` に置く。
- 複雑化した処理だけ専用クラスへ切り出す。
- trigger 外でも使う処理は、trigger 名を含まない service / domain へ昇格する。
- before / after service は、処理量が増えてから検討する。

### Selector の考え方

最初から `AccountSelector` / `ContactSelector` のようなオブジェクト単位 selector に寄せると、Account trigger の改修時に関連クエリを探しにくくなる可能性がある。

Account trigger の処理で使う SOQL は、まず `AccountTriggerSelector` に置く。
Contact や Opportunity を取得する場合でも、Account trigger のための取得であれば `AccountTriggerSelector` に置く。

別 trigger や別 service でも同じ取得が必要になった場合に、共通 selector への切り出しを検討する。

### テスト構成

```text
AccountTriggerHandlerTest
AccountTriggerServiceTest
AccountTriggerSelectorTest
TestDataFactory
```

- `AccountTriggerHandlerTest`: trigger 経由の代表シナリオ。
- `AccountTriggerServiceTest`: 業務ロジックの主テスト。
- `AccountTriggerSelectorTest`: selector が複雑化した場合に追加。

## 命名の再検討

Salesforce Trailhead では、Apex Enterprise Patterns として Service Layer、Domain Layer、Selector Layer が紹介されている。

- [Trailhead - Apex Enterprise Patterns: Service Layer](https://trailhead.salesforce.com/content/learn/modules/apex_patterns_sl)
- [Trailhead - Apex Enterprise Patterns: Domain & Selector Layers](https://trailhead.salesforce.com/content/learn/modules/apex_patterns_dsl)
- [Apex Enterprise Patterns - Service Layer](http://wiki.developerforce.com/page/Apex_Enterprise_Patterns_-_Service_Layer)
- [Apex Enterprise Patterns - Domain Layer](http://wiki.developerforce.com/page/Apex_Enterprise_Patterns_-_Domain_Layer)
- [Apex Enterprise Patterns - Selector Layer](https://github.com/financialforcedev/df12-apex-enterprise-patterns#data-mapper-selector)

一方で、これは Apex 全体で必ず使う標準命名ではなく、クラス名を必ず `Service` / `Domain` / `Selector` にするという意味でもない。
このリポジトリでは、層として責務を分ける考え方は参考にしつつ、クラス名は機能単位で探しやすいことと 40 文字制限を優先して検討する。

このリポジトリでは、次の懸念がある。

- `Service` は外部連携、画面向け処理、trigger 処理など、意味が広くなりやすい。
- `Selector` は役割としては分かりやすいが、クラス名が長くなりやすい。
- Apex クラス名は 40 文字以内に収める必要がある。
- 機能が増える前提では、再利用性より機能単位で探しやすいことを優先したい。

そのため、機能名を接頭辞にして、役割を短い suffix で表す構成を検討する。

```text
<FeatureName><EntryPoint>
<FeatureName><EntryPoint>Test
<FeatureName>Helper
<FeatureName>HelperTest
<FeatureName>Dao
<FeatureName>DaoTest
```

Account trigger の場合:

```text
AccountTriggerHandler
AccountTriggerHandlerTest
AccountTriggerHelper
AccountTriggerHelperTest
AccountTriggerDao
AccountTriggerDaoTest
```

Account 検索機能の場合:

```text
AccountSearchController
AccountSearchControllerTest
AccountSearchHelper
AccountSearchHelperTest
AccountSearchDao
AccountSearchDaoTest
```

この構成では、`AccountTrigger*` や `AccountSearch*` で関連クラスをまとめて探せる。
`Helper` は機能内の業務処理、値補正、validation、変更判定を扱う。
`Dao` は機能内で必要な SOQL と、必要に応じた Map 化 / grouping を扱う。

`Helper` が肥大化した場合は、より具体的な機能名で分割する。
複数機能で同じ取得や処理が必要になった場合は、その時点で共通クラスへの切り出しを検討する。

### API / WebService 系の FeatureName

外部公開 API / WebService 系の機能では、FeatureName に `XxxApi` を優先して使う。
これは Salesforce / Apex の公式標準命名というより、業界一般の開発用語として自然で、`WebService` より短く、`Service` suffix との衝突を避けやすい。

```text
AccountApi
AccountApiTest
AccountApiHelper
AccountApiHelperTest
AccountApiDao
AccountApiDaoTest
```

REST であることを明示したい場合は、`XxxRestApi` も候補にする。

```text
AccountRestApi
AccountRestApiTest
AccountRestApiHelper
AccountRestApiHelperTest
AccountRestApiDao
AccountRestApiDaoTest
```

途中の `Helper` や `Dao` だけを短縮せず、FeatureName 自体を短く設計して関連クラスの接頭辞を揃える。

### 継承の扱い

標準構成には継承を入れない。
基本は `Handler` / `Helper` / `Dao` の委譲で組む。

継承は、全 trigger で再帰制御、無効化フラグ、共通ログ、共通例外変換などを一貫して扱う必要が出た場合に検討する。
単なる共通化や便利メソッド置き場として `Base` クラスを作らない。

```text
避ける例:
BaseTriggerHandler
AccountTriggerHandler extends BaseTriggerHandler
```

共通処理が必要になった場合も、まずは小さい shared helper や utility への委譲を優先する。
継承は framework 的な共通制御が必要になった場合だけ使う。

### 大規模案件の場合

数千人規模の会社に導入するような大規模プロジェクトでは、`Service` / `Domain` / `Selector` に寄せる価値が高くなる。
複数チームで開発する場合、既存の Apex Enterprise Patterns に近い名前を使うことで、レビュー観点や責務分担を揃えやすい。

```text
AccountTriggerHandler
AccountService
AccountDomain
AccountSelector
```

この場合の役割は次のように整理できる。

- `AccountTriggerHandler`: trigger context の振り分け。
- `AccountService`: ユースケース単位の処理。画面、API、Batch、Trigger から呼ばれる処理の入口。
- `AccountDomain`: Account レコード群に対する業務ルール、検証、補正。
- `AccountSelector`: Account を取得する SOQL。

ただし、名前だけを `Service` / `Domain` / `Selector` に寄せても、責務が揃っていなければ読み手の期待と実装がずれる。
大規模案件で採用する場合は、命名だけでなく設計ルール、レビュー基準、テスト方針まで合わせて決める必要がある。

そのためこのプロジェクト標準案は、`Helper` / `Dao` を使う軽量な構成とする。

## クエリ配置の再検討

大規模案件寄りの構成では、`Service` / `Domain` / `Selector` を採用する案がある。
この場合、`Selector` をオブジェクト単位にするか、機能単位にするかが重要な論点になる。

### オブジェクト単位 Selector 案

```text
OpportunityTrigger
OpportunityTriggerHandler
OpportunityTriggerService
OpportunityDomain
OpportunitySelector
OpportunityLineItemSelector
AccountSelector
PricebookEntrySelector
```

この案では、取得対象オブジェクトごとに `Selector` を分ける。
Apex Enterprise Patterns の考え方に寄せやすく、複数機能から同じ取得処理を再利用しやすい。

一方で、商談 trigger の改修時に必要なクエリが複数の `Selector` に散らばる。
商談 trigger のために商談商品、取引先、価格表を取得する場合でも、クエリの置き場所はそれぞれのオブジェクト単位 `Selector` になる。

```text
OpportunityTriggerService
  -> OpportunitySelector
  -> OpportunityLineItemSelector
  -> AccountSelector
  -> PricebookEntrySelector
```

このため、機能改修時の導線は `Service` から呼び出し先を追う形になる。
クラス名だけでは、どの機能で使われているクエリかは判断しにくい。

### 機能単位 Selector 案

```text
OpportunityTrigger
OpportunityTriggerHandler
OpportunityTriggerService
OpportunityTriggerSelector
OpportunityDomain
```

この案では、商談 trigger のために必要な SOQL を `OpportunityTriggerSelector` に集める。
取得対象が `Opportunity`、`OpportunityLineItem`、`Account`、`PricebookEntry` であっても、商談 trigger のための取得であれば同じ `Selector` に置く。

```text
OpportunityTriggerSelector
  - selectOpportunitiesWithOwner
  - countLineItemsByOpportunityId
  - selectAccountsByOpportunityId
  - selectPricebookEntriesByOpportunityId
```

この構成は、商談 trigger の改修時に見る場所が明確になる。
一方で、Apex Enterprise Patterns の純粋なオブジェクト単位 `Selector` とはずれる。
同じクエリが複数機能に増えた場合は、共通 `Selector` への切り出しを検討する。

```text
初期配置:
OpportunityTriggerSelector

共通化後:
OpportunitySelector
OpportunityLineItemSelector
AccountSelector
```

### 整理

大規模案件寄りに `Service` / `Domain` / `Selector` の名前を採用する場合でも、`Selector` を必ずオブジェクト単位にするかは別の判断になる。
このリポジトリでは、改修時の探しやすさを重視するなら、初期配置は機能単位 `Selector` にする案が有力。

## Helper / Dao と Service / Domain / Selector の位置づけ

`Helper` / `Dao` は、設計として誤りという意味ではない。
`Dao` は一般的なソフトウェア設計で使われる名前であり、`Helper` も補助処理をまとめる名前として使われる。

一方で、Salesforce Trailhead の Apex Enterprise Patterns では Service Layer が紹介されており、Salesforce 公式サンプルアプリにも `GeocodingService` や `AccountServiceLayer` のような `Service` を含むクラスがある。
そのため、処理の入口やユースケースを表す名前として `Service` は採用しやすい。

`Domain` / `Selector` は、Salesforce 公式サンプルアプリで統一標準として使われているわけではない。
ただし、Apex Enterprise Patterns の責務分離を説明する語彙としては有用なため、必要な場面で検討する。

このリポジトリでは、次のように整理する。

- `Dao` は否定しないが、SOQL の責務を表す名前としては `Selector` を優先して検討する。
- `Helper` は否定しないが、処理の入口やユースケースを表す場合は `Service` を優先して検討する。
- 単一オブジェクトの業務ルールを明確に分けたい場合は、`Domain` の採用を検討する。
- 命名だけを置き換えず、責務が合っているかを合わせて確認する。

## Salesforce 公式サンプルの扱い

Salesforce 公式サンプルアプリでは、`Controller`、`Service`、`Utilities`、`Helper` など複数の名前が使われている。
確認した範囲では、`Service` / `Domain` / `Selector` が公式サンプル全体の統一命名として使われているわけではない。

- [DreamHouse LWC](https://github.com/trailheadapps/dreamhouse-lwc)
- [Apex Recipes](https://github.com/trailheadapps/apex-recipes)

このリポジトリでは、次のように扱う。

- `Service` は、公式サンプルや Trailhead でも確認できるため、処理の入口やユースケースを表す名前として採用候補にする。
- `Selector` は、SOQL の責務を明確にする名前として採用候補にする。初期配置は機能単位 `Selector` を有力案とする。
- `Domain` は、単一オブジェクトの業務ルールを明確に分けたい場合に採用を検討する。
- Apex Enterprise Patterns は、責務分離を考えるための参考情報として扱う。
