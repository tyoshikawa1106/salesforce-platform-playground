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
- `status` は通常 `Active` にする。変更理由がある場合は作業報告に残す。
- 新規 Apex は、役割が分かる名前にする。用途が広すぎる名前は避ける。
- 既存クラスの責務を広げる前に、既存の呼び出し元とテスト影響を確認する。

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

## Apex テスト

振る舞いを追加・変更したら、対象を絞った Apex テストを追加または更新します。

- テストクラス名は原則 `<対象名>Test` にする。
- テストメソッド名は、期待する振る舞いが読める名前にする。
- テストデータはテスト内で作成し、組織内の既存データに依存しない。
- 正常系だけでなく、権限、入力不足、例外など変更範囲に関係する境界も確認する。
- 検証には `System.assert`、`System.assertEquals`、`System.assertNotEquals` ではなく `Assert` クラスの関数を使う。
- `SeeAllData=true` は、既存データが必要な理由を説明できる場合だけ使う。

例:

```apex
@IsTest
private class MyServiceTest {
    @IsTest
    static void createsRecordWhenInputIsValid() {
        Account actual = new Account(Name = 'Example');

        Assert.areEqual('Example', actual.Name);
    }
}
```

## テスト実行

開発中は必要に応じて変更対象に近いテストを絞って実行します。

```sh
sf apex run test --class-names MyServiceTest --result-format human --synchronous
```

複数クラスを確認する場合:

```sh
sf apex run test --class-names MyServiceTest,MyOtherServiceTest --result-format human --synchronous
```

広めに確認する必要がある場合:

```sh
sf apex run test --test-level RunLocalTests --result-format human --synchronous
```

接続済み組織に対する test 実行は組織操作に含まれるため、実行前に対象と目的を確認します。
test は現在接続されている Salesforce 組織に対してのみ実行し、明示依頼なしに target org を切り替えません。

## Deploy validate と deploy start

デプロイ前の基本確認は `sf project deploy validate` です。Apex クラス、トリガー、または Salesforce メタデータを変更したら、変更単位で `deploy validate` と `deploy start` を実行し、現在接続中の組織へ反映します。

Salesforce 組織への標準検証は、全体 deploy に向かない metadata を含む `force-app` 全体ではなく、deploy 可能な scope を固定した manifest を使います。

```sh
npm run sf:validate:dev
```

validate が成功したら、同じ現在接続中の組織へ反映します。

```sh
npm run sf:deploy:dev
```

Apex を含む変更では、PR 作成前に関連 Apex テストを coverage 付きで確認します。コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、deploy 後の Apex テストは PR 作成前の確認にまとめます。

- 対象組織の確認: `sf config get target-org`
- メタデータの整合性確認: `npm run sf:validate:dev`
- 現在接続中の組織への反映: `npm run sf:deploy:dev`
- PR 作成前の Apex 振る舞いと coverage 確認: `sf apex run test --class-names ... --code-coverage`

`sf project deploy preview` は標準の確認手段にしません。反映前は Git の差分確認と `sf project deploy validate` で確認します。
明示依頼がない限り、`--target-org` 指定やデフォルト組織の切り替えで別組織へデプロイしません。

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
- 実行した `sf project deploy validate` と `sf project deploy start`
- PR 作成前に実行した `sf apex run test --code-coverage`
- Apex テストの成功件数と coverage、または PR 作成前にまとめる理由
- 実行しなかった確認と、その理由
