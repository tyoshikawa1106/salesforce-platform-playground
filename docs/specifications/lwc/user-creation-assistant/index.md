# ユーザー作成アシスタント

## 概要

Salesforce アプリから既存ユーザーを検索し、新規作成時に参照するユーザーの氏名・ユーザー名・メールを確認する画面です。

## 目的・利用場面

同姓同名のユーザーがいる場合に、検索候補のユーザー名と選択後の詳細で参照元を識別します。

## 対象実装・メタデータ

- [画面](../../../../force-app/main/default/lwc/userCreationAssistant/userCreationAssistant.html)、[Controller](../../../../force-app/main/default/lwc/userCreationAssistant/userCreationAssistant.js)、[表示ロジック](../../../../force-app/main/default/lwc/userCreationAssistant/userCreationAssistantLogic.js)が検索と選択結果の表示を担当します。
- [タブ](../../../../force-app/main/default/tabs/UserCreationAssistant.tab-meta.xml)を[Salesforce アプリ](../../../../force-app/main/default/applications/Salesforce.app-meta.xml)のナビゲーションに登録します。

## 入力

氏名またはユーザー名で検索し、コピー元ユーザーを1人選びます。選択欄の解除操作で検索に戻れます。

## 処理内容

標準レコードピッカーで選択した User を Lightning Data Service で取得します。選択を切り替えた場合は、現在選択しているレコードと一致する応答だけを表示します。

## 出力・更新対象

選択したユーザーの参照可能な項目を表示します。空の項目は「—」で表示します。この画面でのレコード操作は参照のみです。

## 権限・実行条件

[SalesforceApplicationUser](../../../../force-app/main/default/permissionsets/SalesforceApplicationUser.permissionset-meta.xml) にタブの表示を設定します。ユーザーの検索・参照には実行者のアクセス権を使用します。

## エラー処理

読み込み中は取得状態を表示します。選択後のレコード取得に失敗した場合は、コピー元を選び直して再取得できます。

## 関連コンポーネント

Lightning の標準レコードピッカーと UI Record API を使用します。

## テスト・確認観点

Jest で選択、解除、別ユーザーへの切り替え、取得失敗後の再選択、項目の参照可否とアクセシビリティを確認します。

## 制約・注意事項

タブの表示設定と、個々のユーザー情報を参照できる範囲は別々に適用されます。

## 既知の差異・確認事項

新規ユーザーの入力・保存、コピー元の編集・無効化、権限セットおよび権限セットグループの引き継ぎは未実装です。
