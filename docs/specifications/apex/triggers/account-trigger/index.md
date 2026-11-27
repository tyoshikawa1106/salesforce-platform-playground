# 取引先トリガー

## 機能の用途

取引先の作成前、更新前に、取引先に対する自動処理を実行するApexトリガーです。現在は取引先名の法人格正規化を実行します。

画面、API、Flow、データ投入など、取引先の保存経路にかかわらず、取引先共通の自動処理を適用するために利用します。

## 対象メタデータ

| 種別         | API 名                                                                                           | 役割                                       |
| ------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Apex Trigger | [AccountTrigger](../../../../../force-app/main/default/triggers/AccountTrigger.trigger)          | 作成前、更新前の処理振り分け               |
| Apex Class   | [AccountTriggerHandler](../../../../../force-app/main/default/classes/AccountTriggerHandler.cls) | トリガー実行情報をサービスクラスへ引き渡す |
| Apex Class   | [AccountTriggerService](../../../../../force-app/main/default/classes/AccountTriggerService.cls) | 取引先名の変更判定と法人格の正規化         |

### 対応テスト

| Apex本体                | 対応するテストクラス                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `AccountTriggerHandler` | [AccountTriggerHandlerTest](../../../../../force-app/main/default/classes/AccountTriggerHandlerTest.cls) |
| `AccountTriggerService` | [AccountTriggerServiceTest](../../../../../force-app/main/default/classes/AccountTriggerServiceTest.cls) |

### 関連コンポーネント

- Account標準オブジェクト
- 取引先を作成、更新する画面、API、Flow、データ投入処理

## アクセスするデータ・項目

- `Account.Name` の正規化後の値
- Trigger内で追加のDMLは実行しません。
- 略称を含まない文字列と、更新時に変更されていないNameは変更しません。

## 起動条件・入力

- `before insert`: `Trigger.new` の取引先
- `before update`: `Trigger.new` と `Trigger.oldMap` の取引先

対象項目は `Account.Name` です。

- 置換対象:
    - `㈱`、`（株）`、`(株)`
    - `㈲`、`（有）`、`(有)`

### 権限・実行条件

- Accountの `before insert` または `before update` で実行されます。
- `with sharing` のHandlerとServiceを使用します。
- 取引先の作成または更新を実行できることが前提です。

## エラー判定

Trigger 全体の独自例外処理はありません。未処理の例外が発生した場合は取引先の保存処理全体が失敗します。

## 処理詳細

| タイミング                | 処理                   | 呼び出し先                              |
| ------------------------- | ---------------------- | --------------------------------------- |
| 作成前（`before insert`） | 入力された名称の正規化 | `normalizeAccountNamesForInsert`        |
| 更新前（`before update`） | 変更された名称の正規化 | `normalizeChangedAccountNamesForUpdate` |

### 法人格正規化

1. 作成時は、Nameが空でないすべての取引先を対象にします。
2. 更新時は、Nameが変更された取引先だけを対象にします。
   `oldMap` または対応する更新前レコードを取得できない場合は、変更済みとして正規化します。
3. 株式会社の定義済み略称を、元の位置を保ったまま `株式会社` へ置換します。
4. 有限会社の定義済み略称を、元の位置を保ったまま `有限会社` へ置換します。
5. beforeコンテキストのレコードへ直接反映します。

### 制約・注意事項

- 取引先では一オブジェクト一トリガーを原則とし、自動処理を追加する場合も `AccountTrigger` からハンドラーへ振り分けます。
- トリガー本体にはユースケースの詳細処理を実装せず、ハンドラーまたはサービスクラスへ委譲します。
- 対象は株式会社と有限会社の定義済み表記だけです。
- 合同会社、合資会社、一般社団法人などは正規化しません。
- 略称の位置を法人格として妥当か判定せず、文字列中に存在すれば置換します。
- 正規化済みの `株式会社`、`有限会社` は変更しません。

### 大量データとGovernor Limits

- Trigger、Handler、Serviceはリスト単位で処理し、レコードループ内でSOQLやDMLを実行しません。
- 現行の名称正規化は追加のSOQL、DML、非同期処理を実行しません。
- `AccountTriggerHandlerTest.shouldNormalizeCompanyAbbreviationsWhenBulkInserted` でTriggerの実行単位をまたぐ一括登録を検証します。

### 既知の差異・確認事項

- 状態: 未確認（承認済み要求との比較）
- 現行実装は `AccountTrigger`、関連Apexクラス、代表テストから確認しています。
- 承認済み要求または外部契約の管理元をリポジトリ内で確認できないため、要求との差異は判定していません。

### テストコードと確認内容

[テストコードと確認内容](tests.md)
