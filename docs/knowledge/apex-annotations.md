# Apex アノテーション

Apex アノテーションは、クラス、メソッド、変数などに追加の意味を与えるための記法です。

単なるコメントではなく、Salesforce 実行基盤、Lightning、Flow、テスト、静的解析などの挙動に影響します。

## Lightning / UI 連携

| アノテーション                 | 主な用途                                                               |
| ------------------------------ | ---------------------------------------------------------------------- |
| `@AuraEnabled`                 | LWC / Aura から Apex メソッドや DTO プロパティを参照できるようにする。 |
| `@AuraEnabled(cacheable=true)` | LWC の `@wire` などで使う読み取り専用メソッドをキャッシュ可能にする。  |
| `@RemoteAction`                | Visualforce JavaScript Remoting から static メソッドを呼び出す。       |

`@AuraEnabled(cacheable=true)` は読み取り専用処理にだけ使います。DML や状態変更を含む処理には付けません。

## Flow / 外部呼び出し

| アノテーション                                                       | 主な用途                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `@InvocableMethod`                                                   | Flow、Process Builder などから Apex メソッドをアクションとして呼ぶ。    |
| `@InvocableVariable`                                                 | `@InvocableMethod` の request / response DTO の項目を Flow に公開する。 |
| `@RestResource`                                                      | Apex クラスをカスタム REST API として公開する。                         |
| `@HttpGet` / `@HttpPost` / `@HttpPatch` / `@HttpPut` / `@HttpDelete` | REST resource の HTTP メソッドを定義する。                              |

`@InvocableMethod` は static メソッドに付け、引数や戻り値の形にも制約があります。Flow から使う前提なので、表示名や説明が分かるようにします。

## テスト

| アノテーション | 主な用途                                                       |
| -------------- | -------------------------------------------------------------- |
| `@IsTest`      | テストクラスまたはテストメソッドを定義する。                   |
| `@TestSetup`   | 同じテストクラス内の各テストで使う共通データを作成する。       |
| `@TestVisible` | private / protected メンバーをテストから参照できるようにする。 |

`@TestVisible` は、テストのためだけに本番 API を広げないための手段です。ただし多用すると内部実装に強く依存したテストになりやすいので、公開 API 経由で確認できる場合はそちらを優先します。

## 非同期 / 実行制御

| アノテーション | 主な用途                                                          |
| -------------- | ----------------------------------------------------------------- |
| `@Future`      | メソッドを非同期実行する。                                        |
| `@ReadOnly`    | Visualforce controller などで読み取り専用トランザクションにする。 |
| `@Deprecated`  | クラスやメソッドが非推奨であることを示す。                        |

新規実装では、`@Future` より Queueable Apex を優先します。Queueable は job ID、チェーン、複雑な引数、Finalizer などを扱いやすいためです。

## JSON / パッケージ

| アノテーション         | 主な用途                                                                |
| ---------------------- | ----------------------------------------------------------------------- |
| `@JsonAccess`          | JSON serialize / deserialize 時に private / protected メンバーを扱う。  |
| `@NamespaceAccessible` | 同じ namespace 内の別パッケージからメンバーへアクセスできるようにする。 |

これらは必要な場面が限定されます。DTO や managed package の境界を扱うときに検討します。

## 静的解析

| アノテーション      | 主な用途                                         |
| ------------------- | ------------------------------------------------ |
| `@SuppressWarnings` | PMD などの静的解析警告を、対象を絞って抑止する。 |

`@SuppressWarnings` は、警告を無視するためではなく、警告の内容を確認したうえで静的解析の限界だと説明できる場合だけ使います。

dynamic SOQL で使う場合は、任意文字列をそのまま入れず、許可リスト、describe、必要に応じた escape で入力を制限します。そのうえで PMD が警告を出す場合だけ、対象を狭く抑止します。

```apex
@SuppressWarnings('PMD.ApexSOQLInjection')
private Integer countRecords(String objectApiName) {
    // implementation
}
```

クラス全体やファイル全体に広く付けると、後から追加された本物の問題も隠れるため避けます。

## 判断基準

- フレームワーク要件で必要な static / annotation なのかを確認する。
- UI / Flow / API に公開する範囲を最小にする。
- テスト用アノテーションで本番 API の設計を歪めない。
- `@SuppressWarnings` は最後の手段にし、まずは実装で警告を解消できないか確認する。

Apex アノテーションは便利ですが、公開範囲や実行方式を変えます。付ける理由がコードの役割と一致しているかを確認して使います。
