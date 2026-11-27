# OAuth トークン発行

## 機能の用途

同じ Salesforce 組織の接続アプリケーションまたは外部クライアントアプリケーションでユーザーが認可し、取得したトークンを確認する管理者向けの画面です。

### 権限・実行条件

- [LwcOAuthTokenIssuance 権限セット](../../../../force-app/main/default/permissionsets/LwcOAuthTokenIssuance.permissionset-meta.xml) はタブの表示と `OAuthTokenIssuanceController` の実行を許可します。画面からの Apex 呼び出しには Salesforce 標準の Apex クラスアクセスが適用されます。
- 対象アプリの利用権限、スコープ、IP 制限など、組織とアプリの OAuth ポリシーが適用されます。リフレッシュトークンを発行するには `refresh_token`（`offline_access`）が必要です。
- Apex から My Domain への通信が許可されている必要があります。Remote Site Setting の要否は反映先で確認します。

## 対象メタデータ

- [画面と操作](../../../../force-app/main/default/lwc/oauthTokenIssuance/oauthTokenIssuance.js)
- [認可 URL・コールバックの解析](../../../../force-app/main/default/lwc/oauthTokenIssuance/oauthTokenIssuanceLogic.js)
- [Apex Controller](../../../../force-app/main/default/classes/OAuthTokenIssuanceController.cls)、[Service](../../../../force-app/main/default/classes/OAuthTokenIssuanceService.cls)、[結果](../../../../force-app/main/default/classes/OAuthTokenIssuanceResult.cls)
- Salesforce アプリの「OAuth トークン発行」タブ（`OAuthTokenIssuance`）

### 対応するApexテスト

| テスト対象のApexクラス         | テストクラス                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `OAuthTokenIssuanceController` | [OAuthTokenIssuanceControllerTest](../../../../force-app/main/default/classes/OAuthTokenIssuanceControllerTest.cls) |
| `OAuthTokenIssuanceService`    | [OAuthTokenIssuanceServiceTest](../../../../force-app/main/default/classes/OAuthTokenIssuanceServiceTest.cls)       |

## アクセスするデータ・項目

画面タイトル「OAuth トークン発行」の直下、アプリケーション情報の入力欄より上に、API 接続先と現在ログインしているユーザーを表示します。発行前の接続先にはこの組織の My Domain を使用し、発行後は Salesforce の応答に `instance_url` があればその値を表示します。ユーザーは `氏名 (ログインユーザー名)` 形式です。別タブで別のアカウントを使って認可した場合、発行されるトークンは認可したユーザーに対応します。

「トークン発行結果」にはアクセストークン、リフレッシュトークン、付与されたスコープ、トークンタイプを表示します。`id_token` が返った場合は ID トークンも表示します。トークンを個別にコピーできます。リフレッシュトークンが返らない場合は未返却を表示します。

認可操作の状態と発行結果は、その画面のメモリ内に保持します。コンシューマー鍵またはコールバック URL を変更したときや画面から離れたときに破棄します。同じアプリで再認可した場合、前回の発行結果は新しい認可に対応する URL を確認した時点で消去します。別タブが開かない場合は［別タブで認可する］をもう一度押せます。コンシューマーシークレットと認可コードは交換を送信した時点で入力画面の状態から取り除きます。機能としてレコード、ブラウザストレージ、アプリケーションログへ保存しません。

## 操作

1. コンシューマー鍵、コンシューマーの秘密（アプリで必要な場合）、対象アプリに登録した HTTP(S) コールバック URL を入力します。
2. ［別タブで認可する］を押して認可を完了します。コールバックに `code` と `state` が残っていれば、戻り先の画面がエラーでもアドレスバーの URL 全体をコピーできます。
3. 元の画面の「認可後に表示された URL」に貼り付けます。
4. ［トークンを発行］を押し、同じ画面の下部で結果を確認します。

## エラー判定

コールバック先がコードを消去する、別 URL へ転送する、または先に交換する場合は利用できません。違う認可試行の URL、OAuth エラー、認可コード欠落を交換前に通知します。再発行や失敗後のやり直しは［別タブで認可する］を押します。交換リクエストは自動再送しません。

DPoP を要求するアプリや証明書ベースのクライアント認証は対象外です。クライアントシークレットが不要な場合は空欄にします。取得済みリフレッシュトークンによる更新は利用先で行います。

## 処理詳細

LWC は認可ごとに `state` と PKCE（S256）を生成し、貼り付けた URL の戻り先と `state` を照合します。認可リクエストでは `scope` を省略するため、Salesforce がアプリに登録済みのスコープを要求します。Apex はこの組織の My Domain にある `/services/oauth2/token` に認可コードと元の PKCE 検証値を送ります。認可とコード交換には同じコールバック URL を指定します。

### テストコード

[テストコードと確認内容](tests.md)
