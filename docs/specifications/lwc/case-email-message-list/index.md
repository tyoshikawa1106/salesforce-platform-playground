# ケースメールメッセージ一覧

## 概要

ケースレコードに紐づくメールメッセージを、古いものから順に Case レコードページ上の活動タイムラインで確認する Lightning Web Component です。

## 目的・利用場面

ケース対応中に、関連するメールの送受信日時、方向、件名、差出人、宛先、本文をレコードページから確認するために利用します。

## 対象実装・メタデータ

| 種別           | API 名・ファイル名             | 役割                                        |
| -------------- | ------------------------------ | ------------------------------------------- |
| LWC            | `caseEmailMessageList`         | メールメッセージ一覧と追加読み込み UI       |
| LWC JavaScript | `caseEmailMessageList.js`      | Apex取得、追加読み込み、画面状態の統括      |
| LWC JavaScript | `caseEmailMessageListLogic.js` | 表示行、タイトル、ページ状態の生成          |
| Apex Class     | `CaseEmailMessageController`   | LWC からの読み取り専用 Apex 入口            |
| Apex Class     | `CaseEmailMessageService`      | 入力検証、取得位置、次ページ状態の組み立て  |
| Apex Class     | `CaseEmailMessageSelector`     | USER_MODE の PaginationCursor 問い合わせ    |
| Apex Class     | `CaseEmailMessagePageWrapper`  | 取得結果と次ページ情報を保持する応答 DTO    |
| Permission Set | `Salesforce_Application_User`  | Apex Controller の実行権限                  |
| FlexiPage      | `CaseFlexiPage`                | Case レコードページのメールログタブへの配置 |

## 入力

- Case レコードページから渡される `recordId`

## 処理内容

1. `recordId` が Case の ID であることを Service で確認します。
2. LWC は最初にCOUNT用 Apexを呼び出し、`EmailMessage.ParentId` が Case ID と一致する総件数を利用者権限で取得します。
3. 総件数の取得後、`MessageDate`、`CreatedDate`、`Id` の昇順と `LIMIT 100000` を指定し、`Database.getPaginationCursorWithBinds()` で利用者権限の `Database.PaginationCursor` を作成します。送信日時がないメールは末尾に表示します。
4. `fetchPage(startIndex, 50)` で最も古いメールから最大 50 件を取得します。`CursorFetchResult.getNextIndex()` が `PaginationCursor.getNumRecords()` より小さい場合だけ次ページありと判定します。`CursorFetchResult.isDone()` 単独では判定しません。
5. 次ページがある場合、活動タイムラインの一番下に「次のメールを読み込む」を表示します。選択すると LWC から同じ `PaginationCursor` と次の `startIndex` を Apex へ渡し、既存のタイムラインの末尾へ最大 50 件を追加します。追加ページの直前には区切り線と「51件目から100件目を読み込みました」のような取得範囲を表示し、ページ境界をタイムライン内に残します。
6. カードタイトルを「メールログ」とし、COUNTで取得した総件数を併記します。各メールを SLDS の活動タイムラインとして古い順に表示します。受信と送信でSLDSアイコンを切り替え、補足行にも送受信の方向を表示します。差出人と宛先はメール作成用リンクとして表示します。
7. 各メールの詳細は常時展開し、ラベルを付けずにプレーンテキスト本文だけを表示します。本文領域は約20行分を上限とし、超過分は領域内の縦スクロールで表示します。開閉操作は提供しません。
8. 再読み込み操作ではCOUNTと初回ページのキャッシュ済み Apex wire を順に更新します。

## 出力・更新対象

- 送受信日時と曜日
- 受信と送信を表すSLDSユーティリティアイコン
- 差出人と宛先の `mailto:` リンク、送信または受信の方向を示す補足文
- EmailMessage 標準レコードページへの件名リンク
- 差出人アドレス
- 宛先アドレス
- プレーンテキスト本文
- この機能はレコードを作成、更新、削除しません。

## 権限・実行条件

- `caseEmailMessageList` は Case の Lightning レコードページだけに配置できます。
- `Salesforce_Application_User` 権限セットで `CaseEmailMessageController` の実行権限を付与します。
- 一覧取得は `with sharing` と `WITH USER_MODE` で利用者の共有ルール、オブジェクト権限、項目権限を適用します。

## エラー処理

- メールメッセージがない場合は空状態のメッセージを表示します。
- 件数取得または初回ページ取得に失敗した場合は、一覧を表示せず一般化した利用者向けエラーを表示します。
- 追加読み込みに失敗した場合は、読み込み済みのメールを保持したまま利用者向けエラーを表示します。
- `PaginationCursor` が無効または期限切れになった場合も追加読み込みエラーとして扱い、再読み込み操作で新しい Cursor を作成して先頭ページから復旧します。
- 再読み込み中は操作を無効化してスピナーを表示します。

## 関連コンポーネント

- Case標準オブジェクト
- EmailMessage標準オブジェクト
- Case Lightningレコードページ
- `Salesforce_Application_User` 権限セット

## テスト・確認観点

- `CaseEmailMessageControllerTest` で Case ID、null、Case 以外の ID、件数、ページ応答を確認します。
- `CaseEmailMessageServiceTest` で入力検証、初回取得位置、不正な取得位置、空ページを確認します。
- `CaseEmailMessageSelectorTest` で件数、49件・50件・51件のページ境界、複数ページの重複防止、送信日時がないメール、Cursor作成後の削除行を確認します。
- `CaseEmailMessagePageWrapperTest` で空ページと次ページ情報を確認します。
- `caseEmailMessageList.test.js` でCOUNT後の初回取得、活動タイムライン構造、曜日表示、送受信別のアイコンと補足文、本文の常時表示、空状態、エラー、再読み込み、下部ボタンからの追加読み込み、追加ページ境界の区切りを確認します。

## 制約・注意事項

- 1 回の取得上限は 50 件です。追加読み込みを繰り返すことで 50 件を超えて表示できます。
- 1つの `PaginationCursor` が保持する対象は、作成時点で条件に一致した最も古い100,000件までです。Case全体の件数表示はCOUNT結果を使うため、100,000件を超える場合は表示件数と一致しません。
- Cursor作成後に追加されたメールは現在のCursorへ含めません。再読み込みすると新しいCursorで先頭ページから取得します。
- Cursor作成後に削除されたメールは`fetchPage()`が飛ばし、可能な範囲で1ページの取得件数を維持します。
- 本文は `EmailMessage.TextBody` をテキストとして表示します。`HtmlBody` のHTML書式は描画しません。
- 添付ファイル、返信や転送操作はこのコンポーネントの対象外です。

## 既知の差異・確認事項

- 状態: 現行実装確認済み、承認済み要求との差異は未判定
- 現行の `CaseFlexiPage` では、メールログタブ内に `caseEmailMessageList` が2インスタンス配置されています。意図した配置数か確認できないため、FlexiPage の現行値を保持しています。
- 現行の `CaseFlexiPage` では、フィードタブ内にもChatterフィードが2インスタンス配置されています。メールログ機能の対象外ですが、同じFlexiPageの確認事項として残します。
- 承認済み要求または画面要件の管理元をリポジトリ内で確認できないため、要求との差異は判定していません。
