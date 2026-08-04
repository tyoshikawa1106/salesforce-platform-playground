# Apex SOQL for ループと List 取得の使い分け

Apex では、SOQL の結果を List へすべて格納してから通常の `for` ループで処理する方法と、SOQL for ループで結果を内部的に分割しながら処理する方法があります。

どちらも、ループの各周回で新しい SOQL を発行する書き方ではありません。違いは、検索結果を一度にメモリへ保持するか、内部的に分割して処理するかです。

## SOQL for ループ

List をループ変数にすると、Salesforce が検索結果を最大 200 件のまとまりに分けて処理します。

```apex
// 全件保持による heap size 超過を避けて取引先を分割処理
for (List<Account> accountBatch : [
    SELECT Id, Name
    FROM Account
]) {
    // 分割取得した取引先へ同じ業務処理を適用
    processAccounts(accountBatch);
}
```

450 件を取得する場合、ループ本体はおおむね 200 件、200 件、50 件の 3 回に分かれます。検索結果全体を同時に保持しないため、大量取得時の heap 使用量を抑えられます。

SOQL for ループは、SOQL query 回数や取得行数のガバナ制限を回避しません。1 件の SOQL query として数えられ、取得した全行が SOQL query rows へ加算されます。

## List 取得後の通常ループ

```apex
// 後続処理で再利用する取引先を一括取得
List<Account> accounts = [
    SELECT Id, Name
    FROM Account
];

// 取得済みの取引先を1件ずつ処理
for (Account accountRecord : accounts) {
    // 取引先単位の業務処理を適用
    processAccount(accountRecord);
}
```

この方法は、検索結果全体を List へ格納してから1件ずつ処理します。結果を複数の後続処理で再利用しやすい一方、件数や取得項目が多いほど heap 使用量が増えます。

## 挙動の違い

| 観点            | SOQL for ループ           | List 取得後の通常ループ |
| --------------- | ------------------------- | ----------------------- |
| SOQL query      | 1回                       | 1回                     |
| SOQL query rows | 取得した全行              | 取得した全行            |
| 結果の保持      | 内部的に最大200件ずつ処理 | 全件をListへ格納        |
| ループ本体      | List形式では取得単位ごと  | 1レコードごと           |
| heap使用量      | 抑えやすい                | 結果全体の影響を受ける  |
| 全結果の再利用  | 不向き                    | 向いている              |

SOQL for ループには、SObject をループ変数にして1件ずつ処理する形式もあります。この形式も内部的には結果を分割取得しますが、ループ本体はレコードごとに実行されます。

```apex
// 内部分割された検索結果を1件ずつ処理
for (Account accountRecord : [
    SELECT Id, Name
    FROM Account
]) {
    // 分割取得した取引先を1件ずつ処理
    processAccount(accountRecord);
}
```

## ループ内でSOQLを発行する処理との違い

次の書き方はSOQL forループではありません。外側のループを繰り返すたびにSOQLを発行するため、SOQL query数のガバナ制限へ到達しやすくなります。

```apex
for (Id accountId : accountIds) {
    List<Contact> contacts = [
        SELECT Id
        FROM Contact
        WHERE AccountId = :accountId
    ];
}
```

必要なIDをSetへまとめ、ループの外で1回のSOQLに渡すのが基本です。

## 選択基準

通常は、SOQL結果をListへ取得し、クエリと後続処理を分離します。

SOQL forループは、次の条件をすべて満たす場合に検討します。

- 同じtransaction内で大量の検索結果を順次処理する必要がある。
- Listへの全件取得ではApex heap sizeの超過が見込まれる。
- `Database.Cursor`または`Database.PaginationCursor`を利用できない。
- SOQL forループを使う理由をコードコメントで説明できる。

SOQL forループではクエリと分割処理を完全には分離できません。通常のSelectorへ置かず、専用の大量処理クラスでクエリと分割処理を調整し、例外とする理由と責務をApexDocへ記載します。

transactionを分割できる大量バックエンド処理では、[Apex Cursorsの設計と使い分け](apex-cursors.md)を確認し、`Database.Cursor`とQueueable Apex、またはBatch Apexを優先して検討します。画面のページ送りには`Database.PaginationCursor`を検討します。

## Salesforce公式資料

- [SOQL for Loops](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/langCon_apex_loops_for_SOQL.htm) — Apex Developer Guide
- [Working with Salesforce Records Using SOQL and DML](https://developer.salesforce.com/blogs/2022/08/working-with-salesforce-records-using-soql-and-dml) — Salesforce Developers Blog
- [Execution Governors and Limits](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm) — Apex Developer Guide
- [Apex Cursors](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_cursors.htm) — Apex Developer Guide
