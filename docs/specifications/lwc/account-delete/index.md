# 取引先一括削除画面

## 概要

説明メッセージと実行ボタンから確認モーダルを表示し、取引先一括削除バッチを開始するLWCです。

## 目的・利用場面

開発環境で、実行ユーザーが参照できる法人・個人取引先を一括削除するときに使用します。

## 対象実装・メタデータ

Apex本体と同名Test、補助LWC、共通部品の対応は[画面・帳票の構成一覧](../../screen-and-report-components.md)も参照してください。

### 画面・JavaScript

| 種別       | 実装・設定                                                                                                     | 役割                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| LWC        | [accountDelete](../../../../force-app/main/default/lwc/accountDelete/accountDelete.js)                         | 一括削除の確認と実行状況を表示             |
| JavaScript | [accountDelete.js](../../../../force-app/main/default/lwc/accountDelete/accountDelete.js)                      | 初期取得、確認モーダル、Apex受付、状態更新 |
| JavaScript | [accountDeleteLogic.js](../../../../force-app/main/default/lwc/accountDelete/accountDeleteLogic.js)            | 実行可否、標準ジョブ状態の表示モデル       |
| LWC        | [accountDeleteConfirm](../../../../force-app/main/default/lwc/accountDeleteConfirm/accountDeleteConfirm.js)    | 削除確認のモーダルを表示                   |
| JavaScript | [accountDeleteConfirm.js](../../../../force-app/main/default/lwc/accountDeleteConfirm/accountDeleteConfirm.js) | キャンセル／実行結果を返す内部表示部品     |

### Apexコードと対応テスト

| Apex本体                                                                                                  | 役割                                                       | 同名Test                                                                                                          |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [AccountDeleteBatch](../../../../force-app/main/default/classes/AccountDeleteBatch.cls)                   | 参照可能な取引先を分割削除し、確定件数をfinishまで保持する | [AccountDeleteBatchTest](../../../../force-app/main/default/classes/AccountDeleteBatchTest.cls)                   |
| [AccountDeleteBatchScheduler](../../../../force-app/main/default/classes/AccountDeleteBatchScheduler.cls) | 登録ユーザーの権限で取引先削除バッチを定期起動             | [AccountDeleteBatchSchedulerTest](../../../../force-app/main/default/classes/AccountDeleteBatchSchedulerTest.cls) |
| [AccountDeleteBatchSelector](../../../../force-app/main/default/classes/AccountDeleteBatchSelector.cls)   | 取引先削除の対象と標準バッチジョブを検索                   | [AccountDeleteBatchSelectorTest](../../../../force-app/main/default/classes/AccountDeleteBatchSelectorTest.cls)   |
| [AccountDeleteBatchService](../../../../force-app/main/default/classes/AccountDeleteBatchService.cls)     | 取引先削除の実行条件判定、件数集計、実行者への通知を行う   | [AccountDeleteBatchServiceTest](../../../../force-app/main/default/classes/AccountDeleteBatchServiceTest.cls)     |
| [AccountDeleteBatchWrapper](../../../../force-app/main/default/classes/AccountDeleteBatchWrapper.cls)     | バッチが引き継ぐ取引先削除の集計結果                       | [AccountDeleteBatchWrapperTest](../../../../force-app/main/default/classes/AccountDeleteBatchWrapperTest.cls)     |
| [AccountDeleteController](../../../../force-app/main/default/classes/AccountDeleteController.cls)         | 取引先一括削除画面の入口                                   | [AccountDeleteControllerTest](../../../../force-app/main/default/classes/AccountDeleteControllerTest.cls)         |
| [AccountDeleteSelector](../../../../force-app/main/default/classes/AccountDeleteSelector.cls)             | 画面に表示する実行者自身の標準ジョブを検索                 | [AccountDeleteSelectorTest](../../../../force-app/main/default/classes/AccountDeleteSelectorTest.cls)             |
| [AccountDeleteService](../../../../force-app/main/default/classes/AccountDeleteService.cls)               | 画面の実行可否判定と受付応答を生成                         | [AccountDeleteServiceTest](../../../../force-app/main/default/classes/AccountDeleteServiceTest.cls)               |
| [AccountDeleteWrapper](../../../../force-app/main/default/classes/AccountDeleteWrapper.cls)               | 画面に返す受付結果と標準ジョブの状態                       | [AccountDeleteWrapperTest](../../../../force-app/main/default/classes/AccountDeleteWrapperTest.cls)               |
| [OrgEnvironment](../../../../force-app/main/default/classes/OrgEnvironment.cls)                           | 現在の Salesforce 組織の実行環境情報を提供                 | [OrgEnvironmentTest](../../../../force-app/main/default/classes/OrgEnvironmentTest.cls)                           |

テストの共通準備は[TestDataFactory](../../../../force-app/main/default/classes/TestDataFactory.cls)、その契約は[TestDataFactoryTest](../../../../force-app/main/default/classes/TestDataFactoryTest.cls)で確認できます。

[AccountDeleteBatchScheduler](../../../../force-app/main/default/classes/AccountDeleteBatchScheduler.cls)は画面から直接呼ぶクラスではなく、同じ削除バッチを起動する定期実行の入口です。

### 設定・権限

| 種別          | 実装・設定         | 役割                                                                                                                                                            |
| ------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 設定          | `AccountDelete`    | 取引先一括削除の専用タブ。`Salesforce`アプリのナビゲーションで末尾の「テストデータ一括削除」の直前に配置                                                        |
| PermissionSet | `LwcAccountDelete` | PermissionSet（表示ラベル: 「LWC：取引先一括削除」）: 専用タブ、関連Apexクラス、`RunAccountDelete`カスタム権限へのアクセス。Accountの参照・削除権限は付与しない |

### 構成上の補足

- バッチ側の処理と設定は[バッチ仕様](../../apex/batches/account-delete/index.md)を参照

Controllerが`Database.executeBatch(new AccountDeleteBatch(), 2000)`で直接バッチを登録します。画面用Service・Selectorはバッチ用クラスを呼びません。画面表示とジョブ検索は画面側のクラスだけで完結します。

## 入力

初期表示で実行状態を取得します。「実行」で確認モーダルを開き、モーダルの「実行」で開始します。「キャンセル」や閉じる操作では起動しません。「状態を更新」で最新の権限とジョブを取得します。

## 処理内容

1. 初回表示では環境・権限の拒否理由と自身の直近実行を取得します。ジョブIDを保持した後の状態確認では、そのIDを検索条件に指定します。実行者・バッチクラス・ジョブ種別も限定し、該当しない場合は最新ジョブへ切り替えません。
2. 参照できる全取引先が対象であること、個人取引先を削除すると対応する取引先責任者も削除されることを案内します。
3. 確認中・通信中の二重操作を防止し、確認結果がtrueのときだけApexへ要求します。
4. サーバーが返したジョブIDと受付メッセージを表示します。受付成功を削除完了とは扱いません。
5. 同じジョブの終端状態を再取得するまで再実行を禁止します。

## 出力・更新対象

画面には標準ジョブの状態とIDを表示します。削除の成功・失敗件数は結果メールで確認します。ジョブの完了だけでは全件の削除成功を意味しません。

### 実行状況の表示

受付直後は「待機中」、サーバーのジョブ状態がProcessingの場合は「進行中」、Completedの場合は「完了」と表示します。今回受け付けたジョブと異なる過去の完了状態は表示しません。

「実行状況を確認」ボタンで最新の処理状態を取得します。状態は自動更新されず、その旨を画面に表示します。取得に失敗した場合は、受付済みジョブIDを保持し、状態は「状態未確認」と表示します。

画面を開いた時点ですでに終了しているジョブは、ジョブIDと処理状態を表示しません。画面上で受け付けたジョブ、または実行中に確認したジョブは、その画面を開いている間は終了状態まで表示します。画面を開き直すと、過去の終了結果は表示対象から外れます。

## 権限・実行条件

`LwcAccountDelete`権限セットと、既存のAccount参照・削除権限が必要です。画面の無効状態だけで保護せず、開始時および非同期の削除直前にもサーバーで検証します。

## エラー処理

操作・取得処理と子部品の例外は[画面内の共通エラー表示](../ui-error-boundary/index.md)で処理場所・種類を表示します。`uiErrorBoundary.js`、`uiErrorPanel.js`、`errorUtils.js`を利用し、既存の業務エラーと操作可否は維持します。診断ログはエラー時だけ生成します。

状態更新で自身の標準ジョブの完了・失敗・中断を確認します。

通信・モーダルの失敗では内部の例外を公開せず、固定メッセージを表示します。受付応答が不明な場合は開始ボタンを無効にし、状態更新とApexジョブの確認を案内します。受付後の取得失敗でも確認済みジョブIDを保持します。別ジョブの古い完了応答では再実行を許可しません。

## 関連コンポーネント

- [取引先一括削除バッチ](../../apex/batches/account-delete/index.md)
- [取引先一括削除の定期実行](../../apex/schedulers/account-delete/index.md)
- 標準`lightning/modal`: フォーカス管理と閉じる操作

## テスト・確認観点

`accountDelete.test.js`で確認・キャンセル・連打・権限拒否・通信失敗・再取得、`accountDeleteLogic.test.js`で状態判定、`accountDeleteConfirm.test.js`で親への確認結果を検証します。DOMのアクセシビリティを明示チェックします。標準モーダルの実ブラウザ挙動はChromeで別途確認します。

## 制約・注意事項

専用の「取引先一括削除」タブから開けます。App Builderのアプリケーションページとホームページへも配置できます。特定のFlexiPageは変更しません。自動ポーリングは行いません。開始後に画面を閉じてもバッチは継続します。

## 既知の差異・確認事項

- 比較元はIssue #772。
- 専用タブを入口として提供します。Chromeでの実削除操作と実メール配信は組織への反映後に確認します。
