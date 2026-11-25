# ユーザー作成アシスタント

## 概要

Salesforce アプリの「OAuth トークン発行」の次に配置する、新規ユーザーの作成画面です。コピー元の情報を見ながら入力し、そのユーザーに割り当てられた権限セットや権限セットグループを引き継げます。

## 目的・利用場面

同じユーザーライセンス・ロール・プロファイルで新しい利用者を登録するときに使用します。既存ユーザーを置き換える場合は、元ユーザーの編集と無効化も同時に行えます。

## 対象実装・メタデータ

| 実装                                                                                                                                                                                                                                                                                                 | 役割                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [画面](../../../../force-app/main/default/lwc/userCreateAssistant/userCreateAssistant.html)・[Controller](../../../../force-app/main/default/lwc/userCreateAssistant/userCreateAssistant.js)・[表示ロジック](../../../../force-app/main/default/lwc/userCreateAssistant/userCreateAssistantLogic.js) | コピー元選択、左右のフォーム、入力検証、保存、再試行 |
| [UserCreateAssistantController](../../../../force-app/main/default/classes/UserCreateAssistantController.cls)                                                                                                                                                                                        | 元ユーザーの変更、新規作成、権限割り当ての一括保存   |
| [UserCreateAssistantService](../../../../force-app/main/default/classes/UserCreateAssistantService.cls)・[Selector](../../../../force-app/main/default/classes/UserCreateAssistantSelector.cls)・[Wrapper](../../../../force-app/main/default/classes/UserCreateAssistantWrapper.cls)                | 表示項目、保存要求、ユーザー・割り当ての取得         |
| [タブ](../../../../force-app/main/default/tabs/UserCreateAssistant.tab-meta.xml)・[Salesforce アプリ](../../../../force-app/main/default/applications/Salesforce.app-meta.xml)                                                                                                                       | ナビゲーションからの起動                             |

[UserCreateAssistantFieldCatalog](../../../../force-app/main/default/classes/UserCreateAssistantFieldCatalog.cls) が項目定義と参照範囲を決定し、[UserCreateAssistantFieldInput](../../../../force-app/main/default/classes/UserCreateAssistantFieldInput.cls) が保存値の検証と型変換を担当します。

## 入力

- 氏名・ユーザー名からコピー元を選びます。新規ユーザーの編集項目には初期値を転記せず、利用者が必須項目を入力します。ユーザーライセンス・ロール・プロファイルは両側とも参照専用です。
- コピー元の無効化は初期状態でオフです。オンにすると元側の編集可能項目を変更できます。オフに戻すと元側の編集を取り消し、新規側の入力は保持します。
- 権限セットと権限セットグループの引き継ぎは、ともに初期状態でオンです。個別に解除できます。

## 処理内容

1. コピー元を選択すると、現在の組織の User 項目定義と実行者の項目権限から表示項目を生成します。標準項目はユーザー編集画面に対応するグループに配置し、カスタム項目は日本語の表示ラベル順で表示します。
2. コピー元と新規側を別々のボックスに並べ、同じ項目を揃えます。狭い画面ではコピー元、新規側の順に縦に表示します。
3. 保存時に元ユーザーのプロファイルとロールを再取得します。無効化を選んだ場合は元側の変更を保存してから新規ユーザーを作成します。
4. 有効な直接割り当てとグループ割り当てのうち選んだ種類を、元の有効期限で付与します。グループはグループ単位で付与し、新規側にすでにある割り当てを重複登録しません。

## 出力・更新対象

User を作成し、成功したユーザーへのリンクを表示します。無効化を選んだ場合は元ユーザーの指定項目と有効状態を更新します。引き継ぎの対象は PermissionSetAssignment です。

## 権限・実行条件

[SalesforceApplicationUser](../../../../force-app/main/default/permissionsets/SalesforceApplicationUser.permissionset-meta.xml) がタブ表示を、[LwcUserCreateAssistant](../../../../force-app/main/default/permissionsets/LwcUserCreateAssistant.permissionset-meta.xml) がタブ表示と Apex の入口へのアクセスを付与します。ユーザー管理や権限割り当てには、実行者が組織ですでに持つ権限を使用します。サーバーでも固定項目と書き込み可能な項目を検証します。

## エラー処理

- 元ユーザーの更新、新規作成、権限割り当ては同じトランザクションで行います。どれかが失敗すると、元ユーザーの無効化を含めて取り消します。
- 保存失敗時は入力とチェック状態を保持します。権限割り当てでライセンスが不足した場合は、該当する引き継ぎをオフにして再試行できます。ユーザーライセンス自体の枠不足はユーザー作成時に通知します。
- コピー元の切り替え中は前の取得結果を無視します。保存中はフォームをロックし、二重送信を防ぎます。

## 関連コンポーネント

対象ユーザーの検索に標準レコードピッカーを使用します。フォームでは入力型と選択肢を User の項目定義から決定し、参照先のオブジェクト情報をピッカーで取得できない場合はレコード ID を入力します。

## テスト・確認観点

- Jest は初期値、項目順、左右の編集可否、無効化解除、取得の競合、保存失敗時の再試行、送信中の再接続を確認します。
- Apex テストは作成、元ユーザーの保持・無効化、固定項目、割り当ての種類・期限、失敗時の取り消しを確認します。

## 制約・注意事項

- 元ユーザーのユーザー名を新規側で再利用する場合、元のユーザー名を変更し、組織の一意制約を満たす必要があります。組織の入力規則で変更が禁止されている場合は、新規側に別のユーザー名を入力します。
- 表示名の五十音順には日本語ロケールの照合順を使用します。漢字の表示ラベルに対する読み仮名の推定は行いません。
- 利用可能な項目・選択肢・ライセンス・ロールの条件は組織と実行ユーザーによって異なります。

## 既知の差異・確認事項

標準項目のグループと表示順は設定画面を参考にした画面定義です。Salesforce の設定画面に対する組織別のレイアウト変更をそのまま再現する構成ではありません。
