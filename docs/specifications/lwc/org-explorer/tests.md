# 組織エクスプローラーのテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

一覧要求の`pageSize`は1〜50件を指定でき、省略時は50件です。画面は通常50件で取得します。Apexテストでは小さいページ件数と必要最小限のユーザーで、同名境界・最終ページ・重複と欠落・先頭復帰を確認します。

構造と候補の境界は、[OrgExplorerService](../../../../force-app/main/default/classes/OrgExplorerService.cls)のテスト用内部コンストラクタで小さい上限を指定し、先読み除外・継続・上限ちょうどでの終了を検証します。通常の構造取得上限と候補上限は変更しません。変換は未保存レコードを優先し、DB照会・集計・標準ページングだけ必要最小限の保存データで確認します。

本体と同名の`<クラス名>Test`を1対1で配置します。公開APIの結合テストは[OrgExplorerControllerTest](../../../../force-app/main/default/classes/OrgExplorerControllerTest.cls)、Service・Selector・権限判定・カーソル変換は対応クラスのテストから直接確認します。DTOは初期状態と独自処理を確認し、標準JSON変換だけの重複テストは設けません。カバレッジは対応するテストクラスとの組み合わせで確認します。

[入口テスト](../../../../force-app/main/default/classes/OrgExplorerControllerTest.cls)、[構造の整形テスト](../../../../force-app/main/default/classes/OrgExplorerServiceTest.cls)、[メンバーの整形テスト](../../../../force-app/main/default/classes/OrgExplorerMemberServiceTest.cls)で、構造の取得境界、標準カーソルのJSON往復・氏名順の全ページ取得・先頭への復帰、不正な取得位置、無効条件、検索制御文字、型違い、期限、不可視な親、人数集計、廃止scopeの拒否、応答生成前後の入力データの不変性を確認します。

テスト専用のSelector差し替えは設けず、公開APIの入出力とServiceの単体テストで確認します。旧経路取得・個別詳細APIと専用DTOは提供しません。

公開APIでは構造要求へのユーザー一覧取得位置の流用、可視な親に対する負の取得位置、長すぎるロール検索語、未発行の構造カーソルを拒否することも確認します。

CanvasのJestでは、2枚のカードを広い座標範囲に配置し、初期位置からの小さなドラッグ、25%表示での右下末端への到達、広い図でのズーム注目位置、不正座標での位置維持を検証します。この検証のために多数のロールやユーザーは作成しません。

Controllerの想定外例外・標準カーソルの失効を捕捉する経路は、通常入力では発生せず、標準APIの障害や失効時刻を単体テストから確実に再現できないため未カバーです。上司構造では、通常のService生成時に取得上限を1,000件に固定します。テストでは`@TestVisible`の内部コンストラクタへ境界件数を渡し、新規User2件から得た実際の2上司の集計で、上限超過時の継続、上限ちょうどでの終了、可視な境界がない場合の参照拒否を検証します。公開APIから取得上限を変更することはできません。大量のUser作成、`Test.isRunningTest()`による処理分岐、テスト専用のSelector差し替えは使用しません。

配置の測定とカード生成は明示的なスタックで走査し、階層の深さに比例した再帰呼び出しを使用しません。親への統合後は不要な子の輪郭配列を解放します。Jestでは3000段の連続階層の描画モデルを検証します。これは10万ユーザー規模の実測保証を意味しません。

LWCのJestで構造ページの統合・部分木・配置・選択・権限状態の変換と、テンプレート接続・アクセシビリティ・遅延応答・同時送信数・再接続後の再取得・ドラッグ途中の切断後に図が勝手に動かないことを確認します。組織上では、タブからの起動、初期起点と別枝の除外、ロール候補の選択、候補確定と解除による表示範囲の自動切り替え、カード選択と所属一覧の同期、無効ユーザーの切り替え、等倍への復帰、上司階層への切り替え、所属一覧のページ操作を確認します。

上司階層は `OrgExplorerControllerTest.cls`、`OrgExplorerServiceTest.cls`、`OrgExplorerMemberServiceTest.cls`、`OrgExplorerSelectorTest.cls` と `orgExplorer.test.js` で、上司だけの構造、直属人数、カードの所属情報と参照不足時の非表示、最上位・氏名前方一致の候補、直属メンバーの標準ページ取得と条件変更時の拒否、構造カーソルの閲覧者・表示条件・期限・対象型の検証、構造の継続、未指定対象の照会短絡、モード切り替えを確認します。複数の上司と部下をまとめて作成し、構造・人数・親・所属ロールをユーザーごとの追加照会なしで取得できることも確認します。

表示ノードは `OrgExplorerPageResponse.Node` の内部クラスにまとめ、応答の `nodes` プロパティで返します。ノードの初期値テストも [OrgExplorerPageResponseTest](../../../../force-app/main/default/classes/OrgExplorerPageResponseTest.cls) で確認します。

構造の継続情報は `OrgExplorerCursorCodec.Cursor` の内部クラスに定義し、初期値・JSON変換・期限・閲覧者の検証を [OrgExplorerCursorCodecTest](../../../../force-app/main/default/classes/OrgExplorerCursorCodecTest.cls) でまとめて確認します。画面とは符号化した文字列で受け渡し、内部クラスを公開APIの引数や戻り値には使いません。

### DTO自動setterの解析注釈

公開DTOのBooleanプロパティはLWCとの入出力契約を保つため、自動getter・setterを維持しています。PMDの`AvoidBooleanMethodParameters`が自動setterの引数も検出するため、現実装では下記のプロパティに限って理由付きの`@SuppressWarnings('PMD.AvoidBooleanMethodParameters')`を指定しています。クラス全体や解析設定での除外は行っていません。

| 対象ファイル                                                                                                          | 対象プロパティ                                                |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [OrgExplorerPageRequest.cls](../../../../force-app/main/default/classes/OrgExplorerPageRequest.cls)                   | `includeInactive`                                             |
| [OrgExplorerPageResponse.cls](../../../../force-app/main/default/classes/OrgExplorerPageResponse.cls)                 | `hasMore`, 内部Nodeの`isActive`                               |
| [OrgExplorerCapabilitiesResponse.cls](../../../../force-app/main/default/classes/OrgExplorerCapabilitiesResponse.cls) | `managerModeEnabled`, `roleModeEnabled`, `roleMembersEnabled` |

### 画面操作を再現するテスト

| テストファイル                                                                                                                      | 代表的な確認内容                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)                    | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。         |
| [localError.test.js](../../../../force-app/main/default/lwc/orgExplorer/__tests__/localError.test.js)                               | 画面固有の処理位置と例外の分類を維持する。                                                                                       |
| [orgExplorer.test.js](../../../../force-app/main/default/lwc/orgExplorer/__tests__/orgExplorer.test.js)                             | ロール未選択では階層ボタンを無効にし、上司モードには表示しない。再接続前のモーダル終了で新しいロール選択を解除しない。           |
| [orgExplorerLogic.test.js](../../../../force-app/main/default/lwc/orgExplorer/__tests__/orgExplorerLogic.test.js)                   | ロール階層の選択候補には選択起点の直下だけを名称順で含める。構造の継続ページで重複を統合し、旧カード上限で上司を切り捨てない。   |
| [localError.test.js](../../../../force-app/main/default/lwc/orgExplorerCanvas/__tests__/localError.test.js)                         | 画面固有の処理位置と例外の分類を維持する。                                                                                       |
| [orgExplorerCanvas.test.js](../../../../force-app/main/default/lwc/orgExplorerCanvas/__tests__/orgExplorerCanvas.test.js)           | 拡大と縮小の後も等倍操作で正確に100%へ戻す。初期表示は100%で、全体表示は手動だけにしスクロールで切り替えない。                   |
| [orgExplorerCanvasLogic.test.js](../../../../force-app/main/default/lwc/orgExplorerCanvas/__tests__/orgExplorerCanvasLogic.test.js) | 大きな図でも拡大縮小の注目点が移動制限でずれない。不正な注目点では直前の有限な位置を維持する。                                   |
| [orgExplorerCard.test.js](../../../../force-app/main/default/lwc/orgExplorerCard/__tests__/orgExplorerCard.test.js)                 | カードのポインタ選択はスクロールせずフォーカスし、クリックを一度だけ通知する。右クリックと副ポインタではフォーカスを移動しない。 |
| [orgExplorerDetails.test.js](../../../../force-app/main/default/lwc/orgExplorerDetails/__tests__/orgExplorerDetails.test.js)        | 未選択ではロール名と表を出さず案内する。見出しにロール名を括弧付きで表示し、切り替えで更新する。                                 |
| [orgExplorerSearch.test.js](../../../../force-app/main/default/lwc/orgExplorerSearch/__tests__/orgExplorerSearch.test.js)           | 候補を標準ルックアップのドロップダウンに表示してクリックで選択する。上下キーとEnterで候補を一度だけ確定する。                    |
