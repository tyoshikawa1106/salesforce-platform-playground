# LWC：外部クライアントアプリ認証管理

外部クライアントアプリ資格情報更新画面の利用許可。管理用の外部ログイン情報を利用する権限と、外部クライアントアプリの資格情報を管理する権限を付与します。

API 参照名　[LwcExternalClientAppManager](../../../force-app/main/default/permissionsets/LwcExternalClientAppManager.permissionset-meta.xml)

| 付与内容                       | 対象                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Apex 実行                      | `ExternalClientAppManagerController`                                                                                 |
| カスタム権限                   | 外部クライアントアプリ認証管理（`ManageExternalClientAppCredentials`）                                               |
| 外部ログイン情報のプリンシパル | `ExternalClientAppManager-ExternalClientAppUserPrincipal`                                                            |
| タブ（表示）                   | 外部クライアントアプリ認証管理（`ExternalClientAppManager`）                                                         |
| システム権限                   | すべての外部クライアントアプリケーションの表示、その設定の表示、およびそのポリシーの編集（`ExternalClientAppAdmin`） |
| システム権限                   | 外部クライアントアプリケーションの作成、編集、削除（`ExternalClientAppDeveloper`）                                   |
| システム権限                   | すべての外部クライアントアプリケーションの表示（`ExternalClientAppViewer`）                                          |
| システム権限                   | メタデータの外部クライアントアプリケーションのコンシューマーの秘密を表示（`ViewClientSecret`）                       |
