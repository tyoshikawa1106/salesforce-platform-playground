# 取引先情報PDFのテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

- [AccountPdfControllerTest](../../../../force-app/main/default/classes/AccountPdfControllerTest.cls): 正常な取引先、parameter未指定、不正ID、別SObject ID、不存在レコード、安全なエラー
- [AccountPdfServiceTest](../../../../force-app/main/default/classes/AccountPdfServiceTest.cls): ID検証、空項目、住所改行、日本語、HTMLに見える文字列、説明の複数行
- [AccountPdfSelectorTest](../../../../force-app/main/default/classes/AccountPdfSelectorTest.cls): 利用者権限による出力項目取得、null、不存在レコード
- [AccountPdfViewModelTest](../../../../force-app/main/default/classes/AccountPdfViewModelTest.cls): 空項目の代替表示
- `accountPdfExport.test.js`: URL生成、新しいタブ、IDエラー、二重実行防止、起動失敗Toast
- `accountPdfExportLogic.test.js`: 15桁・18桁の取引先ID判定とVisualforce URL encoding
- 接続org: Lightningからの起動、日本語、空項目、長いURL、複数行と空行、改ページ、権限不足、PDFの表示・ダウンロード・印刷

### 画面操作を再現するテスト

| テストファイル                                                                                                                   | 代表的な確認内容                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [accountPdfExport.test.js](../../../../force-app/main/default/lwc/accountPdfExport/__tests__/accountPdfExport.test.js)           | generates the Visualforce URL and opens it in a new tab。shows an error toast when the record ID is missing。            |
| [accountPdfExportLogic.test.js](../../../../force-app/main/default/lwc/accountPdfExport/__tests__/accountPdfExportLogic.test.js) | accepts 15 and 18 character Account IDs。rejects missing malformed and non-Account IDs。                                 |
| [localError.test.js](../../../../force-app/main/default/lwc/accountPdfExport/__tests__/localError.test.js)                       | 画面固有の処理位置と例外の分類を維持する。                                                                               |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)                 | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。 |
