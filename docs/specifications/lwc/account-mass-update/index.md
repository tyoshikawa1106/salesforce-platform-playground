# 取引先一括更新

## 概要

法人取引先を検索し、一覧の各行で所有者・業種・種別・評価を編集してまとめて保存するLWCです。「Salesforce」アプリの「取引先一括更新」タブから利用します。ナビゲーションの末尾に「取引先一括更新 → 取引先一括削除 → テストデータ一括削除」の順に配置します。

## 目的・利用場面

複数の取引先へ、それぞれ異なる値を入力して一度に保存します。未保存の変更は画面内だけで保持し、行の背景色と「変更あり」で示します。

## 対象実装・メタデータ

| 種別          | 名前                          | 責務                                                 |
| ------------- | ----------------------------- | ---------------------------------------------------- |
| LWC           | `accountMassUpdate`           | 検索、編集、保存、取消、ページ移動の制御             |
| JavaScript    | `accountMassUpdateLogic.js`   | 差分判定、入力検証、表示モデルと保存要求の生成       |
| Apex          | `AccountMassUpdateController` | 公開入口、問い合わせと判定の調整、DML                |
| Apex          | `AccountMassUpdateService`    | 条件の正規化、更新項目と権限の検証、差分と結果の生成 |
| Apex          | `AccountMassUpdateSelector`   | ページ検索、更新対象のロック取得                     |
| Apex          | `AccountMassUpdateWrapper`    | 検索条件、処理状態、画面応答                         |
| CustomTab     | `AccountMassUpdate`           | 画面の入口                                           |
| PermissionSet | `LwcAccountMassUpdate`        | Apex入口の実行権限とタブ表示                         |

## 入力

- 取引先名と作成日の開始日・終了日。
- 各行の所有者、業種、種別、評価。
- 検索、ページ移動、変更を保存、変更を取り消す操作。

## 処理内容

1. [検索・ページ移動](search-and-pagination.md)で法人取引先を表示します。
2. 項目の編集値を元の値と比較し、変更がある行を表示します。
3. [一括更新](mass-update.md)で変更行だけを保存し、行ごとの結果を反映します。

## 出力・更新対象

`Account` の `OwnerId`、`Industry`、`Type`、`Rating` だけを更新します。個人取引先は検索・保存ともに対象外です。新規レコード、保存履歴、非同期ジョブは作成しません。

## 権限・実行条件

- `LwcAccountMassUpdate` は画面へのアクセスだけを提供します。オブジェクト・項目権限や所有者移転権限は追加しません。
- Apexは `with sharing` と、検索・DMLの `USER_MODE` を使用します。
- 一覧に必要な項目を参照できない場合は検索が失敗します。編集権限のない項目は画面で無効にします。
- 所有者候補の検索は標準 `lightning-record-picker` と利用者の参照権限に従います。

## エラー処理

検索全体のエラーと行別の保存エラーを区別します。保存成功後の再取得失敗では、成功した変更を未保存へ戻しません。詳細は各処理の仕様を参照してください。

## 関連コンポーネント

- `lightning-record-picker`: 所有者の検索と選択。
- UI API: オブジェクト情報とレコードタイプ別の選択肢取得。
- `lightning/confirm`: 未保存の変更を破棄する確認。
- [取引先トリガー](../../apex/triggers/account-trigger/index.md): 保存時に実行される既存処理。

## テスト・確認観点

- `accountMassUpdate.test.js`: 画面操作、ハイライト、保存・再取得、移動の取消、アクセシビリティ。
- `accountMassUpdateLogic.test.js`: 差分、クリア、保存件数、表示モデル。
- `AccountMassUpdateControllerTest`: 更新上限、行別の値、部分成功、改ざん・競合拒否。
- `AccountMassUpdateServiceTest`: 条件と要求の検証、差分生成。
- `AccountMassUpdateSelectorTest`: ページ境界、個人取引先除外、検索条件。
- `AccountMassUpdateWrapperTest`: 応答の初期状態。

## 制約・注意事項

ブラウザの再読み込みや画面を閉じる操作では未保存の変更を復元できません。レコードの更新に伴う既存の入力規則、Flow、Trigger、標準の所有者変更処理は適用されます。関連レコードの移転オプションを選択する機能はありません。

## 既知の差異・確認事項

未確認：Chromeでの所有者検索・保存操作は、開発組織へ反映後に確認します。個人取引先が有効な組織での除外分岐は、対応する組織での検証が必要です。
