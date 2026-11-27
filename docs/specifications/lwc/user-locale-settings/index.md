# 言語・地域

## 機能の用途

Lightningホームでログインユーザーの言語と地域を参照・変更するLWCです。日本語と英語を先頭に表示し、言語変更時に地域の初期値を設定します。

個人設定画面へ移動せず、ホームで表示言語や日付・数値の地域設定を切り替えます。

### 権限・実行条件

- `LwcUserLocaleSettings`は`UserLocaleSettingsController`へのアクセスだけを付与します。ユーザー管理権限は追加しません。
- `with sharing`、`WITH USER_MODE`、`AccessLevel.USER_MODE`を使用します。
- Userおよび対象2項目の更新可否をDescribeで確認し、権限不足では編集不可とします。保存時も再確認します。
- ホームへの割り当ては既存の`HomeFlexiPage`を使用します。

## 対象メタデータ

| 実装・設定                                                                                                                 | 役割                                                       |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [userLocaleSettings.js](../../../../force-app/main/default/lwc/userLocaleSettings/userLocaleSettings.js)                   | 取得・編集・保存・再読み込みと画面状態の制御               |
| [userLocaleSettingsLogic.js](../../../../force-app/main/default/lwc/userLocaleSettings/userLocaleSettingsLogic.js)         | 候補の表示順、言語から地域への対応、表示値と保存要求の生成 |
| [userLocaleSettings.html](../../../../force-app/main/default/lwc/userLocaleSettings/userLocaleSettings.html)               | 参照・編集・失敗時の表示                                   |
| [userLocaleSettings.js-meta.xml](../../../../force-app/main/default/lwc/userLocaleSettings/userLocaleSettings.js-meta.xml) | Lightningホームへの公開                                    |
| [UserLocaleSettingsController](../../../../force-app/main/default/classes/UserLocaleSettingsController.cls)                | 公開API、取得・検証の順序、本人設定のDML                   |
| [UserLocaleSettingsService](../../../../force-app/main/default/classes/UserLocaleSettingsService.cls)                      | 選択肢、権限・入力検証、更新レコードの生成                 |
| [UserLocaleSettingsSelector](../../../../force-app/main/default/classes/UserLocaleSettingsSelector.cls)                    | 本人の設定取得                                             |
| [UserLocaleSettingsWrapper](../../../../force-app/main/default/classes/UserLocaleSettingsWrapper.cls)                      | 現在値、選択肢、編集可否、処理結果                         |
| [LwcUserLocaleSettings](../../../../force-app/main/default/permissionsets/LwcUserLocaleSettings.permissionset-meta.xml)    | 公開Controllerへのアクセス                                 |
| [HomeFlexiPage](../../../../force-app/main/default/flexipages/HomeFlexiPage.flexipage-meta.xml)                            | ホームのsidebar領域でアシスタントの直後に配置              |

### 関連コンポーネント

- Salesforce標準のUser、Lightningホーム、Lightning基本コンポーネント。
- [LWC機能仕様一覧](../index.md)。

### 対応するApexテスト

| テスト対象のApexクラス         | テストクラス                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `UserLocaleSettingsController` | [UserLocaleSettingsControllerTest](../../../../force-app/main/default/classes/UserLocaleSettingsControllerTest.cls) |
| `UserLocaleSettingsSelector`   | [UserLocaleSettingsSelectorTest](../../../../force-app/main/default/classes/UserLocaleSettingsSelectorTest.cls)     |
| `UserLocaleSettingsService`    | [UserLocaleSettingsServiceTest](../../../../force-app/main/default/classes/UserLocaleSettingsServiceTest.cls)       |
| `UserLocaleSettingsWrapper`    | [UserLocaleSettingsWrapperTest](../../../../force-app/main/default/classes/UserLocaleSettingsWrapperTest.cls)       |

## アクセスするデータ・項目

- 更新対象は本人の`User.LanguageLocaleKey`と`User.LocaleSidKey`です。
- タイムゾーン、通貨、メール文字コード、他ユーザーの設定は更新しません。
- 参照時は現在値の表示名を出し、候補から外れた値もコードを表示して保持します。

### SOQLで参照するデータ

```sql
SELECT Id, LanguageLocaleKey, LocaleSidKey
FROM User
WHERE Id = :currentUserId
WITH USER_MODE
LIMIT 1
```

## 操作

- 編集、言語・地域の選択、保存、キャンセル、取得失敗後の再読み込み。
- 言語と地域の候補はUser項目のDescribe結果のうち有効な値です。
- 保存処理の入力は言語コードと地域コードだけです。ユーザーIDや更新用SObjectは受け取りません。

## エラー判定

- 取得失敗はエラーと再読み込みボタンを表示し、編集を禁止します。
- 不正な候補・未入力・権限不足は更新前に拒否します。
- 保存失敗は同じカード内に表示し、編集内容を保持して再試行できます。
- 内部例外の本文・スタックトレースを表示・記録しません。
- 保存成功後の再読み込みだけが失敗した場合は、保存済みであることと手動再読み込みの案内を表示します。

## 処理詳細

1. 接続時に`getSettings`で本人の最新設定を取得し、参照表示します。取得応答のクライアントキャッシュは使用しません。
2. 編集時に保存値を編集用の値へコピーします。現在の言語と地域の組み合わせは変更しません。
3. 言語を変更するとLogicの対応表、地域コードとの完全一致、一意な同言語の地域候補の順に初期値を決めます。候補が決まらない場合は地域を未選択にし、明示選択を求めます。
4. 地域は候補全体から個別に選択できます。言語と地域の組み合わせを保存時の制約にはしません。同じ言語の変更通知では手動選択した地域を保持します。
5. 保存時は画面とサーバーの両方で候補を検証します。サーバーで更新対象をログインユーザーに固定し、言語・地域を同時に更新します。
6. 保存成功後に参照表示へ戻し、標準画面へ反映するためページを再読み込みします。
7. キャンセル時は編集値を破棄します。保存中はキャンセル・入力・再保存を禁止します。

日本語と英語を優先し、ほかの言語は表示名順に並べます。言語から地域への初期値は`userLocaleSettingsLogic.js`を正とし、有効な地域候補に存在する場合だけ設定します。

### 状態遷移

取得中は編集不可です。取得成功後は参照から編集へ進み、保存失敗では入力値を保持した編集状態、保存成功またはキャンセルでは参照状態になります。切断後の古い応答は採用せず、再接続時は現在値を取得し直します。切断前にサーバーへ送信された保存自体は取り消しません。

保存中に同じコンポーネントが再接続された場合は、保存の成功・拒否・通信失敗の応答を待ってから現在値を取得します。待機中は編集を禁止し、再接続を繰り返しても最新の接続だけが取得を開始します。切断前の保存応答によるページの再読み込みは行いません。

### 制約・注意事項

- 画面の固定ラベルと案内は日本語です。選択肢の表示名はSalesforceの返却値を使用します。
- 組織で有効な言語だけを選べます。この機能は組織の言語設定を変更しません。
- 言語と地域の対応はこの画面の初期値補完です。標準個人設定などからの更新に同じ対応を強制しません。
- 保存は本人の2項目を同時に上書きします。別画面で同時に変更した場合の競合検知は行いません。
- Apex Controllerの想定外例外の捕捉経路は、通常の管理者テストで再現できる障害を前提にしていません。カバレッジのための本体分岐は追加しません。

### 既知の差異・確認事項

- 状態: 未確認。
- 実装と対応テストから現行動作を確認しています。独立した要求文書がないため、外部の要求正本との比較は未確認です。
- 管理者以外のプロファイル・ライセンスによる自己更新の可否は、対象利用者の権限で確認が必要です。

### テストコード

[テストコードと確認内容](tests.md)
