# 外部クライアントアプリ認証管理のテストコード

[機能仕様に戻る](index.md)

Apexテストは、入力の検証と、Salesforce APIに送る要求や応答の扱いを確認します。Jestテストは、画面を操作したときの表示と、画面からApexに渡す要求を確認します。

## テストコード一覧

| テスト                                                                                                                                                                 | 主な確認内容                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ExternalClientAppManagerApiClientTest](../../../../force-app/main/default/classes/ExternalClientAppManagerApiClientTest.cls)                                          | アプリの除外条件、検索語のエスケープ、取得上限、接続先とユーザーの照合を確認する。認証開始URLの検証や、通信エラーと不正な応答の扱いも確認する。                                                                                                                            |
| [ExternalClientAppManagerServiceTest](../../../../force-app/main/default/classes/ExternalClientAppManagerServiceTest.cls)                                              | 入力値、対象アプリ、ステージの状態を検証する。API応答から候補を取り出せること、画面に返す項目に鍵や秘密が含まれないことを確認する。                                                                                                                                        |
| [ExternalClientAppManagerControllerTest](../../../../force-app/main/default/classes/ExternalClientAppManagerControllerTest.cls)                                        | 検索条件と対象IDがAPIに渡ることを確認する。生成・適用・削除については、HTTPメソッド、パス、本文、呼び出し順と回数を照合し、失敗後に再送や後続処理が発生しないことを確認する。                                                                                              |
| [externalClientAppManager.test.js](../../../../force-app/main/default/lwc/externalClientAppManager/__tests__/externalClientAppManager.test.js)                         | 初期候補に含まれないアプリの検索、キーボード操作、フォーカス、認証前後の表示を確認する。検索結果が前後して届いた場合や、画面に戻った場合の表示も確認する。アクセシビリティも検証する。更新・削除では、キャンセル、二重送信の防止、自動削除の条件、失敗時の停止を確認する。 |
| [externalClientAppManagerLogic.test.js](../../../../force-app/main/default/lwc/externalClientAppManager/__tests__/externalClientAppManagerLogic.test.js)               | 検索候補とステージ一覧の表示、IDの正規化、ステージのIDと状態の照合、状態ごとの案内を確認する。内部エラーの詳細が画面に表示されないことも確認する。                                                                                                                         |
| [externalClientAppCredentialModal.test.js](../../../../force-app/main/default/lwc/externalClientAppCredentialModal/__tests__/externalClientAppCredentialModal.test.js) | 入力したIDが一致しないときに確認ダイアログが開いたままになり、IDを修正して再試行できることを確認する。                                                                                                                                                                     |

## 対象アプリのIDを照合する

確認ダイアログのJestテストでは、異なるIDを入力して［適用］を押します。入力欄にエラーが表示され、ダイアログを閉じる処理が呼ばれないことを確認します。続けて正しいIDを入力すると、ダイアログはそのIDを呼び出し元に返します。

Apex側では、`ExternalClientAppManagerServiceTest` のテストメソッド `validatesConfirmationId` が同じアプリの15桁と18桁のIDをそれぞれ渡し、どちらでも対象を特定できることを確認します。別のアプリのIDや空文字を渡した場合は、検証エラーになることを確認します。

## ［適用］を続けて押しても更新は一度だけ実行する

画面のJestテストでは、ステージが空の状態で［適用］を続けて2回押します。確認ダイアログが開くのは1回で、Apexに渡した操作は一覧取得、生成、適用の順に各1回です。完了後は旧資格情報が「適用済み」と表示され、削除ボタンが表示されることも確認します。

未適用の資格情報が1件残っている場合は、一覧取得と生成の間に削除要求が入ります。テストでは、削除要求にその行のIDと状態が入っていることまで照合します。

## 削除後も資格情報が残っている場合

`ExternalClientAppManagerControllerTest` のテストメソッド `rejectsUnconfirmedDeletion` はHTTP通信をモックに置き換え、DELETEには成功応答を返し、直後のGETには削除対象が残った一覧を返します。この条件で処理結果が `unconfirmed`（完了を確認できない）になることを確認します。これにより、削除の成否を最新の一覧で判断する仕様を検証します。

## 生成結果が画面を離れた後に届く場合

画面のJestテストでは、生成要求への応答を保留したままコンポーネントを画面から取り外し、同じコンポーネントを再表示します。その後で保留していた生成成功の応答を返し、Apexへの呼び出し履歴に適用要求が含まれていないことを確認します。
