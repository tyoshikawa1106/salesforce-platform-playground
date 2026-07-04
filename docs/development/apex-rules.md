# Apex 開発ルール

Apex クラス、トリガー、Apex テストを追加・更新するときの実務ルールです。

## 基本方針

- Apex と Salesforce メタデータは `force-app/main/default` 配下を正本にする。
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

この構成は、意味のある責務分離を目的に使います。単純な処理を機械的に細かく分割しすぎないようにし、クラスを増やす場合は、読みやすさ、テストしやすさ、変更影響の小ささを説明できる単位にします。

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
- 外部接続の認証情報や endpoint は Apex に直書きせず、Named Credential や metadata 側の設定を使う。
- 権限や組織設定が不明な場合は、Apex 側で推測して固定せず、確認事項として残す。

## Bulkification と Governor Limits

Apex は一括実行される前提で実装します。1 件の画面操作から呼ばれる処理でも、将来の batch、Flow、trigger、API 呼び出しで複数件になる可能性を考慮します。

- loop 内で SOQL、DML、callout を実行しない。
- `for`、`if`、メソッド引数などの式の中に、取得処理や判定用の関数呼び出しを直接書かない。結果を名前付き変数に入れてから使う。
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
- Trigger 宣言の event list は 1 行で書く。event が多い場合も、まずは `trigger CaseTrigger on Case(before insert, before update, after insert, after delete, after undelete, after update)` のように 1 行で揃える。
- handler メソッドは `beforeInsert`、`afterUpdate` のような Trigger context 名だけでまとめず、`updateAccountCaseCounts` のように委譲する処理単位の名前にする。
- handler メソッド呼び出しの直前には、委譲する業務処理を日本語コメントで短く書く。

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

対象 object、対象 event、handler method は作業対象に合わせて変えます。Trigger に書くコメントは日本語で「どの業務処理へ委譲しているか」が分かる短い説明に留め、処理の詳細説明は handler / service 側へ置きます。
before と after の両方を扱う場合も、Trigger 宣言は 1 行にし、`if (Trigger.isBefore)` / `if (Trigger.isAfter)` の中で処理単位の handler メソッドを呼び出します。context ごとの丸投げメソッドを作るのではなく、Trigger 本体から業務処理の単位が読める状態を保ちます。

## Apex アノテーション

Apex アノテーションは公開範囲や実行方式を変えるため、付ける理由がコードの役割と一致しているかを確認します。

- `@AuraEnabled(cacheable=true)` は読み取り専用処理にだけ使い、DML や状態変更を含む処理には付けない。
- UI / Flow / API に公開する範囲は最小にする。
- `@TestVisible` は、テストのためだけに `public` / `protected` を増やすより、`private` の責務を保ったまま単体で確認したい場合に使う。
- 新規の非同期処理では、理由がなければ `@future` より Queueable Apex を優先する。
- `@SuppressWarnings` は最後の手段にし、まずは実装で警告を解消できないか確認する。
- dynamic SOQL は任意文字列をそのまま入れず、許可リスト、describe、必要に応じた escape で入力を制限する。

## Apex テスト

振る舞いを追加・変更したら、対象を絞った Apex テストを追加または更新します。

- テストクラス名は原則 `<対象名>Test` にする。
- テストメソッド名は、期待する振る舞いが読める名前にする。
- テストデータはテスト内で作成し、組織内の既存データに依存しない。
- 既存の `TestDataFactory` が使える場合は優先し、作成だけの helper と insert する helper の責務を混ぜない。
- `System.runAs(...)` に渡す `User` は、原則としてテストクラス先頭の `private static User testUser = ...;` で一度取得し、各テストメソッド内で毎回 User query や user 取得 helper を呼ばない。
- 既存の `TestDataFactory.currentUser()` などがある場合は使ってよい。まだ user 取得 helper がないリポジトリでは、`private static User testUser = new User(Id = UserInfo.getUserId());` を使い、`System.runAs(...)` のためだけに helper 作成や User query を増やさない。
- 権限や profile の違いを確認するテストでは、必要な user をテストクラス先頭で用途別に用意し、メソッド内では `System.runAs(testUser)` のように参照する。
- 再利用するテストデータ作成クラスは、作成データの契約もテストで確認する。
- 正常系だけでなく、権限、入力不足、例外、bulk 件数、変更なし record など変更範囲に関係する境界も確認する。
- 各テストメソッドの中で必ず `System.runAs(...)` を宣言し、テスト対象の DML や assertion をその中で実行する。
- `System.runAs(...)` は、ApexUnitTestClassShouldHaveRunAs などの Code Analyzer ルールへの対応だけでなく、非設定オブジェクトと設定オブジェクトの DML が同じ transaction に混在して `MIXED_DML_OPERATION` になるリスクを避けるためにも使う。
- 検証には `System.assert`、`System.assertEquals`、`System.assertNotEquals` ではなく `Assert` クラスの関数を使う。
- `SeeAllData=true` は、既存データが必要な理由を説明できる場合だけ使う。
- coverage 数値を満たすためだけの assertion や、実装詳細に強く依存する brittle なテストを追加しない。

例:

```apex
@IsTest
private class MyServiceTest {
    private static User testUser = new User(Id = UserInfo.getUserId());

    @IsTest
    static void createsRecordWhenInputIsValid() {
        System.runAs(testUser) {
            Account actual = new Account(Name = 'Example');

            Assert.areEqual('Example', actual.Name);
        }
    }
}
```

## 静的解析

Apex を追加・更新したら、PR 前に Salesforce Code Analyzer の対象になることを前提に実装します。警告を抑止する前に、設計やテストの書き方で解消できるか確認します。

- ローカル確認では、変更範囲と目的に応じて `npm run code-analyzer` または `npm run code-analyzer:ci` を実行する。
- Code Analyzer の指摘は、Salesforce Apex とこのリポジトリの設計に照らして判断する。根拠が弱いものを欠陥として断定しない。
- `@SuppressWarnings` を使う場合は、対象 rule と抑止理由を作業報告に残す。
- test class の警告も無視しない。`System.runAs(...)`、テストデータ helper、メソッド名などで解消できる場合は修正する。

## テスト実行

開発中は必要に応じて変更対象に近いテストを絞って実行します。

```sh
sf apex run test --class-names MyServiceTest --result-format human --synchronous --target-org <alias>
```

複数クラスを確認する場合:

```sh
sf apex run test --class-names MyServiceTest,MyOtherServiceTest --result-format human --wait 30 --target-org <alias>
```

広めに確認する必要がある場合:

```sh
sf apex run test --test-level RunLocalTests --result-format human --synchronous --target-org <alias>
```

接続済み組織に対する test 実行は組織操作に含まれるため、実行前に対象と目的を確認します。
test は確認済みの Salesforce 組織に対してのみ実行し、`--target-org <alias>` で対象を明示します。明示依頼なしに default target org を切り替えません。
`<alias>` は実行前に確認した対象 org alias に置き換えます。

## Deploy validate と deploy start

デプロイ前の基本確認は `sf project deploy validate` です。Apex クラス、トリガー、または Salesforce メタデータを変更したら、作業対象 manifest、対象 metadata type を絞った `--metadata`、または標準 manifest のうち、変更範囲に合う scope で validate します。`deploy validate` は反映前チェックであり、ユーザーが動作確認できる状態とは扱いません。

Salesforce 組織の初回デプロイ / 再構築の標準検証は、全体 deploy に向かない metadata を含む `force-app` 全体ではなく、deploy 可能な scope を固定した manifest を使います。

```sh
npm run sf:validate:dev -- --target-org <alias>
```

通常の Apex / Salesforce メタデータ開発では、PR 作成前、またはユーザーへ作業完了や動作確認可能と報告する前に、validate に成功した同じ対象 org へ実 deploy します。

validate が成功したら、同じ対象 org へ反映します。

```sh
npm run sf:deploy:dev -- --target-org <alias>
```

PR マージまで依頼されている場合は、実 deploy と自動チェックの成功をもって、ユーザーの手動動作確認待ちは省略してよいです。本番環境への deploy は、ユーザーが本番リリースを明示した場合だけ実行します。

Apex を含む変更では、PR 作成前に関連 Apex テストを coverage 付きで確認します。コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、deploy 後の Apex テストは PR 作成前の確認にまとめます。

- 対象組織の確認: `sf config get target-org`、必要に応じて `sf org display --target-org <alias>`
- メタデータの整合性確認: `npm run sf:validate:dev -- --target-org <alias>`
- 変更範囲を絞った確認: `sf project deploy validate --metadata ApexClass:MyService --metadata ApexClass:MyServiceTest --target-org <alias>`
- 確認済みの組織への反映: `npm run sf:deploy:dev -- --target-org <alias>`
- PR 作成前の Apex 振る舞いと coverage 確認: `sf apex run test --class-names ... --code-coverage --target-org <alias>`

`sf project deploy preview` は標準の確認手段にしません。反映前は Git の差分確認と `sf project deploy validate` で確認します。
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
