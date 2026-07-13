# Apex 開発ルール

Apex クラス、トリガー、Apex テストを追加・更新するときの実務ルールです。

## 読み方

迷ったときは、次の順で確認します。

1. 実装の形は、[Controller / Service / Selector / Wrapper](#controller--service--selector--wrapper)、[Bulkification と Governor Limits](#bulkification-と-governor-limits)、[Trigger 構成](#trigger-構成) を見る。
2. コメントの書き方は、[ApexDoc](#apexdoc) と [通常コメント](#通常コメント) を見る。
3. テストデータ、`System.runAs`、`Test.startTest()` / `Test.stopTest()` は、[Apex テスト](#apex-テスト) を見る。
4. PR 前の確認は、[PR 前チェック](#pr-前チェック) を見る。

## 基本方針

- Apex と Salesforce メタデータは `force-app/main/default` 配下を基準にする。
- `.cls` を追加・更新する場合は、対応する `-meta.xml` も一緒に扱う。
- 振る舞いを変える前に、関連する Object、Field、Flow、Validation Rule、Permission Set への依存を確認する。
- 組織設定や権限から確認できない仕様を、Apex 側で推測して固定しない。
- 本番組織や接続中の Salesforce 組織に依存する値、認証情報、個人環境の値を Apex やメタデータに入れない。

## クラスとメタデータ

クラス本体は `.cls`、メタデータは `.cls-meta.xml` で管理します。

- `apiVersion` は、既存メタデータとプロジェクトの対象バージョンに合わせる。
- `apiVersion` は、理由なく古いままにしない。変更対象の周辺クラスとプロジェクト標準に合わせ、コードベース内の API バージョンを増やしすぎない。
- `status` は通常 `Active` にする。変更理由がある場合は作業報告に残す。
- 新規 Apex は、役割が分かる名前にする。用途が広すぎる名前は避ける。
- 既存クラスの責務を広げる前に、既存の呼び出し元とテスト影響を確認する。

## メソッド命名

メソッド名は、呼び出し側だけを見ても目的が分かる名前にします。

- `camelCase` を使い、動詞から始める。
- `do`、`exec`、`proc` など、処理内容が分からない動詞だけで始めない。
- `Cnt`、`Num`、`Flg` などの曖昧な略語を避け、`Count`、`Number`、`Flag` のように意味が読める単語を使う。
- 対象 object と処理結果が分かる名前にする。例: `updateAccountCaseCounts`。
- boolean を返すメソッドは `is`、`has`、`can` などで始める。例: `canDeleteAccount`。
- Trigger handler のメソッドは、Trigger context 名だけでなく、委譲する業務処理が分かる名前にする。

## ApexDoc

ApexDoc は、Winter '26 / API 65.0 の Apex Developer Guide で追加された Apex 向けの標準ドキュメントコメント形式です。このリポジトリでは、ApexDoc を Apex の公開契約を説明するコーディング規約として扱います。

ApexDoc は `/** ... */` 形式で書き、対象のクラス、インターフェース、列挙型、メソッド、コンストラクタ、プロパティ、メンバー変数の直前に置きます。Apex コンパイラは ApexDoc のタグや説明内容を検証しないため、実装を変更したら対応する ApexDoc も必ず見直します。

### 必須範囲

- クラス、インターフェース、列挙型には、公開範囲に関係なく ApexDoc を付ける。
- `public` / `global` のメソッドには ApexDoc を付ける。
- 明示的に定義するコンストラクタには、公開範囲に関係なく ApexDoc を付け、通常のブロックコメント `/* ... */` で代替しない。
- LWC、Aura、Flow、REST、Agentforce、パッケージ利用者など外部境界から呼ばれる Apex には、呼び出し側が守るべき契約を明記する。
- 単純な LWC / Aura 用 Wrapper プロパティは、ApexDoc ではなく `//` コメントで表示項目の意味を書く。
- 公開 API の一部になる複雑なプロパティやメンバー変数には ApexDoc を付ける。
- `private` / `protected` のヘルパーでも、複雑な前提、例外、権限境界、拡張ポイントを持つ場合は ApexDoc を付ける。
- テストクラスには、検証対象を短い機能ラベルで書く。テストメソッドは公開 API ドキュメントではなくテスト仕様として必要な範囲で説明し、全メソッドへ機械的に長い ApexDoc を付けない。

### 基本構成

ApexDoc の先頭には、対象要素を一文で要約する主要説明を書きます。最初の文は生成ドキュメントの一覧や索引に使われる前提で、短く具体的に書きます。このリポジトリの日本語 ApexDoc は機能ラベル調にし、文末の `です` / `ます` / `。` を使いません。

主要説明だけで呼び出し方が分かる場合は、補足段落を増やしません。前提条件、事後条件、権限境界、null の扱い、一括処理前提、副作用、関連するメタデータや設定は、呼び出し側の判断に必要な場合だけ書きます。実装を読めば分かる処理手順や内部設計の説明は ApexDoc に書きません。

```apex
/**
 * 指定された顧客リクエストから取引先を作成
 *
 * @param requests 取引先作成リクエスト、各リクエストには空でない名前が必要
 * @return 作成された取引先レコード、requests が空の場合は空のリスト
 * @throws AccountServiceException 検証に失敗した場合、または DML を完了できない場合
 */
public List<Account> createAccounts(List<AccountRequest> requests) {
    // ...
}
```

### タグ

次のタグを必要な範囲で使います。

| タグ             | 用途                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `@param`         | メソッド / コンストラクタの引数を説明する。実引数と同じ名前、同じ順序にする。 |
| `@return`        | 戻り値を説明する。`void` メソッドとコンストラクタには書かない。               |
| `@throws`        | 明示的に throw する重要な例外と、その発生条件を説明する。                     |
| `@example`       | 呼び出し例や拡張例があると誤用を防げる場合に書く。                            |
| `@deprecated`    | 非推奨理由、非推奨になったバージョン、代替手段を書く。                        |
| `@see`           | 関連クラス、メソッド、外部仕様、メタデータへの参照を書く。                    |
| `@since`         | 導入バージョンや日付を書く。パッケージや公開 API では優先して使う。           |
| `@version`       | クラス、インターフェース、列挙型のバージョンを書く。                          |
| `@group`         | 生成ドキュメント上の分類を書く。                                              |
| `{@link ...}`    | 本文中でクラス、メソッド、プロパティなどへリンクする。                        |
| `{@code ...}`    | 本文中や `@example` 内でコードとして表示する。                                |
| `{@literal ...}` | HTML や記号を解釈させず文字として表示する。                                   |
| `{@hidden ...}`  | 生成ドキュメントに出さない保守者向け情報を書く。                              |

`@param` には、型を繰り返すだけでなく引数の役割を書きます。必須/任意、null 可否、空コレクションの扱い、ID 形式、許可値、件数前提は、呼び出し側が誤用しやすい場合だけ加えます。

コンストラクタに引数がある場合も、実引数と同じ名前、同じ順序で `@param` を書きます。引数がないコンストラクタには `@param` を書きません。

`@return` には、戻り値の意味を書きます。null を返すか、空コレクションを返すか、順序が保証されるか、部分成功時に何が入るかは、呼び出し側の分岐に影響する場合だけ加えます。

`@throws` には、例外型だけでなく、どの条件で投げるかを書きます。内部実装で捕捉して利用者に見せない例外をすべて列挙する必要はありません。

`@example` は、呼び出し例があることで誤用を防げる場合だけ書きます。全メソッドへ機械的に付けません。外部境界から呼ばれる公開 API、引数の組み合わせや null / 空コレクションの扱いが分かりにくいメソッド、例外処理や戻り値の扱いを利用者に示したいメソッド、パッケージや `global` API のように利用者が実装を直接読まない可能性があるメソッドでは優先して検討します。単純な getter、factory、Wrapper constructor、private helper、テストコードの代わりになる長すぎる例には付けません。

### 要素別ルール

クラスでは、責務を一文で書きます。共有モデル、主な呼び出し元、副作用は、通常の `with sharing` や名前から明らかな構成を説明するためには書きません。`without sharing` や `inherited sharing` を使う場合など、呼び出し側の理解に影響する場合だけ ApexDoc または近接する設計説明で理由を分かるようにします。

インターフェースでは、実装詳細ではなく契約を書きます。実装クラスが満たすべき期待動作、入力、戻り値、例外、一括処理対応の有無を明確にします。

列挙型では、列挙型全体が表す概念を書きます。各値の意味が名前だけで明らかでない場合は、値の直前に短いコメントを置きます。

メソッドとコンストラクタでは、要約、引数、戻り値、重要な例外を中心に書きます。呼び出し条件、引数制約、副作用、権限境界、SOQL / DML / callout の有無、一括処理前提、部分成功の扱いは、呼び出し側に影響する場合だけ明記します。

単純な LWC / Aura 用 Wrapper プロパティでは、`@AuraEnabled` の直前に `//` コメントで表示項目の意味を書きます。ApexDoc は、利用者が守るべき契約、初期化条件、変更可否などを説明する必要があるプロパティに限ります。

トリガーには、ApexDoc を原則として付けません。トリガー本体はコンテキスト分岐と handler 呼び出しに集中させ、実質的な契約は handler / service クラス側に書きます。

アノテーションが付く要素では、そのアノテーションが利用者に与える意味を書きます。

- `@AuraEnabled(cacheable=true)` では、キャッシュ前提、更新後の再取得要否、読み取り専用であることを書く。
- 単純な `@AuraEnabled` プロパティでは、ApexDoc ではなく直前の `//` コメントで項目の意味を書く。
- `@InvocableMethod` では、Flow Builder から見たアクションの目的、入力 / 出力の構造、表示ラベル / 説明と ApexDoc の説明が矛盾しないことを確認する。
- `@InvocableVariable` では、Flow から渡される値の役割、必須/任意、許可値を書く。
- `@RestResource` と HTTP メソッドアノテーションでは、リソースの役割、リクエスト / レスポンス、ステータスコード、認証/権限前提を書く。
- `@Future` は新規実装で使わない。既存コードで扱う場合は Queueable Apex へ移行できるか確認し、残す必要があるときだけ、非同期トランザクション、callout、ガバナ制限、呼び出し制約、残す理由を書く。
- `@Deprecated` では `@deprecated` タグも併用し、代替手段を書く。
- `@TestVisible` では、テストのために可視性を変えている理由を書く。
- `@SuppressWarnings` では、抑止する警告と抑止理由を書く。

### 避ける書き方

- 実装を読めば分かる処理手順だけを書く。
- すべての項目に null、空コレクション、権限、内部委譲、SOQL / DML の有無を機械的に書く。
- `@param id Id` のように型や名前を繰り返すだけにする。
- 実装変更後に古い例外、古い戻り値、古い制約を残す。
- `@return` を `void` メソッドに書く。
- 実引数に存在しない `@param`、順序が違う `@param` を残す。
- 組織固有のユーザー名、メールアドレス、レコード ID、エンドポイント、秘密情報を例や説明に書く。
- 会話ログ、依頼文、作業中の判断をそのまま ApexDoc に残す。

### 通常コメント

ApexDoc の対象ではないローカル変数、関数呼び出し、単純な LWC / Aura 用 Wrapper プロパティには、必要に応じて `//` コメントを近接して置く。

- コメントは識別子や呼び出し名の言い換えではなく、その行で何を成立させるかを書く。
- ローカル変数には、後続の判定、比較、DML、戻り値作成で何を可能にする値かを短く書く。
- コメントが必要な関数呼び出しでは、呼び出し後に何が可能になるか、またはなぜその順序で呼ぶかを短く書く。
- Handler から Service へ処理を委譲する呼び出しでは、対象業務処理を短い日本語コメントで補う。
- `// accountRecord を準備` や `// normalizeNames を実行` のように、変数名やメソッド名を言い換えるだけのコメントを書かない。
- 複数行の準備、実行、検証を分けるテストでは、読みやすさを保つために短い区切りコメントを使う。
- テストクラスの `System.runAs`、`Test.startTest()`、`Test.stopTest()` にはコメントを付けず、必要に応じて空白行で実行範囲を見やすく区切る。
- テストの assertion / fail メッセージは日本語で書く。API 名、項目名、クラス名などの識別子は必要に応じてそのまま使う。
- コメントは対象行または対象ブロックの直前に置き、コードから離れた場所にまとめない。
- 同じ意図を ApexDoc と通常コメントで重複させない。
- 日本語コメントは ApexDoc と同じく、機能ラベル調にし、文末の `です` / `ます` / `。` を使わない。

## Controller / Service / Selector / Wrapper

画面や LWC から呼び出す Apex は、読みやすさと責務境界を優先して `Controller`、`Service`、`Selector`、`Wrapper` の構成を基本にします。

- `Controller` は公開 API の入口と処理順序の組み立てを担当する。
- `Controller` には、業務判断やデータ加工を目的にした `if` / `for` などのロジックを原則として書かない。
- `Controller` は `Service` と `Selector` を呼び出し、両者のやり取りは引数と戻り値で行う。
- `Service` はビジネスロジック、入力値の正規化、権限や削除可否などの判定、返却用データの組み立てを担当する。
- `Service` から `Selector` を直接呼び出さない。クエリや DML が必要なデータは `Controller` が `Selector` から取得し、`Service` へ引数で渡す。
- `Selector` は describe、SOQL、DML など Salesforce データアクセスに集中する。
- `Wrapper` は LWC や Aura へ返すデータ構造、または画面から受け取る request 構造を表す。
- LWC / Aura との Apex 境界で使う `Wrapper` は、既存の命名と公開範囲に合わせる。可読性や再利用性が下がる場合は、無理に inner class 化しない。
- LWC / Aura 用 `Wrapper` はコンストラクタを明示し、公開プロパティの既定値を初期化する。

この構成は、意味のある責務分離を目的に使います。単純な処理を機械的に細かく分割しすぎないようにし、クラスを増やす場合は、読みやすさ、テストしやすさ、変更影響の小ささを説明できる単位にします。

### Service / Selector の初期化

`Controller` や `Handler` が内部で使う標準の `Service` / `Selector` は、コンストラクタ引数ではなくフィールド宣言時に初期化します。

```apex
private ObjectRecordSearchService service = new ObjectRecordSearchService();
private ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
```

コンストラクタで `Service` / `Selector` を受け取るのは、呼び出し元が実装を選ぶ公開契約、複数実装を切り替える設計、または `@TestVisible` などで明示的な差し替え口を持つ場合に限定します。

### メンバー変数

クラス宣言の直後には空行を入れます。

関連するメンバー変数を続けて宣言する場合は、メンバー変数同士を空行で分けません。

インスタンスのメンバー変数を参照する場合は、原則として `this.` を付けます。`static` 変数、ローカル変数、メソッド引数には `this.` を付けません。

`static final` の定数には、値の種類ではなく後続処理での役割が分かる `//` コメントを直前に置きます。

Map 変数は、役割が明確なら `oldAccountMap` のように `{対象}Map` で簡潔に書きます。`oldAccountsById` のようにキーを名前へ含めるのは、キーが `Id` 以外で誤読されやすい場合に限ります。

### static と instance の使い分け

Salesforce のフレームワーク入口では `static` が必要になることがありますが、下位の処理まで機械的に `static` にしません。

- `@AuraEnabled`、`@InvocableMethod`、`@RemoteAction` など、フレームワークが要求する入口は `static` にする。
- `Controller` の `static` メソッドは薄く保ち、実処理は `Service`、`Selector`、helper へ委譲する。
- `Service` は、既存実装に合わせつつ、状態を持たない場合でも instance 化で差し替えやテストが読みやすくなるなら instance を優先する。
- `static` helper を増やす場合は、フレームワーク要件、純粋関数、既存パターンのどれに当たるかを説明できるようにする。
- `@RemoteAction` などで入口が `static` でも、それを理由に service 層全体を `static` 設計へ寄せない。

## セキュリティと権限

Apex は実行コンテキストによって共有ルール、CRUD、FLS の効き方が変わります。AI エージェントは「動くこと」だけでなく、どの権限境界で動くかを確認します。

- class には原則 `with sharing` を付ける。`without sharing` や `inherited sharing` を使う場合は理由を作業報告に残す。
- UI、Flow、API などユーザー操作から呼ばれる処理では、SOQL に `WITH USER_MODE`、DML statement に `as user`、Database method に `AccessLevel.USER_MODE` を使えるか確認する。
- `as system` や `AccessLevel.SYSTEM_MODE` は、ユーザー権限を超える必要がある処理に限定し、使う理由を作業報告に残す。
- API v67.0 以降では database operation が user mode 前提になり、明示的な sharing 宣言がない class の扱いも変わる。API version によって挙動が変わるため、セキュリティ境界は暗黙のデフォルトに頼らず、class 宣言、SOQL、DML の書き方で明示する。
- API v67.0 以降の Apex SOQL では `WITH SECURITY_ENFORCED` を使わない。CRUD / FLS を考慮する場合は、`WITH USER_MODE`、`AccessLevel.USER_MODE`、`Security.stripInaccessible` など、対象 API バージョンで利用できる手段を使う。
- `forcedotcom/sf-skills` や外部テンプレートに `WITH SECURITY_ENFORCED` の例が含まれていても、対象 API version が v67.0 以降ならこのリポジトリのルールを優先し、`WITH USER_MODE` などに置き換える。
- `without sharing` が必要な処理は、範囲を小さい helper に閉じ込め、入口側で権限や Custom Permission を確認する。
- dynamic SOQL では、オブジェクト名、項目名、並び順、演算子を allowlist または describe で検証する。
- ユーザー向けエラーには内部 ID、SOQL、stack trace、個人情報、秘密情報を含めない。
- UI に返すエラーメッセージは、内部事情や実装用語ではなく、ユーザーが次に取る行動が分かる表現にする。例: 条件を見直す、時間をおいて再試行する、管理者に権限を確認する。
- 外部接続の認証情報や endpoint は Apex に直書きせず、Named Credential や metadata 側の設定を使う。
- 権限や組織設定が不明な場合は、Apex 側で推測して固定せず、確認事項として残す。

## Bulkification と Governor Limits

Apex は一括実行される前提で実装します。1 件の画面操作から呼ばれる処理でも、将来の batch、Flow、trigger、API 呼び出しで複数件になる可能性を考慮します。

- loop 内で SOQL、DML、callout を実行しない。
- `for`、`if`、`return`、コンストラクタ引数、メソッド引数などの式の中に、取得処理や判定用の関数呼び出しを直接書かない。結果を名前付き変数に入れてから使う。
- 単一引数のメソッド呼び出し、コンストラクタ呼び出し、例外生成は、行長や式の複雑さに問題がなければ 1 行で書く。
- 複数引数のメソッド呼び出しも、行長や式の複雑さに問題がなければ 1 行で書く。
- メソッド宣言、コンストラクタ宣言の引数リストは、行長や型の複雑さに問題がなければ 1 行で書く。
- 短い三項演算子は、条件、true 値、false 値を 1 行で書く。
- public API や trigger handler は、単一 record ではなく collection を受け取れる形を基本にする。
- `Trigger.new`、`Trigger.oldMap`、入力 ID は `List`、`Map`、`Set` にまとめてから処理する。
- DML 対象には、実際に変更がある record だけを追加する。
- 子レコードや関連データは、必要な ID を `Set<Id>` に集めて一括取得し、`Map<Id, List<SObject>>` などに組み替えて使う。
- 件数が大きくなる可能性がある処理では、`LIMIT`、ページング、Batch Apex、Queueable Apex などの必要性を確認する。
- governor limit 対策を理由に仕様を狭める場合は、既存データ量や呼び出し元の前提を確認してから判断する。

避ける書き方:

```apex
for (Account account : this.selector.getAccounts()) {
    // process account
}

if (this.service.canDelete(accountId)) {
    // delete account
}
```

推奨する書き方:

```apex
List<Account> accounts = this.selector.getAccounts();
for (Account account : accounts) {
    // process account
}

Boolean canDelete = this.service.canDelete(accountId);
if (canDelete) {
    // delete account
}
```

## Trigger 構成

### Trigger の責務

Trigger は entry point に集中させ、Trigger context の分岐と handler 呼び出しだけを書きます。業務ロジック、SOQL、DML、集計、加工は handler / service 側へ寄せます。

- Trigger は共有ルールが効く前提にしない。Trigger 起点の処理では、必要な権限確認、共有ルール、CRUD / FLS の考慮を handler / service / selector 側で明示する。
- 最初から 1 処理 1 クラスに分けすぎず、小さい処理は feature 単位の service に置く。
- 複雑化した処理だけ専用クラスへ切り出す。
- trigger 外でも使う処理は、trigger 名を含まない service / domain へ昇格する。
- trigger のために必要な SOQL は、まず feature 単位の selector に置く。
- 同じ取得処理が複数機能で必要になった場合に、共通 selector への切り出しを検討する。
- 命名だけを `Service` / `Selector` / `Domain` に置き換えず、責務が合っているかを確認する。
- Trigger 本体には SOQL、DML、業務判断を書かず、Trigger context ごとの handler 呼び出しに留める。
- handler は trigger context を bulk 前提で受け取り、必要に応じて `List<SObject>` / `Map<Id, SObject>` から対象型へ変換する。
- recursion 対策は static flag だけに頼らず、変更前後の値比較、処理対象の絞り込み、再更新しない設計を優先する。
- before trigger で設定できる値は before で設定し、不要な self-update DML を避ける。

### Trigger の書き方

- Trigger 宣言の event list は 1 行で書く。event が多い場合も、まずは `trigger CaseTrigger on Case (before insert, before update, after insert, after delete, after undelete, after update)` のように 1 行で揃える。
- Trigger 本体で handler インスタンスを宣言し、処理単位の handler メソッドを呼び出す。
- Trigger handler クラスの ApexDoc は業務機能ではなく、`取引先トリガーハンドラークラス` のように対象トリガーの handler クラスであることを書く。
- handler クラスの static 入口で handler 自身を `new` する構成は使わない。
- handler メソッドは `Trigger.isInsert`、`Trigger.isUpdate` などを内部判定する入口にせず、Trigger 本体から渡された `Trigger.new`、`Trigger.oldMap` などを受け取って処理を委譲する。
- handler メソッドは `beforeInsert`、`afterUpdate` のような Trigger context 名だけでまとめず、`updateAccountCaseCounts` のように委譲する処理単位の名前にする。
- Trigger 本体や handler の入口では、メソッド名と ApexDoc だけで業務処理が読める場合、委譲呼び出しごとの通常コメントを増やさない。
- メソッド名だけでは委譲する業務処理が読みにくい場合は、呼び出し直前に日本語コメントで短く補う。

### Trigger の基本形

基本形:

```apex
trigger CaseTrigger on Case(after insert, after delete, after undelete, after update) {
    CaseTriggerHandler handler = new CaseTriggerHandler();

    if (Trigger.isAfter) {
        if (Trigger.isInsert) {
            // 取引先のケース件数を更新
            handler.updateAccountCaseCounts(Trigger.new, Trigger.newMap);
        } else if (Trigger.isDelete) {
            // 取引先のケース件数を更新
            handler.updateAccountCaseCounts(Trigger.old, Trigger.oldMap);
        } else if (Trigger.isUndelete) {
            // 取引先のケース件数を更新
            handler.updateAccountCaseCounts(Trigger.new, Trigger.newMap);
        } else if (Trigger.isUpdate) {
            // 取引先のケース件数を更新
            handler.updateAccountCaseCounts(Trigger.new, Trigger.newMap, Trigger.oldMap);
        }
    }
}
```

### Trigger 実装時の調整

対象 object、対象 event、handler method は作業対象に合わせて変えます。Trigger に書くコメントは日本語で「どの業務処理へ委譲しているか」が分かる短い説明に留め、処理の詳細説明は handler / service 側へ置きます。
before と after の両方を扱う場合も、Trigger 宣言は 1 行にし、`if (Trigger.isBefore)` / `if (Trigger.isAfter)` の中で処理単位の handler メソッドを呼び出します。context ごとの丸投げメソッドを作るのではなく、Trigger 本体から業務処理の単位が読める状態を保ちます。

## Apex アノテーション

Apex アノテーションは公開範囲や実行方式を変えるため、付ける理由がコードの役割と一致しているかを確認します。

- `@AuraEnabled(cacheable=true)` は読み取り専用処理にだけ使い、DML や状態変更を含む処理には付けない。
- UI / Flow / API に公開する範囲は最小にする。
- `@TestVisible` は、テストのためだけに `public` / `protected` を増やすより、`private` の責務を保ったまま単体で確認したい場合に使う。
- 新規の非同期処理では `@Future` を使わず、Queueable Apex を使う。既存の `@Future` を変更対象に含める場合は、Queueable Apex へ移行できるか確認する。
- `@SuppressWarnings` は最後の手段にし、まずは実装で警告を解消できないか確認する。
- dynamic SOQL は任意文字列をそのまま入れず、許可リスト、describe、必要に応じた escape で入力を制限する。

## 例外処理

catch 句の例外変数名は `e` にします。

## Apex テスト

振る舞いを追加・変更したら、対象を絞った Apex テストを追加または更新します。

### テストクラスとメソッド

- テストクラス名は原則 `<対象名>Test` にする。
- テストメソッド名は、期待する振る舞いが読める名前にする。
- テストメソッドの `@IsTest` の上には、確認できる振る舞いを短い ApexDoc コメントで書く。
- テストデータはテスト内で作成し、組織内の既存データに依存しない。

### TestDataFactory

- 既存の `TestDataFactory` が使える場合は優先する。
- レコード作成 helper は原則 1 レコード作成に限定し、複数件が必要な場合はテストクラス側で繰り返し呼び出す。
- レコード作成 helper は、`createAccount(..., TestDataFactory.SaveMode.INSERT_RECORD)` のように、このリポジトリで定義した保存モード enum で保存有無を切り替える。
- `TestDataFactory.SaveMode` は Salesforce 標準 API ではなく、このリポジトリの TestDataFactory 用 enum として定義する。
- 保存モード enum の値は、保存する場合は `INSERT_RECORD`、保存しない場合は `DO_NOT_INSERT` を使う。
- `TestDataFactory` の公開 helper では保存有無を `Boolean` 引数で受け取らない。`createAccount(true)` / `createAccount(false)` のように呼び出し側で意味が読みにくい API にしない。
- `TestDataFactory` 内の SObject 初期化は `new Account();` の後に `accountRecord.Name = ...;` のように項目ごとに代入し、どの項目へ値を入れるかを 1 行ずつ分かる形にする。
- 再利用するテストデータ作成クラスは、作成データの契約もテストで確認する。

### 実行ブロック

- `System.runAs(...)` に渡す `User` は、原則としてテストクラス先頭の `private static User testUser = TestDataFactory.getTestUser();` で一度取得し、各テストメソッド内で毎回 User query や user 取得 helper を呼ばない。
- このリポジトリでは、現在ログインユーザーをテスト実行ユーザーとして扱う。テスト側はユーザー取得方法を直接書かず、`TestDataFactory.getTestUser()` を使う。
- 権限や profile の違いを確認するテストでは、必要な user をテストクラス先頭で用途別に用意し、メソッド内では `System.runAs(testUser)` のように参照する。
- 各テストメソッドの中で必ず `System.runAs(...)` を宣言し、テスト対象の処理をその中で実行する。
- 各テストメソッドの `System.runAs(...)` 内では、`Test.startTest()` と `Test.stopTest()` を必ず宣言する。
- `System.runAs(...)` ブロックの前後には空行を入れる。
- `System.runAs(...)` は、ApexUnitTestClassShouldHaveRunAs などの Code Analyzer ルールへの対応だけでなく、非設定オブジェクトと設定オブジェクトの DML が同じ transaction に混在して `MIXED_DML_OPERATION` になるリスクを避けるためにも使う。

### 検証観点

- 正常系だけでなく、権限、入力不足、例外、bulk 件数、変更なし record など変更範囲に関係する境界も確認する。
- 検証には `System.assert`、`System.assertEquals`、`System.assertNotEquals` ではなく `Assert` クラスの関数を使う。
- `SeeAllData=true` は、既存データが必要な理由を説明できる場合だけ使う。
- coverage 数値を満たすためだけの assertion や、実装詳細に強く依存する brittle なテストを追加しない。

例:

```apex
@IsTest
private class MyServiceTest {
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 有効な入力から取引先を作成
     */
    @IsTest
    static void createsRecordWhenInputIsValid() {
        System.runAs(testUser) {
            Test.startTest();

            Account actual = new Account();
            actual.Name = 'Example';

            Test.stopTest();
            Assert.areEqual('Example', actual.Name);
        }

    }
}
```

## PR 前チェック

Apex を追加・更新したら、PR 前に Code Analyzer、必要な Apex テスト、対象組織に応じた validate または dry-run を確認します。接続済み組織を使うコマンドは、対象 org alias を明示します。

### Code Analyzer

Salesforce Code Analyzer の対象になることを前提に実装します。警告を抑止する前に、設計やテストの書き方で解消できるか確認します。

- ローカル確認では、変更範囲と目的に応じて `npm run code-analyzer` または `npm run code-analyzer:ci` を実行する。
- Code Analyzer の指摘は、Salesforce Apex とこのリポジトリの設計に照らして判断する。根拠が弱いものを欠陥として断定しない。
- ユーザーの明示的な許可なしに、`@SuppressWarnings`、`code-analyzer.yml` の suppression、解析対象の除外、rule の無効化、severity threshold の緩和を追加または拡大しない。
- suppression が必要と考える場合は、対象 rule、対象ファイル、発生件数、コードで解消できない理由、解析結果への影響を提示し、変更前にユーザーの判断を待つ。
- Code Analyzer の結果は suppression 適用後の件数だけを報告せず、抑止された違反がある場合は、その件数、対象 rule、対象ファイルを明示する。
- PMD 標準 `ApexDoc` は `reportProperty=true` がこのリポジトリのプロパティコメント規約と衝突するため、`Recommended` タグを外し、`reportProperty=false` の `ApexDocWithoutProperties` へ置き換える。
- PMD 標準 `AvoidLogicInTrigger` は Trigger context 分岐も違反にするため、`Recommended` タグを外し、context 分岐と handler 呼び出しだけを許可する `TriggerDelegatesToHandler` へ置き換える。
- 置換前の標準ルールは無効化せず、明示的な rule selector で比較・再確認できる状態を保つ。
- test class の警告も無視しない。`System.runAs(...)`、テストデータ helper、メソッド名などで解消できる場合は修正する。

### Apex テスト実行

開発中は必要に応じて変更対象に近いテストを絞って実行します。

```sh
sf apex run test --class-names MyServiceTest --result-format human --synchronous --target-org <alias>
```

複数クラスを確認する場合:

```sh
sf apex run test --class-names MyServiceTest --class-names MyOtherServiceTest --result-format human --wait 30 --target-org <alias>
```

広めに確認する必要がある場合:

```sh
sf apex run test --test-level RunLocalTests --result-format human --wait 30 --target-org <alias>
```

接続済み組織に対する test 実行は組織操作に含まれるため、実行前に対象と目的を確認します。
test は確認済みの Salesforce 組織に対してのみ実行し、`--target-org <alias>` で対象を明示します。明示依頼なしに default target org を切り替えません。
`<alias>` は実行前に確認した対象 org alias に置き換えます。

### Deploy validate / deploy start

デプロイ前の基本確認は、対象組織に応じた validate または dry-run です。Apex クラス、トリガー、または Salesforce メタデータを変更したら、作業対象 manifest、対象 metadata type を絞った `--metadata`、または標準 manifest のうち、変更範囲に合う scope で確認します。`deploy validate` と dry-run は反映前チェックであり、ユーザーが動作確認できる状態とは扱いません。

- Production 組織と、このリポジトリで実行確認済みの Developer Edition の Dev 組織では `sf project deploy validate` を使う。
- Sandbox と Scratch Org では `sf project deploy start --dry-run` を使う。
- login URL だけで判断せず、対象 org または CI 接続先を変更する場合は組織種別と利用するコマンドを確認する。

Salesforce 組織の初回デプロイ / 再構築の標準検証は、全体 deploy に向かない metadata を含む `force-app` 全体ではなく、deploy 可能な scope を固定した manifest を使います。

```sh
npm run sf:validate:dev -- --target-org <alias>
```

通常の Apex / Salesforce メタデータ開発では、PR の deploy 可能な変更をすべて含む scope で validate または dry-run を行い、merge 後に同期した clean な `main` から、preflight に成功した同じ対象 org へ同じ scope で実 deploy します。

PR を merge せずに組織へ反映するよう明示された場合は、preflight が成功した作業ブランチから同じ対象 org へ反映します。

```sh
npm run sf:deploy:dev -- --target-org <alias>
```

PR マージまで依頼されている場合は、merge 後に同期した `main` の実 deploy、deploy report、必要な retrieve 一致確認、自動チェックの成功をもって、ユーザーの手動動作確認待ちは省略してよいです。PR の変更を deploy scope がすべて含むことと、実 deploy が成功することを確認するまでタスクを完了扱いにしません。本番環境への deploy は、ユーザーが本番リリースを明示した場合だけ実行します。

Apex を含む変更では、PR 作成前に関連 Apex テストを coverage 付きで確認し、merge 前の validate または dry-run でもテスト成功を確認します。コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認します。merge 後は同期した `main` の deploy 結果を確認します。

- 対象組織の確認: `sf config get target-org`、必要に応じて `sf org display --target-org <alias>`
- Production 組織または実行確認済みの Developer Edition の Dev 組織でメタデータの整合性確認: `npm run sf:validate:dev -- --target-org <alias>`
- 同じ対象 org で変更範囲を絞った確認: `sf project deploy validate --metadata ApexClass:MyService --metadata ApexClass:MyServiceTest --target-org <alias>`
- Sandbox / Scratch Org で変更範囲を絞った確認: `sf project deploy start --dry-run --metadata ApexClass:MyService --metadata ApexClass:MyServiceTest --target-org <alias> --wait 30`
- 確認済みの組織への反映: `npm run sf:deploy:dev -- --target-org <alias>`
- PR 作成前の Apex 振る舞いと coverage 確認: `sf apex run test --class-names ... --code-coverage --target-org <alias>`

`sf project deploy preview` は標準の確認手段にしません。反映前は Git の差分確認と、対象組織に応じた validate または dry-run で確認します。
明示依頼がない限り、default target org の切り替えで別組織へデプロイしません。

## Coverage の扱い

このリポジトリでは、coverage 数値だけを目的にしたテスト追加はしません。

- 変更した Apex の重要な振る舞いをテストで確認する。
- coverage は PR 作成前の test 結果の判断材料として扱う。
- 組織全体の coverage 改善や CI 導入は、別 Issue で扱う。
- coverage が不足する場合は、不足している振る舞いと対象クラスを報告する。

## 作業報告

Apex やメタデータを変更した後は、次を報告します。

- 変更した `.cls` と `-meta.xml`
- 追加・更新した Apex テスト
- 対象 Salesforce 組織の alias
- 実行した Salesforce Code Analyzer と結果
- 実行した `sf project deploy validate` と `sf project deploy start`
- PR 作成前に実行した `sf apex run test --code-coverage`
- Apex テストの成功件数と coverage、または PR 作成前にまとめる理由
- 実行しなかった確認と、その理由
