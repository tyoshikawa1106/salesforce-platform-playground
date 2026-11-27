# 最近の問い合わせのテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

- 顧客・会社のリンク生成が応答順と逆順に完了しても最新一覧を維持し、後続の関連リスト取得エラーを古いカードで上書きしないこと

`caseRelatedCaseList.test.js`で次を確認します。

- 顧客と会社の2タブが表示されること
- タブが標準タブとして表示されること
- タブ領域の左右と下にカード外周からの余白があること
- タブ内コンテンツには左右の余白がないこと
- ContactとAccountそれぞれの関連ケースがカード表示されること
- 表示中Caseを含めてリンクなしで表示し、別Caseと合わせて作成日時の降順で表示上限に制限すること
- Caseの項目ラベルが表示言語・項目名変更に追従することと、参照できない項目が表示されないこと
- 表示中Caseだけに「現在のケース」バッジがあること
- 取引先と取引先責任者のリンクが別タブで開くこと
- ContactまたはAccountが未設定の場合の表示
- 空状態、関連リスト取得エラー、表示中Case取得エラー
- 主要状態のアクセシビリティ

### 画面操作を再現するテスト

| テストファイル                                                                                                                            | 代表的な確認内容                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [caseRelatedCaseList.test.js](../../../../force-app/main/default/lwc/caseRelatedCaseList/__tests__/caseRelatedCaseList.test.js)           | 次のケースを受信するまで旧ケースのカードを表示しない。renders the loading state before the case wire responds。          |
| [caseRelatedCaseListLogic.test.js](../../../../force-app/main/default/lwc/caseRelatedCaseList/__tests__/caseRelatedCaseListLogic.test.js) | 単独の日付項目のラベルを使い、作成者の複合表示と空欄を除外する。表示中Caseを含めて作成日時の降順で最大20件を選別する。   |
| [localError.test.js](../../../../force-app/main/default/lwc/caseRelatedCaseList/__tests__/localError.test.js)                             | 画面固有の処理位置と例外の分類を維持する。                                                                               |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)                          | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。 |
