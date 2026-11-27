# ケース取引先責任者プロフィールのテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

`caseContactProfile.test.js` で次を確認します。

- ContactとCaseのAccountがある場合の全項目、別タブで開くリンク、人物アイコン
- 会社名の上に人物情報との区切り罫線があること
- CaseのAccountをContactのAccountより優先すること
- CaseにAccountがない場合にContactのAccountを使用すること
- ContactとAccountのCase件数、0件、取得上限の超過表示、取得エラー
- ContactとAccountがない場合にWeb-to-Case項目を使用し、レコードリンクを表示しないこと
- 取得値がない項目の `-` 表示
- 読み込み中と取得エラー
- 各主要状態のアクセシビリティ

### 画面操作を再現するテスト

| テストファイル                                                                                                                         | 代表的な確認内容                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [caseContactProfile.test.js](../../../../force-app/main/default/lwc/caseContactProfile/__tests__/caseContactProfile.test.js)           | ケース切替直後は旧プロフィールとリンクを表示しない。removes old links while new parent URLs are pending and keeps them absent on failure。 |
| [caseContactProfileLogic.test.js](../../../../force-app/main/default/lwc/caseContactProfile/__tests__/caseContactProfileLogic.test.js) | ContactとCase Accountを優先してプロフィールを生成する。ContactとAccountがない場合はWeb入力と代替値を使用する。                             |
| [localError.test.js](../../../../force-app/main/default/lwc/caseContactProfile/__tests__/localError.test.js)                           | 画面固有の処理位置と例外の分類を維持する。                                                                                                 |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)                       | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。                   |
