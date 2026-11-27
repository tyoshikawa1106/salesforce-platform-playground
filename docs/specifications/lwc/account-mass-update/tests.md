# 取引先一括更新のテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

`AccountMassUpdateServiceTest`では内部コンストラクタに件数上限2件を渡し、未保存レコード3件で保存要求とページ表示の境界を確認します。通常実行の上限は200件です。実行者は標準システム管理者とし、プロファイル・権限セット名に依存する権限差異のテストは行いません。

- `accountMassUpdate.test.js`: 画面操作、ハイライト、保存・再取得、移動の取消、アクセシビリティ。
- `accountMassUpdateLogic.test.js`: 差分、クリア、保存件数、表示モデル。
- [AccountMassUpdateControllerTest](../../../../force-app/main/default/classes/AccountMassUpdateControllerTest.cls): 更新上限、行別の値、部分成功、改ざん・競合拒否。
- [AccountMassUpdateServiceTest](../../../../force-app/main/default/classes/AccountMassUpdateServiceTest.cls): 条件と要求の検証、差分生成。
- [AccountMassUpdateSelectorTest](../../../../force-app/main/default/classes/AccountMassUpdateSelectorTest.cls): ページ境界、個人取引先除外、検索条件。
- [AccountMassUpdateWrapperTest](../../../../force-app/main/default/classes/AccountMassUpdateWrapperTest.cls): 応答の初期状態。

### 法人取引先の一括更新

`AccountMassUpdateControllerTest` で上限件数の異なる値の保存、空欄へのクリア、部分成功、競合・不許可項目の拒否を確認します。LWCのテストでは成功行の解除、失敗行の保持、再取得失敗と保存失敗の区別を確認します。

`accountMassUpdate.test.js`と`accountMassUpdateLogic.test.js`で、Masterと独自レコードタイプが混在する一覧の候補分離、レコードタイプが空または未返却の行、Master固有の候補を選んだ保存要求を確認します。

### 法人取引先の検索・ページ移動

`AccountMassUpdateSelectorTest` で同一作成日時のページ分割、名前のワイルドカード文字、個人取引先除外を確認します。`AccountMassUpdateServiceTest` で日付境界と表示上限を確認します。LWCテストでページ移動の取消・失敗、選択肢取得失敗後の再検索による復旧、成功済み選択肢の再利用と再失敗時の停止を確認します。

実画面では、検索結果が1件の場合と複数件の場合の末尾行で、業種・種別・評価の候補が表示され、マウスとキーボードで選択できることを確認します。候補が多い場合のスクロールと、変更取消後に元の値へ戻ることも確認します。

### 画面操作を再現するテスト

| テストファイル                                                                                                                      | 代表的な確認内容                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [accountMassUpdate.test.js](../../../../force-app/main/default/lwc/accountMassUpdate/__tests__/accountMassUpdate.test.js)           | 検索が失敗したときは前の検索の0件案内を表示しない。初期表示では検索せず、検索後に編集行をハイライトして取消できる。      |
| [accountMassUpdateLogic.test.js](../../../../force-app/main/default/lwc/accountMassUpdate/__tests__/accountMassUpdateLogic.test.js) | 元の値へ戻すと変更行を解除し、クリア要求はnullで保持する。変更項目と元の日時だけを送信する。                             |
| [localError.test.js](../../../../force-app/main/default/lwc/accountMassUpdate/__tests__/localError.test.js)                         | 画面固有の処理位置と例外の分類を維持する。                                                                               |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)                    | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。 |
