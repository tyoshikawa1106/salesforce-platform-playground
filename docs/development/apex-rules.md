# Apex 開発ルール

Apex クラス、トリガー、Apex テストを追加・更新するときの実務ルールです。

## 読み方

迷ったときは、次の順で確認します。

1. 実装の形は、[Controller / Service / Selector / Wrapper](#controller--service--selector--wrapper)、[Bulkification と Governor Limits](#bulkification-と-governor-limits)、[Trigger 構成](#trigger-構成) を見る。
2. コメントの書き方は、[ApexDoc](#apexdoc) と [通常コメント](#通常コメント) を見る。
3. テストデータ、`System.runAs`、`Test.startTest()` / `Test.stopTest()` は、[Apex テスト](#apex-テスト) を見る。
4. 作業順序は、[開発手順](#開発手順) を見る。
5. push 前の確認は、[push 前チェック](#push-前チェック) を見る。

## 開発手順

Apex本体と関連テストを実装し、変更した振る舞いを確認します。実装を修正している途中は、変更対象に近いテストを必要に応じて実行し、最終的に関連クラス全体のテストとcoverageを確認します。

push前に必要なテストと、影響する機能仕様書を更新します。

## クラスとメタデータ

クラス本体は`.cls`、メタデータは`.cls-meta.xml`で管理し、追加・更新時は両者を一緒に扱います。

- `apiVersion`はプロジェクト標準と変更対象の周辺メタデータに合わせる。理由なく古いままにしたり、コードベース内のAPIバージョンを増やしたりしない。
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

## ApexDoc

ApexDoc は、Winter '26 / API 65.0 の Apex Developer Guide で追加された Apex 向けの標準ドキュメントコメント形式です。このリポジトリでは、ApexDoc を Apex の公開契約を説明するコーディング規約として扱います。

ApexDoc は `/** ... */` 形式で書き、対象のクラス、インターフェース、列挙型、メソッド、コンストラクタ、プロパティの直前に置きます。Apex コンパイラは ApexDoc のタグや説明内容を検証しないため、実装を変更したら対応する ApexDoc も必ず見直します。

### 必須範囲

- クラス、インターフェース、列挙型には、公開範囲に関係なく ApexDoc を付ける。
- `public` / `global` のメソッドには ApexDoc を付ける。
- 明示的に定義するコンストラクタには、公開範囲に関係なく ApexDoc を付け、通常のブロックコメント `/* ... */` で代替しない。
- LWC、Aura、Flow、REST、Agentforce、パッケージ利用者など外部境界から呼ばれる Apex には、呼び出し側が守るべき契約を明記する。
- 公開APIの一部になる複雑なプロパティにはApexDocを付ける。
- `private` / `protected` のヘルパーでも、複雑な前提、例外、権限境界、拡張ポイントを持つ場合は ApexDoc を付ける。
- テストクラスには、検証対象を短い機能ラベルで書く。テストメソッドは公開 API ドキュメントではなくテスト仕様として必要な範囲で説明し、全メソッドへ機械的に長い ApexDoc を付けない。

### 基本構成

ApexDoc の先頭には、対象要素を一文で要約する主要説明を書きます。最初の文は生成ドキュメントの一覧や索引に使われる前提で、短く具体的に書きます。このリポジトリの日本語 ApexDoc は機能ラベル調にし、文末の `です` / `ます` / `。` を使いません。

主要説明だけで呼び出し方が分かる場合は、補足段落を増やしません。前提条件、事後条件、権限境界、null の扱い、一括処理前提、副作用、関連するメタデータや設定は、呼び出し側の判断に必要な場合だけ書きます。実装を読めば分かる処理手順や内部設計の説明は ApexDoc に書きません。

```apex
/**
 * 取引先名の前後空白を除去
 * @param accountName 入力された取引先名、nullを許容
 * @return 前後空白を除いた取引先名、未入力の場合は空文字
 */
public String normalizeAccountName(String accountName) {
    // 未入力を後続処理で扱える空文字へ統一
    if (String.isBlank(accountName)) return '';
    // 入力内容を保持して前後の余分な空白だけを除去
    return accountName.trim();
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
- `@InvocableMethod` では、Flow Builder から見たアクションの目的、入力 / 出力の構造、表示ラベル / 説明と ApexDoc の説明が矛盾しないことを確認する。
- `@InvocableVariable` では、Flow から渡される値の役割、必須/任意、許可値を書く。
- `@RestResource` と HTTP メソッドアノテーションでは、リソースの役割、リクエスト / レスポンス、ステータスコード、認証/権限前提を書く。
- 既存の`@Future`を残す場合は、非同期トランザクション、callout、ガバナ制限、呼び出し制約、残す理由を書く。
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

### 通常コメント

独自実装するApex本体では、ローカル変数の宣言、代入、分岐、ループ、返却、DML、SOQL、メソッド呼び出しなど、意味を持つ処理ごとに`//`コメントを直前へ1行ずつ記載します。

この規定は新規または変更する処理へ適用します。変更していない既存処理は、コメントを追加する目的だけで修正しません。

- アノテーション、空行、括弧や閉じ記号だけの行、複数行式の継続行は、1 処理ごとの日本語コメントの対象外とする。
- Apex テストは 1 処理ごとのコメント対象外とし、準備、実行、検証などのまとまりを示すコメントだけを必要に応じて記載する。
- バッチサイズや表示上限など、コード・設定で管理する調整値をコメントへ重複記載しない。値が変わっても目的が変わらない処理は、その目的を書く。
- `// accountRecord を準備` や `// normalizeNames を実行` のように、変数名やメソッド名を言い換えるだけのコメントを書かない。
- テストクラスの `System.runAs`、`Test.startTest()`、`Test.stopTest()` にはコメントを付けず、必要に応じて空白行で実行範囲を見やすく区切る。
- テストの assertion / fail メッセージは日本語で書く。API 名、項目名、クラス名などの識別子は必要に応じてそのまま使う。
- 同じ意図を ApexDoc と通常コメントで重複させない。
- 日本語コメントは ApexDoc と同じく、機能ラベル調にし、文末の `です` / `ます` / `。` を使わない。

```apex
// 後続処理の対象があるかを判定
Boolean hasAccounts = accounts != null && !accounts.isEmpty();

// 更新前後の差分を使って変更された名称だけを補正
normalizeNames(accounts, oldAccountMap);
```

## Controller / Service / Selector / Wrapper

画面や LWC から呼び出す Apex は、読みやすさと責務境界を優先して `Controller`、`Service`、`Selector`、`Wrapper` の構成を基本にします。

- `Controller` は公開 API の入口、処理順序の組み立て、DMLの実行を担当する。
- `Controller` には、業務判断やデータ加工を目的にした `if` / `for` などのロジックを原則として書かない。
- `Controller` は `Service` と `Selector` を呼び出し、両者のやり取りは引数と戻り値で行う。
- `Service` はビジネスロジック、入力値の正規化、権限や削除可否などの判定、DML対象レコードと返却用データの組み立てを担当する。
- 検索結果を集計・変換する Map やコレクション、返却用データの組み立ては `Service` で行う。
- `Service` から `Selector` を直接呼び出さない。SOQL が必要なデータは `Controller` が `Selector` から取得し、`Service` へ引数で渡す。
- `Selector` は、検証済みの検索条件から SOQL と bind 値を組み立て、SOQL を実行し、取得した検索結果を加工せずに返す。
- 動的SOQLのbind用Map生成と値設定は`Selector`で行ってよい。検索値はbindで渡し、文字列へ組み込む必要がある場合は適切にエスケープする。オブジェクト名、項目名、ソート方向、演算子などbindできない識別子は、許可リストまたはdescribeで検証済みの値に限定する。
- SObject レコードを取得する SOQL は、1件だけ取得する場合でも結果を必ず `List<対象型>` または `List<SObject>` で受け取る。SOQL の結果を SObject 型の変数へ直接代入しない。
- SOQL for ループは原則として使用しない。SOQL の結果を先に List 型の変数へ代入し、ループや後続処理は別の処理として行う。
- List への全件取得で Apex heap size の超過が見込まれ、`Database.Cursor` または `Database.PaginationCursor` を利用できない場合に限り、SOQL for ループを使用してよい。使用する理由をループの直前に日本語コメントで明記する。
- SOQL for ループを使用する場合は、クエリと分割処理を分離できないことを責務上の例外として、専用の大量処理クラスで両者を調整してよい。このクラスは通常の `Selector` として再利用せず、例外とする理由と責務を ApexDoc に明記する。
- 大量データの分割取得などで `Database.Cursor` または `Database.PaginationCursor` を使用する場合は、SOQL の結果を List 型で受け取るルールの対象外とする。取得後の加工や判定は `Service` で行う。
- 単一レコードとして扱う場合も、メインクラスからServiceへListのまま渡す。Serviceが空でないことを確認してから先頭レコードをSObject型の変数へ代入する。入力としてnullを受け取り得るメソッドは、`isEmpty()`や添字参照より前にnullも確認する。未確認の`records[0]`をメソッド引数へ渡さない。
- `Selector` の公開メソッドごとに、問い合わせ範囲を確定する必須条件と、結果を追加で絞り込む任意フィルターを区別する。
- ID、親 ID、対象 ID 集合などの必須条件が未指定で、その欠落を正常な no-op として定義している場合は、`Selector` で SOQL を実行せず、空の List、件数の `0`、カーソルなしなど、戻り値型とメソッド契約に応じた0件相当値を返す。契約違反または不正入力として定義している場合は例外を送出する。
- 必須条件の未指定は、`null`、空文字、空白文字、空の List、空の Set とする。数値の `0` と Boolean の `false` は有効な検索値として扱い、SOQL を短絡しない。
- 任意フィルターが未指定でも一覧取得を行う仕様の場合は、許可済みのオブジェクトと項目、利用者権限、決定的なソート、仕様で定めた安全な取得上限またはページングを満たす場合に限り、`Selector` で SOQL を実行してよい。
- 必須条件の未指定をメソッド契約で定めた0件相当値へ変換する処理は、データ加工ではなくクエリ短絡の一部として `Selector` で行ってよい。
- `Selector` では describe、DML、業務上の入力値正規化や判定、検索結果の集計や変換、返却用データの組み立てを行わない。必須条件の空判定、SOQL 実行を安全に短絡するガード、LIKE 用ワイルドカード付与など SOQL 構文上必要な bind 値の組み立ては、問い合わせ組み立ての一部として行ってよい。前後空白の除去、コード変換、既定値補完など入力の意味を確定する正規化は `Service` または専用のビジネスロジッククラスで行う。
- `Wrapper` は画面との入出力や、メインクラスとServiceの間で渡すデータ・判定結果・集計値を表す。複数の結果はWrapperにまとめ、同じ結果リストを成功件数・失敗件数・理由の取得ごとに繰り返し走査しない。
- LWC / Aura との Apex 境界で使う `Wrapper` は、既存の命名と公開範囲に合わせる。可読性や再利用性が下がる場合は、無理に inner class 化しない。
- LWC / Aura 用 `Wrapper` はコンストラクタを明示し、公開プロパティの既定値を初期化する。

この構成は、意味のある責務分離を目的に使います。単純な処理を機械的に細かく分割しすぎないようにし、クラスを増やす場合は、読みやすさ、テストしやすさ、変更影響の小ささを説明できる単位にします。

### 処理の呼び出しとエラー判定

Controller、Batch、Scheduler、Trigger Handlerなどのメインクラスでは、データ取得、業務判定、エラー確認、DML、結果の集計を、それぞれ独立した文として順に記述します。ServiceやSelectorの呼び出しを別の呼び出しや条件式へ埋め込みません。

- ServiceやSelectorの戻り値は、名前付きのローカル変数またはWrapperのプロパティへ代入してから使う。`if`、`for`、`return`、別のメソッド・コンストラクタの引数へ取得・業務判定処理を直接書かない。
- `if (String.isNotBlank(service.getBlockMessage()))`、`service.createView(selector.getJobs())`、`return selector.getAccounts()`のような書き方をしない。
- `String.isNotEmpty(wrapper.errorMessage)`、`records.isEmpty()`など、取得済みの値に対する単純な空判定は条件式に書いてよい。業務判定やデータ取得の呼び出しと組み合わせない。
- Wrapperを使う業務判定では、Serviceが業務上のエラーメッセージを`errorMessage`へ設定し、拒否理由、失敗件数などとともに新しいWrapperで返す。メインクラスのエラー分岐では、その業務処理を追加で行わない。
- エラーがない場合の`errorMessage`は空文字とする。繰り返し呼ばれる判定では、前回のエラーメッセージをそのまま残さず、今回の判定結果で設定し直す。累積する件数や理由コードとは分けて扱う。
- メインクラスは判定結果を受け取った直後にエラーを確認し、エラーがあれば後続処理へ進まず終了する。戻り値があるメソッドはWrapperなど契約上の戻り値を返し、`void`メソッドは`return;`で終了する。
- `else`を伴わず、処理が単一の`return`または`throw`だけのガード節は、波括弧を付けず1行で書く。例: `if (String.isNotEmpty(wrapper.errorMessage)) return wrapper;`、`if (!sent) throw new EmailException('結果メールを送信できませんでした。');`。複数の文を実行する分岐には波括弧を付ける。
- メール送信の受付結果など、処理の成否を返すBooleanも、先に変数へ代入してから判定する。例外として扱う必要がある失敗はメインクラスで処理する。

Batchの`execute`での例:

```apex
// 今回の対象件数を取得
Integer targetCount = scope.size();
// 削除可否と中止時の集計をServiceで判定
this.wrapper = this.service.checkExecutionConditions(this.wrapper, targetCount);
// エラー判定
if (String.isNotEmpty(this.wrapper.errorMessage)) return;
// メインクラスで削除を実行
List<Database.DeleteResult> results = Database.delete((List<Account>) scope, false, AccessLevel.USER_MODE);
// 削除結果をまとめて集計
this.wrapper = this.service.aggregateDeleteResults(results, this.wrapper);
```

### null と空値

アプリケーション側で生成、保持、返却する状態は、型に自然な既定値がある場合に `null` で未設定を表しません。

- `Boolean` は `true` または `false` を返し、フィールドや返却用プロパティの既定値は `false` にする。3 状態以上を表す必要がある場合は `null` を第3の状態にせず、`enum` または結果オブジェクトで状態を明示する。
- `String` の未設定値は `''` とし、文字列を返すメソッドや返却用プロパティから `null` を返さない。Salesforce の項目値や外部入力として受け取った `null` は、後述する null 許容値として意味を維持する場合を除き、アプリケーションの状態として保持または返却する境界で `''` へ正規化する。
- 件数、位置、進捗など、`0` が自然な既定値となる数値は `0` で初期化する。`0` 自体が「未指定」と異なる業務値である場合は、別の状態値または結果オブジェクトで区別する。
- `List`、`Set`、`Map` に空の初期値が必要な場合は、要素型を問わず、`new List<String>()` など対応する空のコレクションで初期化する。`null` で初期化しない。
- 非 null を返すことが保証されたメソッドの戻り値や、最初の参照前にすべての経路で代入されるローカル変数は、無意味な既定値を先に代入せず直接代入してよい。
- コレクション型の戻り値は `null` を返さず、対応する空のコレクションを返す。
- SObject 型の戻り値は、対象レコードがない場合も `null` を返さず、`new Opportunity()` など対象型の新しいインスタンスを返す。
- SObject の取得が必須の場合は、`Service` が空の List を検出して明示的にエラーとして扱う。
- `Date`、`Datetime`、`Time`、`Id`、Salesforce の項目値、外部入力、Cursor、Describe 結果、任意のオブジェクト参照など、型に安全な空値がなく「値なし」が契約上の状態となる値は `null` を許容する。呼び出し側の分岐に影響する場合は ApexDoc に null の意味を記載する。
- コンストラクタや factory が返却前にすべての経路で非 null 値を代入するプロパティは、宣言時に同じ既定値を重ねて初期化しなくてよい。

### Service / Selector の状態

Service、BatchService、Selector、BatchSelectorにはクラス変数やインスタンス変数・プロパティを持たせません。入力や処理結果をフィールドへ保存せず、必要な値は引数で受け取り、結果は戻り値で返します。引数のコレクションやオブジェクトを変更する副作用で結果を受け渡さず、更新後の値を別に組み立てて返します。

トランザクション間で必要な集計値や処理状態はBatchなどのメインクラスに保持します。メインクラスはServiceの戻り値を自身の状態へ反映し、次の呼び出しへ引数で渡します。

### Service / Selector の初期化

`Controller` や `Handler` が内部で使う標準の `Service` / `Selector` は、コンストラクタ引数ではなくフィールド宣言時に初期化します。

```apex
private ObjectRecordSearchService service = new ObjectRecordSearchService();
private ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
```

コンストラクタで `Service` / `Selector` を受け取るのは、呼び出し元が実装を選ぶ公開契約や、複数実装を切り替える合意済みの設計がある場合に限定します。

テストから参照・差し替えするためだけに、本体のService・Selectorフィールドへ`@TestVisible`を付けません。Service・Selectorの単体テストで使うインスタンスはテストクラス内で宣言します。メインクラスは公開された入口から検証します。

### メンバー変数

クラス宣言の直後には空行を入れます。

Service・Selector・Wrapperのインスタンスは同じグループとしてクラス先頭にまとめて宣言し、その間に空行を入れません。その他のフィールドとの間には空行を1行入れます。同じグループ内のフィールド同士は空行で分けません。クラス変数・インスタンス変数の宣言にはコメントを付けません。

フィールド群と最初のコンストラクタ・メソッドの間、およびコンストラクタ・メソッド同士の間には空行を1行入れます。ApexDocやアノテーションがある場合は、その直前を区切りとし、宣言との間には空行を入れません。整形ツールの実行後も、この空行が維持されていることを確認します。

インスタンスのメンバー変数を参照する場合は、原則として `this.` を付けます。`static` 変数、ローカル変数、メソッド引数には `this.` を付けません。

フィールドの用途は、役割が分かる変数名で表します。

処理全体で受け渡す単一のWrapperの変数名は`wrapper`に統一します。

Map 変数は、役割が明確なら `oldAccountMap` のように `{対象}Map` で簡潔に書きます。`oldAccountsById` のようにキーを名前へ含めるのは、キーが `Id` 以外で誤読されやすい場合に限ります。

### static と instance の使い分け

Salesforce のフレームワーク入口では `static` が必要になることがありますが、下位の処理まで機械的に `static` にしません。

- `@AuraEnabled`、`@InvocableMethod`、`@RemoteAction` など、フレームワークが要求する入口は `static` にする。
- `Service` / `Selector` は既存実装に合わせて instance メソッドを使用する。
- `static` helper を増やす場合は、フレームワーク要件、純粋関数、既存パターンのどれに当たるかを説明できるようにする。

## Batch / BatchService / BatchSelector / BatchScheduler

Apex バッチは、`機能名Batch`、`機能名BatchService`、`機能名BatchSelector`、`機能名BatchScheduler`を基本構成とします。定期起動や検索が不要な場合は、その役割のクラスを形式的に追加しません。

- `Batch` は `start` / `execute` / `finish` の処理順序を組み立て、DMLを実行する。必要なデータを `BatchSelector` から取得し、`BatchService` へ引数で渡す。
- `BatchService` は実行条件・権限の判定、DML対象レコードの組み立て、DML結果の集計、バッチ固有の結果通知を担当する。`BatchSelector` を直接呼び出さない。
- `BatchSelector` は対象レコードや標準ジョブの検索を担当し、業務判断、集計、DML、通知を行わない。`Database.QueryLocator` を返す検索は、SOQL の結果を List 型で受け取るルールの対象外とする。
- `BatchScheduler` は定期起動の入口とし、バッチを登録する。業務処理を重複実装しない。
- 画面用のService・Selectorとバッチ用のBatchService・BatchSelectorを分ける。画面用のService・Selectorからバッチ用クラスを呼び出さず、各入口が自身の責務に対応するクラスを使う。
- 画面からのバッチ登録はController、定期起動の登録はBatchSchedulerにそれぞれ記述する。`Database.executeBatch`の呼び出しを共通化するためだけのServiceやCoordinatorを追加しない。
- 複数の集計値をまとめて受け渡す場合は、構成一覧へ含めた`BatchWrapper`を使用する。Batchが保持するWrapperを引数で渡し、BatchServiceが集計後の新しいWrapperを返す。
- トランザクション間の集計値保持には、まず `Database.Stateful` で要件を満たせるかを検討する。通常の完了通知は `finish` から `BatchService` へ委譲する構成を基本とする。
- `Coordinator`、`Notification`、`Monitor`、`Watchdog` などを追加する場合は、基本構成に収まらない理由、標準機能や既存クラスによる代替案、追加する責務を説明して合意を得る。役割を細分化できることだけを追加理由にしない。
- finish 未実行時の補完監視、永続履歴、通知の再試行は、通常の集計・完了通知から分けて必要性を判断する。エラー対応の指示だけで、これらの追加機構まで必要と解釈しない。
- `Database.RaisesPlatformEvents`やPlatform Eventを使ったエラー処理も追加機構として扱い、用途と処理構成の合意なしに導入しない。
- 起動したジョブの状況を照会する処理では、起動時に返したジョブIDを呼び出し元で保持し、同じIDを指定して取得する。最新ジョブの検索で代用しない。照会時も実行ユーザーや対象クラスなど、必要なアクセス範囲を検証する。
- 定期起動クラスの接尾辞は `BatchScheduler` とし、命名時はテストクラスの `Test` 接尾辞を含めた文字数を確認する。

## DMLの配置

- `insert`、`update`、`upsert`、`delete`、`undelete`、`merge`は、Controller、Batch、Trigger Handlerなど、処理全体の順序を管理するメインクラスで実行する。`Database`クラスの同等メソッドも対象とする。
- Service、BatchService、Selector、DomainではDMLを実行しない。Serviceは判定と対象レコードの組み立てを行い、メインクラスへ返す。メインクラスがDMLを実行し、結果の集計・変換が必要な場合はServiceへ渡す。
- DMLのユーザーモード指定、部分成功の扱い、トランザクション境界はメインクラスで明示する。DMLを隠すためだけのServiceメソッドや専用クラスを追加しない。
- 部分成功のDML結果はレコード単位で集計し、1レコードの複数エラーを失敗件数へ重複加算しない。失敗対象の識別が必要な場合は、入力レコードと結果の対応を保持してServiceへ渡す。
- テストデータ作成・検証のためのDMLはテストクラスと既存のTestDataFactoryで実行してよい。本体コードの責務分担とは区別する。

## セキュリティと権限

Apex は実行コンテキストによって共有ルール、CRUD、FLS の効き方が変わります。AI エージェントは「動くこと」だけでなく、どの権限境界で動くかを確認します。

- class には原則 `with sharing` を付ける。`without sharing` や `inherited sharing` を使う場合は理由を作業報告に残す。
- UI、Flow、API などユーザー操作から呼ばれる処理では、SOQL に `WITH USER_MODE`、DML statement に `as user`、Database method に `AccessLevel.USER_MODE` を使えるか確認する。
- `as system` や `AccessLevel.SYSTEM_MODE` は、ユーザー権限を超える必要がある処理に限定し、使う理由を作業報告に残す。
- API v67.0 以降では database operation が user mode 前提になり、明示的な sharing 宣言がない class の扱いも変わる。API version によって挙動が変わるため、セキュリティ境界は暗黙のデフォルトに頼らず、class 宣言、SOQL、DML の書き方で明示する。
- API v67.0 以降の Apex SOQL では `WITH SECURITY_ENFORCED` を使わない。CRUD / FLS を考慮する場合は、`WITH USER_MODE`、`AccessLevel.USER_MODE`、`Security.stripInaccessible` など、対象 API バージョンで利用できる手段を使う。
- `forcedotcom/sf-skills` や外部テンプレートに `WITH SECURITY_ENFORCED` の例が含まれていても、対象 API version が v67.0 以降ならこのリポジトリのルールを優先し、`WITH USER_MODE` などに置き換える。
- `without sharing` が必要な処理は、範囲を小さい helper に閉じ込め、入口側で権限や Custom Permission を確認する。
- ユーザー向けエラーには内部 ID、SOQL、stack trace、個人情報、秘密情報を含めない。
- UI に返すエラーメッセージは、内部事情や実装用語ではなく、ユーザーが次に取る行動が分かる表現にする。例: 条件を見直す、時間をおいて再試行する、管理者に権限を確認する。
- 外部接続の認証情報や endpoint は Apex に直書きせず、Named Credential や metadata 側の設定を使う。

## Bulkification と Governor Limits

Apex は一括実行される前提で実装します。1 件の画面操作から呼ばれる処理でも、将来の batch、Flow、trigger、API 呼び出しで複数件になる可能性を考慮します。

- loop 内で SOQL、DML、callout を実行しない。
- 異なる SObject の集計を単一 SOQL に統合できない場合に限り、固定の許可リストから作成した件数クエリを専用 Coordinator の loop で順次実行してよい。通常の `Selector`、`Service`、`Controller` ではこの例外を使用しない。
- この例外を使用する Coordinator は、同期 SOQL 上限より小さい最大クエリ数と現在トランザクションの残り SOQL 数を実行前に検証し、例外とする理由、固定許可リスト、上限、責務を ApexDoc に明記する。`Selector` は Coordinator から渡された 1 件の検証済みクエリを実行する責務に限定する。
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
    // 対象の取引先を処理
}

if (this.service.canDelete(accountId)) {
    // 削除可能な取引先を削除
}
```

推奨する書き方:

```apex
// 処理対象の取引先を取得
List<Account> accounts = this.selector.getAccounts();
// 取得した取引先を順に処理
for (Account account : accounts) {
    // 対象の取引先を処理
}

// 対象の取引先を削除できるか判定
Boolean canDelete = this.service.canDelete(accountId);
// 削除可能な場合だけ削除処理へ進む
if (canDelete) {
    // 削除可能な取引先を削除
}
```

## Trigger 構成

### Trigger の責務

handlerが処理順序と必要なDMLを担当し、業務判断・対象レコードの組み立て・集計はservice、SOQLはselectorに配置します。

- 一オブジェクト一Triggerを原則とする。
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
- Trigger 本体や handler の入口にある宣言と委譲呼び出しも、1 処理ごとのコメント対象とする。
- 委譲呼び出しのコメントはメソッド名を言い換えず、委譲する業務処理または呼び出し後に成立する状態を短く書く。

### Trigger の基本形

基本形:

```apex
trigger CaseTrigger on Case(after insert, after delete, after undelete, after update) {
    // トリガー処理の呼び出し先を準備
    CaseTriggerHandler handler = new CaseTriggerHandler();

    // ケースの変更が反映された状態で関連する取引先を更新
    if (Trigger.isAfter) {
        // 新規ケースに関連する取引先を更新対象にする
        if (Trigger.isInsert) {
            // 取引先のケース件数を更新
            handler.updateAccountCaseCounts(Trigger.new, Trigger.newMap);
        }
        // 削除前のケースから関連する取引先を特定
        else if (Trigger.isDelete) {
            // 取引先のケース件数を更新
            handler.updateAccountCaseCounts(Trigger.old, Trigger.oldMap);
        }
        // 復元したケースに関連する取引先を更新対象にする
        else if (Trigger.isUndelete) {
            // 取引先のケース件数を更新
            handler.updateAccountCaseCounts(Trigger.new, Trigger.newMap);
        }
        // 変更前後のケースから影響する取引先を特定
        else if (Trigger.isUpdate) {
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

UI、Flow、API、非同期処理、静的解析抑止に関わるアノテーションは、必要性と公開範囲・実行方式への影響を確認し、付ける理由がコードの役割と一致する場合に使います。

- `@AuraEnabled(cacheable=true)` は読み取り専用処理にだけ使い、DML や状態変更を含む処理には付けない。
- UI / Flow / API に公開する範囲は最小にする。
- `@TestVisible` は、テストのためだけに `public` / `protected` を増やすより、`private` の責務を保ったまま単体で確認したい場合に使う。
- 新規の非同期処理では `@Future` を使わず、Queueable Apex を使う。既存の `@Future` を変更対象に含める場合は、Queueable Apex へ移行できるか確認する。

## 例外処理

想定可能な業務上の失敗と、想定外の処理障害を分けて扱います。

例外の捕捉・変換が必要な場合は、Controller、Batch、Scheduler、Trigger Handlerなどのメインクラスに集約します。Service・BatchService・Selectorでは捕捉・変換せず呼び出し元へ伝播させます。単に再throwするためのtry-catchは追加しません。

- 入力不足、権限不足、対象なしなど、公開メソッドの契約として想定する結果は、条件を明示的に判定する。`Exception` の型やメッセージ、`NullPointerException` の発生を正常な分岐に利用しない。
- 想定可能な失敗を下位層から返す形式は、Boolean、空コレクション、既存 Wrapper、結果オブジェクトなど、呼び出し側が誤判定しない最小の契約を選ぶ。複数の失敗理由を区別する必要がある場合は、エラーコードを持つ結果オブジェクトを検討するが、すべての処理へ一律に導入しない。
- Controllerが想定外の例外を捕捉する場合は、内部の例外メッセージやstack traceを画面へ公開せず、処理に応じた一般化メッセージへ変換する。
- 内部契約の違反、回復不能な処理失敗、Salesforce プラットフォームから返る想定外の障害は例外として扱う。`try-catch` は、入力検証や null 判定の代わりにしない。
- 専用例外クラスは、呼び出し側が例外型によって回復方法や変換方法を区別する必要がある場合だけ作る。型の識別以外に契約を持たない空の専用例外は作らない。
- catch 句の例外変数名は `e` にする。

## Apex テスト

振る舞いを追加・変更したら、対象を絞った Apex テストを追加または更新します。

### テストクラスとメソッド

- テストクラス名は原則 `<対象名>Test` にする。
- テストメソッド名は、期待する振る舞いが読める名前にする。
- テストメソッドの `@IsTest` の上には、確認できる振る舞いを短い ApexDoc コメントで書く。
- テストデータはテスト内で作成し、組織内の既存データに依存しない。

### テスト対象インスタンス

- `Service`、`Selector`、`DAO` など、複数のテストメソッドで共通利用するステートレスなテスト対象は、各テストメソッド内で生成せず、テストクラス先頭で `private static` フィールドとして一度生成する。
- クラス先頭の共通フィールドは、テスト対象、テスト実行ユーザー、その他の共通テストデータの順に宣言する。
- テスト対象が状態を保持する場合や、テストメソッドごとに異なるコンストラクタ引数が必要な場合は、各テストメソッド内で生成する。

```apex
private static ObjectRecordSearchService service = new ObjectRecordSearchService();

private static User testUser = TestDataFactory.getTestUser();
```

### TestDataFactory

- テスト準備は既存の`TestDataFactory`を優先し、テスト固有の準備はテストクラス内に置く。
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
- 実装詳細に強く依存するテストを追加しない。

## push 前チェック

Apexを含む変更では、push前に関連テストとcoverage、Code Analyzer、次のローカルチェックの結果を確認します。

### 定期品質チェックと同等のローカルチェック

定期品質チェックで実行される品質確認は、push 前にローカルでも実行します。変更内容に関係なく項目を省略せず、失敗を解消してからpushします。

```sh
npm audit --audit-level=high
npm run prettier:verify
npm run docs:check
npm run lint -- --no-error-on-unmatched-pattern
npm run lint:slds
npm run code-analyzer:ci
npm run test:scripts
npm run test:unit -- -- --runInBand --passWithNoTests
```

### Code Analyzer

Salesforce Code Analyzer の対象になることを前提に実装します。

- Code Analyzer の指摘は、Salesforce Apex とこのリポジトリの設計に照らして判断する。根拠が弱いものを欠陥として断定しない。
- PMD 標準 `ApexDoc` は `reportProperty=true` がこのリポジトリのプロパティコメント規約と衝突するため、`Recommended` タグを外し、`reportProperty=false` の `ApexDocWithoutProperties` へ置き換える。
- PMD 標準 `AvoidLogicInTrigger` は Trigger context 分岐も違反にするため、`Recommended` タグを外し、context 分岐と handler 呼び出しだけを許可する `TriggerDelegatesToHandler` へ置き換える。
- 置換前の標準ルールは無効化せず、明示的な rule selector で比較・再確認できる状態を保つ。
- test class の警告も無視しない。`System.runAs(...)`、テストデータ helper、メソッド名などで解消できる場合は修正する。

### 最終差分の確認

Apexのテスト結果は、検証したソースと対応させて判断します。未反映の接続orgに対する単独の`sf apex run test`は、作業ブランチの新コードを確認した結果として扱いません。コメントやインデントだけのApex変更では、`git diff -w`などで振る舞い差分がないことを確認します。

## Coverage の扱い

coverage数値だけを目的にしたテストやassertionを追加せず、重要な振る舞いを検証します。

- coverage は push 前の test 結果の判断材料として扱う。
- coverage は、対象クラスだけでなく、同じ変更・検証 scope に含まれる Controller、Service、Selector、Wrapper、helper などの関連する本体 Apex クラスごとに確認する。
- 作業報告では、関連する本体 Apex クラスのクラス名と coverage を個別に示す。テストクラス自体は coverage の評価対象に含めない。
- 組織全体の coverage 改善や CI 導入は、別 Issue で扱う。
- coverage が不足する場合は、不足している振る舞いと対象クラスを報告する。
