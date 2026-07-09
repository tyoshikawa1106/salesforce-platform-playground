# Apex API version 50.0-67.0 の主要追加点

Apex の seasonal release 差分を確認するときは、Apex Developer Guide と Apex Reference Guide の対象 API version を比較します。

このメモは API version 50.0 から 67.0 までで、Apex 開発時に確認しやすい主要追加点をまとめます。製品固有 namespace の細かい追加は多いため、汎用 Apex、Agentforce、Flow、managed package、Data Cloud / Commerce 連携に関係する項目を優先します。

## API 67.0 / Summer '26

主な追加点は Apex Integration Tests です。

| 項目                               | 概要                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `@IntegrationTest`                 | Agentforce や Data 360 などの実サービス連携を含む end-to-end 寄りの Apex テストを定義する。   |
| `@TearDown`                        | integration test 後の cleanup method を定義する。テスト成功、失敗、例外に関係なく実行される。 |
| `IntegrationTest.commitTestOnly()` | integration test 中にデータを途中 commit し、別スレッドや外部サービスから見える状態にする。   |

Apex Integration Tests は Developer Preview です。Summer '26 では scratch org 限定で、production org、sandbox、metadata deployment では使用できません。標準の `@IsTest` unit test を置き換えるものではなく、real service interaction や transaction boundary が必要なケースに限定して使います。

実務上は、次の点を先に確認します。

- scratch org definition に `ApexIntegrationTests` feature が必要。
- integration test はデータを commit するため、`@TearDown` を必ず用意する。
- deployment code coverage にはカウントされない。
- metadata deployment の `RunAllTests` には含まれない。
- 同時実行や実行時間に制約があるため、短く焦点を絞る。

## API 66.0 / Spring '26

主な追加点は Apex cursor / pagination 系 API と managed package の versioning 説明の拡充です。

| 項目                                                         | 概要                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `Database.PaginationCursor`                                  | SOQL query の結果を cursor でページング取得するための class。                                 |
| `Database.CursorFetchResult`                                 | cursor fetch の結果を表す class。取得済み records、次 index、完了状態などを扱う。             |
| `Database.getPaginationCursor(...)`                          | query から pagination cursor を作成する。`AccessLevel` 指定や bind map 付き overload もある。 |
| `Limits.getApexPaginationCursors()` など                     | Apex cursor / pagination cursor の governor usage と limit を確認する。                       |
| `System.requestVersion()` / `System.runAs(new Version(...))` | managed package の versioned behavior を実装、テストする文脈で説明が強化された。              |

大量データの処理で単純な OFFSET や全件取得に寄せる前に、pagination cursor が使える場面か確認します。

managed package では、subscriber 側の Apex class / trigger が参照する package version と、package developer 側の backward compatibility 設計を分けて考えます。既存 subscriber 実装を壊さないため、公開済み `global` API の shape と behavior の変更には version を意識した設計が必要です。

## API 65.0 / Winter '26

主な追加点は ApexDoc の公式ガイド追加と、Flow Builder 向け invocable action input 表示制御です。

| 項目                       | 概要                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| ApexDoc                    | Apex 用の標準コメント形式。人間、documentation generator、AI agent が codebase を理解しやすくする目的で説明されている。 |
| ApexDoc tags / examples    | class、method、property、constructor、enum、annotation などの Apex constructs をどう文書化するかのガイド。              |
| `InvocableActionExtension` | `@InvocableMethod` の input parameter 表示順や group を Flow Builder 上で制御する metadata。                            |

`InvocableActionExtension` は Apex annotation ではなく metadata です。Apex 側は `@InvocableMethod` / `@InvocableVariable` で action と input / output を定義し、Flow Builder 上の見せ方は `*.invocableactionextension-meta.xml` で調整します。

入力順を制御する場合は、一部の parameter だけに `Order` を定義せず、対象 action の全 input parameter に order を定義します。

## API 64.0 / Summer '25

主な追加点は Agentforce 向け managed Apex 設計と、Apex Reference Guide の汎用 API 追加です。

| 項目                                                                    | 概要                                                                                         |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Design Managed Apex for Agentforce                                      | managed package で Apex agent action を配布するための設計ガイド。                            |
| Global Apex best practices                                              | `global` API の公開後に変更しにくい制約を前提に、薄い entry point と内部実装への委譲を推奨。 |
| `System.QueueableDuplicateSignature.Builder`                            | Queueable job の duplicate signature を構築するための builder。                              |
| `Crypto.encryptWithManagedIV(...)` / `decryptWithManagedIV(...)`        | additional authenticated data を扱う overload が追加。                                       |
| `JSON.serialize(..., suppressApexObjectNulls)` / `serializePretty(...)` | Apex object の null suppression を指定する serialize overload。                              |
| `System.Label.get(namespace, label, language)`                          | namespace、label、language を指定して custom label を取得する。                              |

Agentforce 用の managed Apex では、Agentforce から直接呼ばれる entry point に `global` が必要です。対象は `@InvocableMethod` を持つ class、input / output wrapper、`@InvocableVariable`、wrapper 内で使う custom data type です。

ただし、`global` API は管理パッケージ公開後に変更しにくいため、実処理は `public` class に委譲し、`global` entry point は薄く保ちます。

## API 63.0 / Spring '25

主な追加点は Formula Evaluation in Apex です。

| 項目                                                   | 概要                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Formula Evaluation in Apex                             | formula field value の再計算 DML を減らし、dynamic formula expression を Apex から評価する。 |
| `FormulaEval` namespace                                | `FormulaBuilder` / `FormulaInstance` などで formula を構築、評価する。                       |
| `System.pauseJobById(...)` / `resumeJobById(...)` など | scheduled job の一時停止と再開を Apex から扱う。                                             |
| `System.Cookie` HttpOnly support                       | Cookie constructor と `isHttpOnly()` で HttpOnly 属性を扱う。                                |

Formula Evaluation in Apex は、SObject と Apex object を context object として扱えます。Apex class を context type に使う場合は、対象 class と formula が参照する fields / properties / methods が `global` である必要があります。

formula field が database round-trip を必要とする場合は、`Formula.recalculateFormulas()` を使う前提で確認します。

## API 62.0 / Winter '25

主な追加点は external object 向け SOQL mock と、Salesforce Connect / deploy 手順トピックの拡充です。

| 項目                                                        | 概要                                                                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Mock SOQL Tests for External Objects                        | external object に対する basic / joined SOQL query を Apex test で mock できる。                                  |
| `System.SoqlStubProvider`                                   | SOQL stub provider を実装し、`handleSoqlQuery()` で stubbed records を返す。                                      |
| `Test.createSoqlStub(...)`                                  | test 内で対象 sObject type に SOQL stub provider を登録する。                                                     |
| `Test.createStubQueryRow(...)` / `createStubQueryRows(...)` | external object records や DMO records の stub row を作る。                                                       |
| Lead convert API additions                                  | `Database.LeadConvert` で Account / Contact / Opportunity record や dedupe bypass を扱う getter / setter が追加。 |

SOQL stub provider の実装内では、SOQL、SOSL、callout、future、queueable、batch、DML、platform event などは使えません。stubbed records にも Apex governor limits が適用されます。

## API 61.0 / Summer '24

主な追加点は Apex Cursors と Data Cloud in Apex です。

| 項目                                                  | 概要                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Apex Cursors (Beta)                                   | 大きな SOQL 結果を一括返却せず、分割して処理する。                                  |
| `Database.Cursor`                                     | `fetch(position, count)` と `getNumRecords()` で cursor result を扱う。             |
| `Database.getCursor(...)` / `getCursorWithBinds(...)` | SOQL query から cursor を作成する。                                                 |
| `Limits.getApexCursorRows()` など                     | Apex cursor の行数や fetch call の使用量、上限を確認する。                          |
| Data Cloud in Apex                                    | Data Cloud DMO に対して static SOQL を使える。                                      |
| Mock SOQL Tests for DMOs                              | DMO query を `System.SoqlStubProvider` と `Test.createSoqlStub(...)` で mock する。 |

Apex Cursors は Beta です。high-volume / high-resource の処理で、chained Queueable Apex と組み合わせると Batch Apex の代替になる場面があります。cursor は stateless なので、処理側で offset / position を管理します。

Data Cloud DMO への SOQL は Data Cloud 使用量に影響する可能性があります。FOR loop、QueryLocator、再帰など、複数 query を誘発する構造ではコストと制限を先に確認します。DMO の security check は object-level access が中心で、field-level security や record-level access control には制約があります。

## API 60.0 / Spring '24

主な追加点は Null Coalescing Operator、ZIP / Compression、OAuth token exchange handler です。

| 項目                                               | 概要                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Null Coalescing Operator `??`                      | 左辺が null でなければ左辺、null なら右辺を返す。                                          |
| ZIP Support (Developer Preview)                    | `Compression` namespace で ZIP archive を作成、抽出する。                                  |
| `Compression.ZipReader` / `ZipWriter` / `ZipEntry` | ZIP 読み取り、作成、entry 操作を扱う。                                                     |
| `Auth.Oauth2TokenExchangeHandler`                  | OAuth 2.0 token exchange flow で incoming token validation と subject mapping を実装する。 |
| `FormulaEval` namespace (Developer Preview)        | Apex から dynamic formula を評価するための namespace が追加された。                        |

`??` は `?.` と同じく null check を短くできます。左辺は一度だけ評価され、右辺は左辺が null の場合だけ評価されます。operator precedence に注意し、複雑な式では括弧を使います。SOQL bind expression では `??` を使えません。

ZIP Support と FormulaEval は Developer Preview として追加されています。production 前提の設計に入れる場合は、対象 org と現行 API version の公式状態を再確認します。

## API 59.0 / Winter '24

主な追加点は duplicate Queueable job の検出と、collection sorting の柔軟化です。

| 項目                                   | 概要                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------- |
| Detecting Duplicate Queueable Jobs     | 同じ signature を持つ Queueable job を重複 enqueue しないようにする。       |
| `QueueableDuplicateSignature`          | Queueable job の重複判定用 signature を表す。                               |
| `QueueableDuplicateSignature.Builder`  | `addString(...)`、`addId(...)`、`addInteger(...)` で signature を構築する。 |
| `AsyncOptions.DuplicateSignature`      | `System.enqueueJob(queueable, asyncOptions)` に渡す重複判定 signature。     |
| `Comparator<T>`                        | `List.sort(comparator)` に渡して、型ごとに複数の sort order を実装する。    |
| `Collator`                             | locale-aware な文字列比較を行う。                                           |
| `AccessLevel.withPermissionSetId(...)` | permission set context を指定する Developer Preview API。                   |

duplicate Queueable は、resource contention や race condition を避けるための仕組みです。同じ signature の job を追加しようとすると `DuplicateMessageException` が発生します。

`Comparator<T>` の `compare()` 実装では null 入力を明示的に扱います。null を考慮しない比較は inconsistent sorting や null pointer exception の原因になります。

## API 58.0 / Summer '23

主な追加点は Queueable Apex の実行制御、Platform Event publish callback、custom label access です。

| 項目                                         | 概要                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `AsyncOptions`                               | Queueable transaction の maximum stack depth と minimum delay を `System.enqueueJob()` に渡す。 |
| `AsyncInfo`                                  | 現在の queueable stack depth、maximum stack depth、minimum delay などを取得する。               |
| `System.enqueueJob(queueable, asyncOptions)` | Queueable job を option 付きで enqueue する。                                                   |
| `EventBus.EventPublishSuccessCallback`       | Platform Event の asynchronous publish 成功結果を受け取る。                                     |
| `EventBus.EventPublishFailureCallback`       | Platform Event の asynchronous publish 失敗結果を受け取る。                                     |
| `System.Label`                               | Apex から custom label と translation existence を扱う。                                        |

`AsyncOptions` と `AsyncInfo` は chained Queueable の深さや遅延を明示的に扱うための API です。Queueable chain を設計するときは、処理の分割単位、再実行、重複 enqueue の扱いを合わせて確認します。

Platform Event publish callback は、`EventBus.publish` の最終結果を asynchronous に確認するために使います。publish request の受付成功と、event message の最終 publish 成功は分けて扱います。

## API 57.0 / Spring '23

主な追加点は dynamic SOQL の bind map 対応と Queueable delay です。

| 項目                                     | 概要                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `Database.queryWithBinds(...)`           | dynamic SOQL の bind variables を Apex 変数ではなく `Map` から解決する。 |
| `Database.countQueryWithBinds(...)`      | count query で bind map と `AccessLevel` を指定する。                    |
| `Database.getQueryLocatorWithBinds(...)` | query locator で bind map と `AccessLevel` を指定する。                  |
| `System.enqueueJob(queueable, delay)`    | Queueable job の delay を分単位で指定する。                              |
| `System.EmailMessages`                   | email threading token や record id extraction を扱う。                   |

bind map 付き dynamic SOQL は、query string と bind values を分けて扱いやすくします。任意文字列から query を組み立てる場合でも、object / field / order by など bind できない構造要素は許可リストや describe で制限します。

`AccessLevel.USER_MODE` を指定できる overload では、object permissions、field-level security、sharing rules の適用を明示できます。system mode が default である点を前提に、呼び出し側の意図を確認します。

## API 56.0 / Winter '23

主な追加点は DataWeave in Apex、`System.Assert`、Named Credentials ConnectApi、user-mode DML 周辺です。

| 項目                                    | 概要                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| DataWeave in Apex (Developer Preview)   | DataWeave scripts を metadata として作成し、Apex から直接実行する。                               |
| `DataWeave.Script` / `DataWeave.Result` | DataWeave script の作成、実行、結果取得を扱う。                                                   |
| `System.Assert`                         | `Assert.areEqual`、`Assert.isTrue`、`Assert.fail` など、テスト用 assert method をまとめた class。 |
| `ConnectApi.NamedCredentials`           | Named Credential / External Credential を Apex ConnectApi から扱う。                              |
| `Invocable.Action`                      | Apex から standard / custom invocable action を作成、実行する。                                   |
| `Database.*(..., AccessLevel)`          | database operation を user mode / system mode で実行する overload が追加された。                  |

DataWeave in Apex は Developer Preview として追加されています。CSV、JSON、XML、Apex object 間の変換を扱いやすくしますが、Apex と同じ heap / CPU limit の中で実行されます。

`System.Assert` はテスト内の assertion を読みやすくするための class です。assertion failure は catch できない fatal error として扱われます。

## API 55.0 / Summer '22

主な追加点は user-mode database operations と `AccessLevel` です。

| 項目                                       | 概要                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Enforce User Mode for Database Operations  | database operation を default の system mode ではなく user mode で実行する Beta 機能。 |
| `AccessLevel`                              | `SYSTEM_MODE` / `USER_MODE` を表す class。                                             |
| `Database.*(..., AccessLevel)`             | `query`、DML、`convertLead` などに access level を指定する overload。                  |
| `Search.*(..., AccessLevel)`               | SOSL / search operation に access level を指定する overload。                          |
| SOQL `WITH USER_MODE` / `WITH SYSTEM_MODE` | static SOQL で user mode / system mode を明示する構文。                                |
| `insert as user` など                      | DML statement で user mode / system mode を指定する構文。                              |

user mode では、実行ユーザーの object permissions、field-level security、sharing rules が適用されます。system mode が Apex の default であるため、権限を尊重すべき controller / invocable / integration entry point では user mode を明示できるか確認します。

API 55.0 時点では Beta として説明されています。現行 API での GA 状態や構文差分は、実装前に最新の公式ドキュメントで確認します。

## API 54.0 / Spring '22

主な追加点は Permission Set Group testing と domain 情報取得 API です。

| 項目                                     | 概要                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Permission Set Group testing             | permission set group の aggregate permissions を Apex test 内で明示的に計算する手順。         |
| `Test.calculatePermissionSetGroup(...)`  | 指定した permission set group の権限計算を即時実行する。                                      |
| `System.Domain`                          | Salesforce が host する org / content domain の domain type、My Domain、sandbox name を扱う。 |
| `System.DomainCreator` / `DomainParser`  | Salesforce-hosted domain の hostname 作成や parsing を扱う。                                  |
| `System.Network.createExternalUserAsync` | external user 作成を async に扱う Network API。                                               |

`Test.calculatePermissionSetGroup(...)` は CPU limit に影響するため、複雑な test setup では呼び出し回数を抑えます。Permission Set Group を前提にする test は、権限計算のタイミングを明示しないと期待した permissions で検証できない場合があります。

`System.Domain` 系 API は、Salesforce が host する domain 情報の取得用です。任意の外部 domain 生成や汎用 URL parser として扱わないようにします。

## API 53.0 / Winter '22

主な追加点は describe / package license / Functions test 周辺の小幅な API 追加です。

| 項目                                                               | 概要                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `Schema.DescribeSObjectResult.getAssociateEntityType()`            | 関連付けられた entity type を describe から取得する。                    |
| `Schema.DescribeSObjectResult.getAssociateParentEntity()`          | 関連付けられた parent entity を describe から取得する。                  |
| `UserInfo.hasPackageLicense(packageId)`                            | 実行ユーザーが指定 package license を持つか判定する。                    |
| `Functions.MockFunctionInvocationFactory.createErrorResponse(...)` | Salesforce Functions invocation の error response を test 用に作成する。 |
| `System.LoggingLevel`                                              | logging level を表す enum。                                              |

API 53.0 は汎用 Apex 構文の大きな追加より、describe 情報や周辺 product API の増分が中心です。metadata-driven な処理では、新しい describe property を使う前に対象 object type で null / unsupported になる可能性を確認します。

## API 52.0 / Summer '21

主な追加点は Transaction Finalizers の整理と Apex Reference Guide の分離です。

| 項目                                  | 概要                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| Transaction Finalizers error messages | `System.attachFinalizer(...)` の misuse や runtime failure を debug log から判断する。 |
| Apex Reference Guide                  | Apex class / method reference が Developer Guide から独立した guide として扱われる。   |

Transaction Finalizers の error messages では、同じ Queueable job に複数 finalizer を attach した場合、`System.Finalizer` を実装していない class を渡した場合、Queueable 以外の context で attach した場合などが整理されています。

API 52.0 以降の差分確認では、Developer Guide だけでなく Apex Reference Guide も比較します。

## API 51.0 / Spring '21

主な追加点は invocable action の callout 明示と custom metadata static access です。

| 項目                                    | 概要                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Invocable action callout modifier       | screen flow から呼ばれる `@InvocableMethod` が callout することを明示する。          |
| `@InvocableMethod(callout=true)`        | Flow が transaction 内で安全に実行できるか判断できるようにする。                     |
| Custom Metadata Type `getAll()`         | custom metadata records を SOQL なしで map として取得する。                          |
| Custom Metadata Type `getInstance(...)` | record id、developer name、qualified API name で custom metadata record を取得する。 |
| Lead convert related person account API | `Database.LeadConvert` / `LeadConvertResult` で related person account を扱う。      |

Flow から実行される invocable action が外部 callout を行う場合、callout の有無を annotation に表現します。Flow 側の transaction 制御に関わるため、単に Apex 内で HTTP callout が通るかだけで判断しません。

Custom Metadata Type の static access は SOQL rows を消費しない読み取りに使えます。大量設定値の lookup では便利ですが、runtime に存在しない metadata record を前提にしないよう null handling を明示します。

## API 50.0 / Winter '21

主な追加点は Safe Navigation Operator と Transaction Finalizers です。

| 項目                                           | 概要                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Safe Navigation Operator `?.`                  | 左辺が null の場合に右辺を評価せず null を返し、`NullPointerException` を避ける。    |
| Transaction Finalizers (Pilot)                 | Queueable Apex に `System.Finalizer` を attach し、成功 / 失敗後の処理を実行する。   |
| `System.Finalizer` / `FinalizerContext`        | finalizer の実装と、parent Queueable job の結果、例外、request id などの取得を扱う。 |
| `System.Request` / `System.Quiddity`           | 現在の request id と Apex execution type を取得する。                                |
| `SObject.hasErrors()` / `getErrors()`          | DML 前の SObject に付与された errors を確認する。                                    |
| `SObject.addError(fieldName, ...)` など        | field name / field token を指定して SObject field に error を追加する overload。     |
| `Type.isAssignableFrom(...)`                   | 型互換を判定する。                                                                   |
| `JSON.serialize(..., suppressApexObjectNulls)` | Apex object の null suppression を指定する serialize overload。                      |

`?.` は method / property chaining、SObject relationship、single-row SOQL などで null check を短くできます。一方、static expression、代入式、SOQL bind expression、SObject scalar field の `addError()` などには使えません。

Transaction Finalizers は API 50.0 時点では Pilot です。scratch org で feature enablement が必要で、production org では使用できない前提として扱います。finalizer 内では callout が許可されますが、1 つの Queueable job に attach できる finalizer は 1 つだけです。

## バージョン間の見方

API 50.0-67.0 は、Apex 言語構文そのものの大きな追加よりも、次の方向の強化が中心です。

- `?.`、`??`、FormulaEval、Compression、cursor などの Apex runtime / language-adjacent API。
- DataWeave、dynamic SOQL binds、user-mode database operations などの integration / security aware API。
- Transaction Finalizers、Queueable delay、stack depth、duplicate signature などの async execution control。
- Agentforce と Apex invocable action の設計指針。
- managed package の `global` API と backward compatibility。
- ApexDoc による Apex codebase の説明可能性。
- Flow Builder 上の invocable action 表示制御。
- cursor pagination など、大量データ取得に関係する Apex API。
- Data Cloud、External Objects、Commerce、Messaging、ConnectApi など製品固有 namespace の拡充。

API version を上げる場合は、`sourceApiVersion` と各 metadata の `<apiVersion>` を揃えるだけでなく、新 version での compile / validate / Apex test によって既存挙動を確認します。

## 公式参照

- [Apex Developer Guide API 67.0](https://developer.salesforce.com/docs/atlas.en-us.262.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 66.0](https://developer.salesforce.com/docs/atlas.en-us.260.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 65.0](https://developer.salesforce.com/docs/atlas.en-us.258.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 64.0](https://developer.salesforce.com/docs/atlas.en-us.256.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 63.0](https://developer.salesforce.com/docs/atlas.en-us.254.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 62.0](https://developer.salesforce.com/docs/atlas.en-us.252.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 61.0](https://developer.salesforce.com/docs/atlas.en-us.250.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 60.0](https://developer.salesforce.com/docs/atlas.en-us.248.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 59.0](https://developer.salesforce.com/docs/atlas.en-us.246.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 58.0](https://developer.salesforce.com/docs/atlas.en-us.244.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 57.0](https://developer.salesforce.com/docs/atlas.en-us.242.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 56.0](https://developer.salesforce.com/docs/atlas.en-us.240.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 55.0](https://developer.salesforce.com/docs/atlas.en-us.238.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 54.0](https://developer.salesforce.com/docs/atlas.en-us.236.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 53.0](https://developer.salesforce.com/docs/atlas.en-us.234.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 52.0](https://developer.salesforce.com/docs/atlas.en-us.232.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 51.0](https://developer.salesforce.com/docs/atlas.en-us.230.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Developer Guide API 50.0](https://developer.salesforce.com/docs/atlas.en-us.228.0.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Apex Reference Guide API 66.0](https://developer.salesforce.com/docs/atlas.en-us.260.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 65.0](https://developer.salesforce.com/docs/atlas.en-us.258.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 64.0](https://developer.salesforce.com/docs/atlas.en-us.256.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 63.0](https://developer.salesforce.com/docs/atlas.en-us.254.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 62.0](https://developer.salesforce.com/docs/atlas.en-us.252.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 61.0](https://developer.salesforce.com/docs/atlas.en-us.250.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 60.0](https://developer.salesforce.com/docs/atlas.en-us.248.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 59.0](https://developer.salesforce.com/docs/atlas.en-us.246.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 58.0](https://developer.salesforce.com/docs/atlas.en-us.244.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 57.0](https://developer.salesforce.com/docs/atlas.en-us.242.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 56.0](https://developer.salesforce.com/docs/atlas.en-us.240.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 55.0](https://developer.salesforce.com/docs/atlas.en-us.238.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 54.0](https://developer.salesforce.com/docs/atlas.en-us.236.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 53.0](https://developer.salesforce.com/docs/atlas.en-us.234.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 52.0](https://developer.salesforce.com/docs/atlas.en-us.232.0.apexref.meta/apexref/apex_ref_guide.htm)
