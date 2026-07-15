# ケースメールメッセージ一覧

## 概要

ケースレコードに紐づく最新のメールメッセージを、Case レコードページ上で確認する Lightning Web Component です。

## 目的・利用場面

ケース対応中に、関連するメールの送受信日時、方向、件名、差出人、宛先をレコードページから確認するために利用します。

## 対象実装・メタデータ

| 種別           | API 名・ファイル名            | 役割                                     |
| -------------- | ----------------------------- | ---------------------------------------- |
| LWC            | `caseEmailMessageList`        | メールメッセージ一覧と再読み込み UI      |
| Apex Class     | `CaseEmailMessageController`  | LWC からの読み取り専用 Apex 入口         |
| Apex Class     | `CaseEmailMessageSelector`    | USER_MODE による EmailMessage 問い合わせ |
| Permission Set | `Salesforce_Application_User` | Apex Controller の実行権限               |

## 入力

- Case レコードページから渡される `recordId`

## 処理内容

1. `recordId` が Case の ID であることを Apex 入口で確認します。
2. `EmailMessage.ParentId` が Case ID と一致するレコードを利用者権限で取得します。
3. `MessageDate` の降順を基本に最新 50 件まで表示します。
4. 再読み込み操作ではキャッシュ済み Apex wire を更新します。

## 出力

- 送受信日時
- 送信または受信の方向
- EmailMessage 標準レコードページへの件名リンク
- 差出人アドレス
- 宛先アドレス

## 権限・実行条件

- `caseEmailMessageList` は Case の Lightning レコードページだけに配置できます。
- `Salesforce_Application_User` 権限セットで `CaseEmailMessageController` の実行権限を付与します。
- 一覧取得は `with sharing` と `WITH USER_MODE` で利用者の共有ルール、オブジェクト権限、項目権限を適用します。

## エラー・空状態

- メールメッセージがない場合は空状態のメッセージを表示します。
- 取得に失敗した場合は一般化した利用者向けエラーを表示します。
- 再読み込み中は操作を無効化してスピナーを表示します。

## テスト・確認観点

- `CaseEmailMessageControllerTest` で Case ID、null、Case 以外の ID を確認します。
- `CaseEmailMessageSelectorTest` で取得上限と送信日時順を確認します。
- `caseEmailMessageList.test.js` で一覧、空状態、エラー、再読み込み、アクセシビリティを確認します。

## 制約・注意事項

- 一覧は最新 50 件までです。ページングは行いません。
- メール本文、添付ファイル、返信や転送操作はこのコンポーネントの対象外です。
