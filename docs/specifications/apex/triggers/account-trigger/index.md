# AccountTrigger

## 概要

Accountの作成前、更新前に、取引先に対する自動処理を実行するApex Triggerです。現在は取引先名の法人格正規化を実行します。

## 目的・利用場面

画面、API、Flow、データ投入など、取引先の保存経路にかかわらず、Account共通の自動処理を適用するために利用します。

## 対象メタデータ

| 種別         | API名                   | 役割                                   |
| ------------ | ----------------------- | -------------------------------------- |
| Apex Trigger | `AccountTrigger`        | 作成前、更新前の処理振り分け           |
| Apex Class   | `AccountTriggerHandler` | TriggerコンテキストからServiceへの委譲 |
| Apex Class   | `AccountTriggerService` | 現在のユースケースである名称正規化     |

## 入力

- `before insert`: `Trigger.new` の取引先
- `before update`: `Trigger.new` と `Trigger.oldMap` の取引先
- 各Triggerコンテキストで渡されるAccountレコード
- 現在の処理では `Account.Name` を参照します。

## 処理内容

| タイミング    | 処理                   | 呼び出し先                              | 詳細                                                    |
| ------------- | ---------------------- | --------------------------------------- | ------------------------------------------------------- |
| before insert | 取引先名の法人格正規化 | `normalizeAccountNamesForInsert`        | [取引先名の法人格正規化](account-name-normalization.md) |
| before update | 変更された名称の正規化 | `normalizeChangedAccountNamesForUpdate` | [取引先名の法人格正規化](account-name-normalization.md) |

## 出力・更新対象

- 現在は `Account.Name` の正規化後の値
- Trigger内で追加のDMLは実行しません。

## 権限・実行条件

- Accountの `before insert` または `before update` で実行されます。
- `with sharing` のHandlerとServiceを使用しますが、処理対象はTriggerから渡されたレコードのNameだけです。
- 取引先の作成または更新を実行できることが前提です。

## エラー処理

独自の例外処理やエラーメッセージはありません。予期しない例外が発生した場合は取引先の保存処理全体が失敗します。

## 関連コンポーネント

- [取引先名の法人格正規化](account-name-normalization.md)
- Account標準オブジェクト
- 取引先を作成、更新する画面、API、Flow、データ投入処理

## テスト・確認観点

- before insert、before updateで対応するHandlerメソッドだけが呼ばれること
- 複数レコードを一括登録、更新しても同じ規則が適用されること
- 各ユースケースの詳細仕様に記載された観点を確認すること

## 制約・注意事項

- Accountでは一オブジェクト一Triggerを原則とし、自動処理を追加する場合も `AccountTrigger` からHandlerへ振り分けます。
- Trigger本体にはユースケースの詳細処理を実装せず、HandlerまたはServiceへ委譲します。
- 個別処理の制約は詳細仕様に記載します。
