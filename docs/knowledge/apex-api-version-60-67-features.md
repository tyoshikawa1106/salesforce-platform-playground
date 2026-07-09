# Apex API version 60.0-67.0 の主要追加点

Apex の seasonal release 差分を確認するときは、Apex Developer Guide と Apex Reference Guide の対象 API version を比較します。

このメモは API version 60.0 から 67.0 までで、Apex 開発時に確認しやすい主要追加点をまとめます。製品固有 namespace の細かい追加は多いため、汎用 Apex、Agentforce、Flow、managed package、Data Cloud / Commerce 連携に関係する項目を優先します。

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
| `Type.isAssignableFrom(...)`                                            | 型互換を判定する。                                                                           |

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

## バージョン間の見方

API 60.0-67.0 は、Apex 言語構文そのものの大きな追加よりも、次の方向の強化が中心です。

- `??`、FormulaEval、Compression、cursor などの Apex runtime / language-adjacent API。
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
- [Apex Reference Guide API 66.0](https://developer.salesforce.com/docs/atlas.en-us.260.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 65.0](https://developer.salesforce.com/docs/atlas.en-us.258.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 64.0](https://developer.salesforce.com/docs/atlas.en-us.256.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 63.0](https://developer.salesforce.com/docs/atlas.en-us.254.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 62.0](https://developer.salesforce.com/docs/atlas.en-us.252.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 61.0](https://developer.salesforce.com/docs/atlas.en-us.250.0.apexref.meta/apexref/apex_ref_guide.htm)
- [Apex Reference Guide API 60.0](https://developer.salesforce.com/docs/atlas.en-us.248.0.apexref.meta/apexref/apex_ref_guide.htm)
