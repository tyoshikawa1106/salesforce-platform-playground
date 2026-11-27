# 取引先一括削除画面のテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

削除結果の詳細上限は通常200件を維持し、`AccountDeleteBatchServiceTest`では内部コンストラクタに上限2件を渡して、失敗3件で上限未満・ちょうど・超過を確認します。実行者は標準システム管理者とし、プロファイル差異による権限拒否はテスト対象に含めません。通常処理に必要なカスタム権限は、既存の権限セット名に依存せずテスト内で準備します。

環境・カスタム権限・取引先の参照と削除の両方の権限による許可・拒否は、内部メソッドに3つの判定値を引数で渡して確認します。環境、カスタム権限、CRUDの順で拒否理由を決定することも検証し、権限差異のあるユーザーは準備しません。拒否側は未保存の取引先3件を使い、開始拒否、削除直前の拒否、全件の失敗集計、詳細上限を検証します。画面から呼び出すApexメソッドは呼び出し時の実際の組織環境・権限で判定し、テストもその組織での許可・拒否と照合します。Batchの対象取得は拒否理由を引数で渡し、取引先1件が存在しても拒否時は空のQueryLocatorを返し、許可時はその1件を取得することを対応するテストクラスで検証します。

`accountDelete.test.js`で確認・キャンセル・連打・権限拒否・通信失敗・再取得、`accountDeleteLogic.test.js`で状態判定、`accountDeleteConfirm.test.js`で親への確認結果を検証します。DOMのアクセシビリティを明示チェックします。標準モーダルの実ブラウザ挙動はChromeで別途確認します。

### 画面操作を再現するテスト

| テストファイル                                                                                                                     | 代表的な確認内容                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [accountDelete.test.js](../../../../force-app/main/default/lwc/accountDelete/__tests__/accountDelete.test.js)                      | 再接続前の確認が成立しても送信せず、新しい確認のロックを維持する。送信後の再接続では受付結果を待ち、削除を二重に開始しない。 |
| [accountDeleteLogic.test.js](../../../../force-app/main/default/lwc/accountDelete/__tests__/accountDeleteLogic.test.js)            | 別ジョブの完了応答で受付済み状態を解除しない。受付したジョブが終了したら再実行を許可する。                                   |
| [localError.test.js](../../../../force-app/main/default/lwc/accountDelete/__tests__/localError.test.js)                            | 画面固有の処理位置と例外の分類を維持する。                                                                                   |
| [accountDeleteConfirm.test.js](../../../../force-app/main/default/lwc/accountDeleteConfirm/__tests__/accountDeleteConfirm.test.js) | 閉じる処理の失敗をモーダル内に表示する。                                                                                     |
| [localError.test.js](../../../../force-app/main/default/lwc/accountDeleteConfirm/__tests__/localError.test.js)                     | 画面固有の処理位置と例外の分類を維持する。                                                                                   |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)                   | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。     |
