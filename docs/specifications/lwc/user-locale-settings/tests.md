# 言語・地域のテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

| テスト                             | 確認する振る舞い                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `UserLocaleSettingsControllerTest` | 本人設定の取得・保存、対象外項目の保持、不正入力時のDML抑止                                        |
| `UserLocaleSettingsServiceTest`    | 現在値維持、対象なし、候補・権限検証、更新項目とユーザーの限定                                     |
| `UserLocaleSettingsSelectorTest`   | ログインユーザーだけの取得                                                                         |
| `UserLocaleSettingsWrapperTest`    | 初期値と未確定の更新対象                                                                           |
| `userLocaleSettings.test.js`       | 参照・編集、キャンセル、自動連動と手動変更、二重保存防止、失敗時の再試行、再接続、アクセシビリティ |
| `userLocaleSettingsLogic.test.js`  | 優先順、対応表、地域付き言語コード、一意な候補と曖昧な候補、保存入力の検証                         |

Chromeでは言語・地域の参照、キーボードでの選択、キャンセル、保存後の標準画面の言語切り替えと地域の保持を確認します。

### 画面操作を再現するテスト

| テストファイル                                                                                                                         | 代表的な確認内容                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [userLocaleSettings.test.js](../../../../force-app/main/default/lwc/userLocaleSettings/__tests__/userLocaleSettings.test.js)           | starts in accessible read mode and preserves the current combination。links the locale on language changes and allows an override。 |
| [userLocaleSettingsLogic.test.js](../../../../force-app/main/default/lwc/userLocaleSettings/__tests__/userLocaleSettingsLogic.test.js) | prioritizes Japanese and English without changing the source。does not invent unavailable or ambiguous locales。                    |
