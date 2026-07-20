# Apex Cursors の設計と使い分け

Apex Cursors は、大きな SOQL 結果を一度にメモリへ展開せず、必要な範囲だけを取得するための API です。
API version 66.0（Spring '26）で一般提供され、バックエンド処理向けの `Database.Cursor` と、UI のページ送り向けの
`Database.PaginationCursor` を使い分けます。

Cursor はガバナ制限を回避する仕組みではありません。Cursor 作成時に実行する SOQL と、`fetch()` や `fetchPage()` の呼び出しは
SOQL query 回数へ、取得した行は SOQL query row 数へ加算されます。Cursor を選ぶときは、取得方法だけでなく、transaction の分割、
状態管理、失敗時の復旧まで設計します。

## 2 種類の Cursor

| 観点               | `Database.Cursor`                       | `Database.PaginationCursor`                                 |
| ------------------ | --------------------------------------- | ----------------------------------------------------------- |
| 主な用途           | バックエンドの大量データ分割処理        | LWC などの画面一覧とページ送り                              |
| 最大結果件数       | 5,000 万件                              | 10 万件                                                     |
| 取得方法           | `fetch(position, count)`                | `fetchPage(start, pageSize)`                                |
| 1 回の最大取得件数 | transaction のガバナ制限内で設計        | 2,000 件                                                    |
| 状態               | Cursor と次の `position` を処理側で管理 | `CursorFetchResult` の次 index を画面側の状態と合わせて管理 |
| 代表的な組み合わせ | chained Queueable Apex                  | `@AuraEnabled` Apex と LWC / Aura                           |

### `Database.Cursor`

`Database.getCursor()` または `Database.getCursorWithBinds()` で作成し、`fetch(position, count)` で任意の位置から取得します。
`getNumRecords()` で結果件数を確認できます。

Cursor 作成時に結果となるレコード ID の集合が固定されます。作成後にレコードが検索条件から外れたり、共有ルールが変わったりしても、
結果の ID 集合は変わりません。一方、取得時点で削除済みのレコードや、利用者から参照できなくなったデータをどう扱うかは実装で確認が必要です。

1 transaction で呼び出せる `Cursor.fetch()` は最大 100 回です。通常は 1 回の Queueable で必要な chunk だけを取得し、
残りを次の Queueable へ渡します。

組織全体では、標準 Cursor は 24 時間あたり 10,000 インスタンスまでです。標準 Cursor と PaginationCursor が新しく保持する行数は、
合計で 24 時間あたり 1 億行までです。個々の transaction が成功しても、連鎖全体では日次上限へ到達し得るため監視します。

### `Database.PaginationCursor`

`Database.getPaginationCursor()` または `Database.getPaginationCursorWithBinds()` で作成します。
`fetchPage(start, pageSize)` は、Cursor 作成後に削除された行を既定で飛ばし、可能な範囲で指定したページ件数を満たします。
戻り値の `Database.CursorFetchResult` からレコードと次の取得 index を受け取ります。
PaginationCursor は `@AuraEnabled` の引数や戻り値としてシリアライズできるため、LWC / Aura と Apex の間でページ状態を引き継げます。

PaginationCursor は人が閲覧する一覧向けです。10 万件を超える可能性がある一覧では、検索条件、`LIMIT`、安定した `ORDER BY`、
絞り込みを促す画面案内を先に設計します。超大量バックエンド処理の代替として使いません。

## Cursor と Queueable Apex

Cursor と Queueable を組み合わせると、処理単位ごとに transaction を分けながら、大きな結果セットを順番に処理できます。

```text
開始処理で Cursor を作成
  ↓
Queueable が position から一定件数を fetch
  ↓
取得したレコードを処理し、進捗と途中結果を保存
  ↓
Cursor と次の position を次の Queueable へ引き継ぐ
  ↓
完了まで Queueable を連鎖
  ↓
最終結果と終了状態を保存
```

次は構造を示す疑似コードです。そのままデプロイする実行可能コードではありません。

```apex
public void execute(QueueableContext context) {
    Integer remaining = cursor.getNumRecords() - position;
    Integer fetchSize = chooseFetchSize(remaining);
    List<SObject> records = cursor.fetch(position, fetchSize);

    process(records);
    position += records.size();
    saveProgress(position, cursor.getNumRecords());

    if (position < cursor.getNumRecords()) {
        System.enqueueJob(this);
    } else {
        saveCompletion();
    }
}
```

取得件数は、次を基準に決めます。

- 1 レコードあたりの CPU と heap の使用量。
- callout の回数、応答サイズ、外部 API の rate limit。
- 後続の DML や automation が使用するガバナ制限。
- 失敗時に安全に再実行できる処理単位。
- transaction 内の残りのガバナ制限。

処理特性が一定なら、固定件数の方が理解しやすく運用も安定します。可変 fetch size は必要な場合だけ使います。

Queueable の連鎖では、実行中の 1 job から enqueue できる子 job は 1 件だけです。各 job は共有の非同期 Apex 実行上限へ加算されます。
Developer Edition と Trial 組織では、初期 job を含む chain の最大深度は既定で 5 です。その他の組織でも無制限に連鎖させず、
残り件数、最大深度、再試行回数などで必ず停止条件を設けます。

## Batch Apex との使い分け

Cursor＋Queueable は Batch Apex を置き換える必須方式ではなく、制御の柔軟性が必要な場合の選択肢です。

| 観点       | Batch Apex                    | Cursor＋Queueable          |
| ---------- | ----------------------------- | -------------------------- |
| 分割実行   | プラットフォームが管理        | Queueable の連鎖を実装     |
| 取得件数   | ジョブ全体で原則固定          | transaction ごとに変更可能 |
| 実行順序   | 定型的な batch scope          | 開発者が順序と段階を設計   |
| 失敗の分離 | batch scope 単位              | Queueable transaction 単位 |
| 進捗と監視 | `AsyncApexJob` を利用しやすい | 独自の実行管理を検討       |
| 終了処理   | `finish()`                    | 完了処理または Finalizer   |
| 再試行     | 標準の batch 実行モデルを利用 | 再試行単位と重複防止を設計 |
| 実装量     | 定型的                        | 柔軟だが管理責務が増える   |

次の場合は Batch Apex を優先します。

- 大量レコードへ同じ処理を繰り返す。
- Salesforce 標準の分割実行、監視、`finish()` を使いたい。
- 固定した batch size で処理できる。
- 独自の連鎖、進捗、再試行を増やしたくない。

次の場合は Cursor＋Queueable を検討します。

- レコードや処理段階により負荷が変わる。
- transaction ごとに取得件数を調整したい。
- 外部 API の rate limit や callout 制限へ合わせたい。
- 検査、変換、更新など異なる処理段階を順番に接続したい。
- Batch Apex の active job や Flex Queue と分けて実行したい。

## Cursor＋Queueable で管理する事項

### 進捗と重複実行

実行管理には、少なくとも次の情報を検討します。

- 実行 ID と、同じ条件の重複起動を判定するキー。
- 状態：待機中、処理中、完了、失敗。
- 再実行可能な検索条件と並び順。
- 次の取得位置、対象総件数、処理済み件数、進捗率。
- 集計結果または変更件数。
- 開始日時、終了日時、最終エラー、再試行回数。

Cursor は Queueable のメンバーとして次の job へ引き継げますが、任意の永続項目へ保存できる前提にはしません。
job chain を越えた再開が必要なら、検索条件、安定した並び順、位置、処理済み判定など、永続化できる情報から復旧する方式を設計します。

### 失敗と再試行

- `System.TransientCursorException` は再試行可能なエラーとして扱い、上限回数と待機方針を決める。
- `System.FatalCursorException` や検索条件の不整合は、同じ job を無条件に再実行しない。
- 処理は可能な範囲で idempotent にし、同じ chunk の再実行で二重更新や二重送信を起こさない。
- 部分成功を許容する場合は、成功、失敗、変更なしを分けて記録する。
- Cursor の無効化や Queueable の連鎖停止に備え、実行管理情報から安全に再開または再実行できるようにする。

Transaction Finalizer は Queueable transaction の終了結果の記録や、限定した再試行の起点に使えます。
全体完了の判定、業務上の補償処理、無制限の再 enqueue を Finalizer へ押し込まず、通常の実行管理と役割を分けます。

## セキュリティと SOQL

画面や利用者起点の処理では、共有、CRUD、FLS を維持します。Cursor を作成しただけでは、アプリケーションが必要とする認可設計は完了しません。

静的な query 文字列では access level を明示します。

```apex
Database.PaginationCursor cursor = Database.getPaginationCursor(
    query,
    AccessLevel.USER_MODE
);
```

bind map を使う場合は、専用の WithBinds メソッドを使います。

```apex
Database.PaginationCursor cursor = Database.getPaginationCursorWithBinds(
    query,
    bindMap,
    AccessLevel.USER_MODE
);
```

`Database.Cursor` でも同様に `getCursor()` と `getCursorWithBinds()` を区別します。
object 名、field 名、`ORDER BY` など bind できない構造要素は、任意文字列を連結せず、許可リストまたは describe で制限します。

## PaginationCursor の制限とページ判定

- 結果セットは 1 PaginationCursor あたり最大 100,000 件。
- `fetchPage(start, pageSize)` の `pageSize` は最大 2,000 件。
- 1 transaction あたり最大 50 PaginationCursor インスタンス。
- 1 組織あたり 24 時間で最大 200,000 PaginationCursor インスタンス。
- 上限はオブジェクトの総件数ではなく、Cursor へ渡した SOQL の結果件数へ適用される。
- `fetchPage()` と `fetchDeleted()` は SOQL query 回数へ、取得行は SOQL query row 数へ加算される。

`CursorFetchResult.isDone()` だけで最終ページかどうかを判定しません。公式仕様では、指定ページ件数を取得できた場合と、
結果末尾へ到達して部分ページを取得した場合のどちらでも `true` になり得ます。次ページの有無は、`getNextIndex()` と
`PaginationCursor.getNumRecords()` を合わせて判定します。

```apex
Database.CursorFetchResult page = cursor.fetchPage(start, pageSize);
Integer nextIndex = page.getNextIndex();
Boolean hasNextPage = nextIndex < cursor.getNumRecords();
```

一覧の途中でレコードが追加されても、作成済み Cursor の結果 ID 集合には入りません。最新状態を表示する操作では、検索条件を保ったまま
新しい PaginationCursor を作り直し、先頭ページから取得します。

## 設計例：取引先データ品質スキャン

大量の Account を分割して読み取り、電話番号、業種、住所、Web サイト、取引先番号の不足件数を集計する例です。
この例は設計を説明するもので、サンプル機能の実装ではありません。

```text
LWC からスキャン開始
  ↓
Apex で USER_MODE の Database.Cursor を作成
  ↓
Queueable が Account を分割取得して不足項目を集計
  ↓
実行 ID に進捗と途中結果を保存
  ↓
Cursor と次の position を次の Queueable へ引き継ぐ
  ↓
完了まで連鎖し、最終結果を保存
  ↓
LWC が実行 ID から進捗と結果を表示
```

この処理は読み取り専用なので、再実行時のデータ更新競合はありません。ただし同じ条件のスキャンを重複起動するとリソースを消費するため、
実行中の条件キーを使って重複を防ぎます。対象データが実行中に変化する可能性を利用者へ示し、どの時点の結果 ID 集合を集計したか記録します。

単純な項目有無の確認は 1 レコードあたりの負荷が安定しているため、固定 fetch size が第一候補です。
将来、本文解析や callout など負荷の重い検査を追加する場合だけ、CPU、heap、残り件数に応じた可変件数を検討します。
標準の進捗監視と定型処理を優先するなら、この例でも Batch Apex が有力です。

## 応用例

次の例は実装アイデアです。いずれも Cursor を使えることだけを採用理由にせず、より単純な方式と比較します。

### 取引先データの一括正規化

Account の都道府県、電話番号、Web サイト URL、空白や null の表現を分割して正規化します。
レコードごとの変換負荷に応じて chunk を調整でき、検査、変換、更新を段階化できます。

- 最初に dry-run を用意し、変更予定件数とサンプル差分を確認する。
- 再実行しても結果が変わらない正規化にする。
- USER_MODE の部分成功を扱い、成功、失敗、変更なしを記録する。
- Validation Rule、Flow、Trigger など更新時 automation の負荷を確認する。
- 変換負荷が一定なら Batch Apex と比較する。

### 外部 API による取引先情報の補完

住所からの緯度・経度、公開企業情報、Web サイトの到達状態などを外部 API から取得します。
rate limit や応答時間に応じて処理件数を変え、取得、変換、Salesforce 更新を段階化できます。

- Named Credential と External Credential を使い、`Database.AllowsCallouts` を実装する。
- HTTP 429、5xx、timeout を区別し、再試行可能なエラーだけを指数的バックオフの対象にする。
- callout 成功後に Salesforce 更新が失敗しても、外部送信を重複させない。
- Callout Mock、最大再試行回数、費用、利用規約、個人情報の送信可否を確認する。

### Case メールメッセージの分析

Case に紐づく EmailMessage の受信・送信件数、初回返信時間、未返信候補などを分割集計します。
軽い項目集計と本文解析で処理量が異なる場合に chunk を調整できます。

- `TextBody` と `HtmlBody` は heap と処理時間へ影響し、個人情報や機密情報を含む可能性がある。
- 返信時間、`Incoming`、自動返信、営業時間の扱いを仕様化する。
- 分析開始後に追加されたメールを含めるか決める。
- 全再計算と差分更新のどちらを採用するか決める。

この例はバックエンド分析であり、`Database.PaginationCursor` を使う Case メール一覧の実装例ではありません。

### 大量データの CSV エクスポート準備

レコードを分割取得し、複数の CSV ファイルへ変換して Salesforce Files として提供する準備を行います。
項目数や 1 行のサイズに応じて取得件数を調整できます。

- 全 CSV を 1 つの巨大な `String` へ連結しない。
- Apex heap、`String`、`Blob`、`ContentVersion` の制限を確認する。
- CSV injection、カンマ、改行、ダブルクォート、文字コードを扱う。
- FLS、ファイル分割数、保存期間、削除方法を設計する。
- 大容量の抽出では Bulk API 2.0 や外部 ETL の方が適切か比較する。

## 選択基準

- UI のページ送り：`Database.PaginationCursor`。
- バックエンドの柔軟な分割処理：`Database.Cursor`＋Queueable Apex。
- 標準管理を優先する定型的な大量処理：Batch Apex。
- 大容量のデータ入出力：Bulk API 2.0 や外部 ETL も比較する。
- 5,000 万件を超える、または Apex の実行制限と合わない処理：要件と処理基盤を再検討する。

## Salesforce 公式資料

- [Apex Cursors](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_cursors.htm) — Apex Developer Guide
- [The Salesforce Developer's Guide to the Spring '26 Release](https://developer.salesforce.com/blogs/2026/01/developers-guide-to-the-spring-26-release) — Salesforce Developers Blog
- [Cursor Class](https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_class_Database_Cursor.htm) — Apex Reference Guide
- [PaginationCursor Class](https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_class_Database_PaginationCursor.htm) — Apex Reference Guide
- [CursorFetchResult Class](https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_class_Database_CursorFetchResult.htm) — Apex Reference Guide
- [Database Methods](https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_methods_system_database.htm) — Apex Reference Guide
- [Execution Governors and Limits](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm) — Apex Developer Guide
- [Large Data Processing with Cursors and Queueable Apex Versus Batch Apex](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_cursors_versus_batch.htm) — Apex Developer Guide
- [Queueable Apex](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_queueing_jobs.htm) — Apex Developer Guide
- [Batch Apex](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_batch.htm) — Apex Developer Guide
- [Secure Apex Classes](https://developer.salesforce.com/docs/platform/lwc/guide/apex-security) — Lightning Web Components Developer Guide
