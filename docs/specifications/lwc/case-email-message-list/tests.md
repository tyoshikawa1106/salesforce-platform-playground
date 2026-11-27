# ケースメールメッセージ一覧のテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

- 追加取得中のケース切り替え、元のケースへの往復、古い追加取得の成功・失敗を確認し、新しい一覧とカーソル、操作中状態が維持されること

- [CaseEmailMessageControllerTest](../../../../force-app/main/default/classes/CaseEmailMessageControllerTest.cls) で Case ID、null、Case 以外の ID、件数、Cursor直接取得、ページ応答を確認します。
- [CaseEmailMessageServiceTest](../../../../force-app/main/default/classes/CaseEmailMessageServiceTest.cls) で入力検証、初回取得位置、不正な取得位置、空ページ、問い合わせ条件を変更しないことを確認します。
- [CaseEmailMessageSelectorTest](../../../../force-app/main/default/classes/CaseEmailMessageSelectorTest.cls) で件数、ページ境界の直前・一致・直後、複数ページの重複防止、送信日時がないメール、Cursor作成後の削除行を確認します。
- [CaseEmailMessagePageWrapperTest](../../../../force-app/main/default/classes/CaseEmailMessagePageWrapperTest.cls) で空ページと次ページ情報を確認します。
- `caseEmailMessageList.test.js` でCOUNT後のCursor直接取得と命令的な初回ページ取得、活動タイムライン構造、曜日表示、送受信別のアイコンと補足文、本文の常時表示、空状態、エラー、再読み込み時の新しいCursor取得、下部ボタンからの追加読み込み、追加ページ境界の区切りを確認します。

### 画面操作を再現するテスト

| テストファイル                                                                                                                               | 代表的な確認内容                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [caseEmailMessageList.test.js](../../../../force-app/main/default/lwc/caseEmailMessageList/__tests__/caseEmailMessageList.test.js)           | 件数の再配信後も一覧の取得失敗を保持する。waits for an invalidated initial page before loading a recovered count。       |
| [caseEmailMessageListLogic.test.js](../../../../force-app/main/default/lwc/caseEmailMessageList/__tests__/caseEmailMessageListLogic.test.js) | メールを表示行へ変換して初期ページ状態を生成する。追加ページを連結して取得範囲を先頭行へ付加する。                       |
| [localError.test.js](../../../../force-app/main/default/lwc/caseEmailMessageList/__tests__/localError.test.js)                               | 画面固有の処理位置と例外の分類を維持する。                                                                               |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)                             | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。 |
| [salesforceApiUtils.test.js](../../../../force-app/main/default/lwc/salesforceApiUtils/__tests__/salesforceApiUtils.test.js)                 | ApexとUI APIの異なる応答形式を入力順で表示する。応答がない場合の既存メッセージと代替文言の優先順位を維持する。           |
