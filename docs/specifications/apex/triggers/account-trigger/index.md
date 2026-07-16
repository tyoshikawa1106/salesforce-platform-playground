# 取引先トリガー

## 概要

取引先の作成前、更新前に、取引先に対する自動処理を実行するApexトリガーです。現在は取引先名の法人格正規化を実行します。

## 目的・利用場面

画面、API、Flow、データ投入など、取引先の保存経路にかかわらず、取引先共通の自動処理を適用するために利用します。

## 対象実装・メタデータ

| 種別         | API 名                  | 役割                                       |
| ------------ | ----------------------- | ------------------------------------------ |
| Apex Trigger | `AccountTrigger`        | 作成前、更新前の処理振り分け               |
| Apex Class   | `AccountTriggerHandler` | トリガー実行情報をサービスクラスへ引き渡す |
| Apex Class   | `AccountTriggerService` | 取引先名の変更判定と法人格の正規化         |

## 入力

- `before insert`: `Trigger.new` の取引先
- `before update`: `Trigger.new` と `Trigger.oldMap` の取引先

## 処理内容

| タイミング    | 処理                   | 呼び出し先                              | 詳細                                                    |
| ------------- | ---------------------- | --------------------------------------- | ------------------------------------------------------- |
| before insert | 取引先名の法人格正規化 | `normalizeAccountNamesForInsert`        | [取引先名の法人格正規化](account-name-normalization.md) |
| before update | 変更された名称の正規化 | `normalizeChangedAccountNamesForUpdate` | [取引先名の法人格正規化](account-name-normalization.md) |

## 出力・更新対象

- before処理を反映した `Trigger.new` の取引先
- 個別の更新項目は各詳細仕様に記載します。

## 権限・実行条件

- Accountの `before insert` または `before update` で実行されます。
- `with sharing` のHandlerとServiceを使用します。
- 取引先の作成または更新を実行できることが前提です。

## エラー処理

Trigger 全体の独自例外処理はありません。個別処理のエラーは各詳細仕様に記載します。未処理の例外が発生した場合は取引先の保存処理全体が失敗します。

## 関連コンポーネント

- [取引先名の法人格正規化](account-name-normalization.md)
- Account標準オブジェクト
- 取引先を作成、更新する画面、API、Flow、データ投入処理

## テスト・確認観点

- `AccountTriggerHandlerTest` で、before insert、before update、251件の一括登録をTrigger経由で確認すること
- `AccountTriggerServiceTest` で、名称変更判定、空入力、更新前レコードが取得できない場合をService単位で確認すること
- 各詳細仕様に記載されたテスト観点を確認すること

## 制約・注意事項

- 取引先では一オブジェクト一トリガーを原則とし、自動処理を追加する場合も `AccountTrigger` からハンドラーへ振り分けます。
- トリガー本体にはユースケースの詳細処理を実装せず、ハンドラーまたはサービスクラスへ委譲します。
- 個別処理の制約は詳細仕様に記載します。

### 大量データとGovernor Limits

- Trigger、Handler、Serviceはリスト単位で処理し、レコードループ内でSOQLやDMLを実行しません。
- 現行の名称正規化は追加のSOQL、DML、非同期処理を実行しません。
- `AccountTriggerHandlerTest.shouldNormalizeCompanyAbbreviationsWhenBulkInserted` で251件の一括登録を検証します。

## 既知の差異・確認事項

- 状態: 現行実装確認済み、承認済み要求との差異は未判定
- 現行実装は `AccountTrigger`、関連Apexクラス、代表テストから確認しています。
- 承認済み要求または外部契約の管理元をリポジトリ内で確認できないため、要求との差異は判定していません。
