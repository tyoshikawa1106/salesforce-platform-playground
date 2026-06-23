# Apex 開発ルール

Apex クラス、トリガー、Apex テストを追加・更新するときの実務ルールです。

## 基本方針

- Apex と Salesforce メタデータは `force-app/main/default` 配下を正本にする。
- `.cls` を追加・更新する場合は、対応する `-meta.xml` も一緒に扱う。
- 振る舞いを変える前に、関連する Object、Field、Flow、Validation Rule、Permission Set への依存を確認する。
- 組織設定や権限から確認できない仕様を、Apex 側で推測して固定しない。
- 本番や Dev 組織に依存する値、認証情報、個人環境の値を Apex やメタデータに入れない。

## クラスとメタデータ

クラス本体は `.cls`、メタデータは `.cls-meta.xml` で管理します。

- `apiVersion` は、既存メタデータとプロジェクトの対象バージョンに合わせる。
- `status` は通常 `Active` にする。変更理由がある場合は作業報告に残す。
- 新規 Apex は、役割が分かる名前にする。用途が広すぎる名前は避ける。
- 既存クラスの責務を広げる前に、既存の呼び出し元とテスト影響を確認する。

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

Dev 組織への標準検証は、全体 deploy に向かない metadata を含む `force-app` 全体ではなく、deploy 可能な scope を固定した manifest を使います。

```sh
npm run sf:validate:dev
```

validate が成功したら、同じ現在接続中の組織へ反映します。

```sh
npm run sf:deploy:dev
```

Apex を含む変更では、PR 作成前に関連 Apex テストを coverage 付きで確認します。コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、deploy 後の Apex テストは PR 作成前の確認にまとめます。

- 対象組織の確認: `sf org display`
- メタデータの整合性確認: `npm run sf:validate:dev`
- 現在接続中の組織への反映: `npm run sf:deploy:dev`
- PR 作成前の Apex 振る舞いと coverage 確認: `sf apex run test --class-names ... --code-coverage`

現在の Dev 組織には source tracking がないため、`sf project deploy preview` は標準の確認手段にしません。
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
- 対象 Salesforce 組織の alias / username
- 実行した `sf project deploy validate` と `sf project deploy start`
- PR 作成前に実行した `sf apex run test --code-coverage`
- Apex テストの成功件数と coverage、または PR 作成前にまとめる理由
- 実行しなかった確認と、その理由
