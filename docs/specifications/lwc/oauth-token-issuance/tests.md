# OAuth トークン発行のテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

- [画面の Jest](../../../../force-app/main/default/lwc/oauthTokenIssuance/__tests__/oauthTokenIssuance.test.js) と [認可処理の Jest](../../../../force-app/main/default/lwc/oauthTokenIssuance/__tests__/oauthTokenIssuanceLogic.test.js)
- [Controller の Apex テスト](../../../../force-app/main/default/classes/OAuthTokenIssuanceControllerTest.cls) と [Service の Apex テスト](../../../../force-app/main/default/classes/OAuthTokenIssuanceServiceTest.cls)
- 組織では両種別のアプリで、登録済みコールバックから未使用のコードを回収し、リフレッシュトークンを表示できることを確認します。

### 画面操作を再現するテスト

| テストファイル                                                                                                                         | 代表的な確認内容                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [oauthTokenIssuance.test.js](../../../../force-app/main/default/lwc/oauthTokenIssuance/__tests__/oauthTokenIssuance.test.js)           | 認可を始める前に API 接続先と現在のログインユーザーを確認できる。PKCE の準備をやり直すときは取得済みの API 接続先を使う。 |
| [oauthTokenIssuanceLogic.test.js](../../../../force-app/main/default/lwc/oauthTokenIssuance/__tests__/oauthTokenIssuanceLogic.test.js) | 認可操作ごとに独立した S256 の検証値と state を生成する。スコープの指定を省き、公開用の PKCE 値を認可に渡す。             |
