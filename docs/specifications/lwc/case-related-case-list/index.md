# 最近の問い合わせ

## 概要

Caseレコードの顧客または会社に紐づく直近の別ケースを、Caseレコードページの狭い領域でカード一覧として表示するLightning Web Componentです。

## 目的・利用場面

ケース対応中に、同じ顧客または会社から過去に寄せられた問い合わせを確認し、重複問い合わせや以前の対応内容へすぐ移動するために利用します。

## 対象実装・メタデータ

| 種別           | API名・ファイル名             | 役割                                           |
| -------------- | ----------------------------- | ---------------------------------------------- |
| LWC            | `caseRelatedCaseList`         | 関連ケースの取得、タブ表示、レコードリンク生成 |
| LWC JavaScript | `caseRelatedCaseList.js`      | UI API取得、タブ状態、Navigationの統括         |
| LWC JavaScript | `caseRelatedCaseListLogic.js` | 関連ケース選択とカード表示モデルの生成         |
| FlexiPage      | `CaseFlexiPage`               | `caseContactProfile`直下の左サイドバー配置     |

## 入力

- Caseレコードページから渡される`recordId`
- 表示中Caseの`ContactId`
- 表示中Caseの`AccountId`

## 処理内容

1. Lightning Data Serviceの`getRecord`で表示中CaseのContactとAccountを取得します。
2. `getRelatedListRecords`でContactとAccountそれぞれの`Cases`関連リストを取得します。
3. 関連ケースを`LastModifiedDate`の降順で6件取得し、表示中Case自身を除外した先頭5件を表示します。
4. ケース番号、件名、ステータス、最終更新日時をコンパクトなカードとして表示します。
5. 「顧客」タブと「会社」タブを`lightning-tabset`で切り替えます。
6. ケース番号から対象Caseレコードへ移動できるURLを`NavigationMixin.GenerateUrl`で生成します。

## 出力・更新対象

- 「顧客」タブ: 同じContactに紐づく別ケースを最大5件表示します。
- 「会社」タブ: 同じAccountに紐づく別ケースを最大5件表示します。
- レコードの作成、更新、削除は行いません。

## 権限・実行条件

- Caseレコードページだけに配置できます。
- UI APIを利用し、実行ユーザーが参照できるCaseと項目だけを表示します。
- `CaseNumber`を取得必須項目とし、`Subject`、`Status`、`LastModifiedDate`は任意項目として取得します。
- Apex実行権限は必要ありません。

## エラー処理

- 表示中Caseの取得に失敗した場合は、コンポーネント全体に利用者向けエラーを表示します。
- Contact側またはAccount側の関連リスト取得に失敗した場合は、失敗したタブだけにエラーを表示します。
- ContactまたはAccountが未設定の場合は、該当タブに未設定メッセージを表示します。
- 関連ケースがない場合は、該当タブに空状態メッセージを表示します。
- レコードURLを生成できない場合も情報表示を継続し、ケース番号をリンクなしで表示します。

## 関連コンポーネント

- [ケース取引先責任者プロフィール](../case-contact-profile/index.md): 同じ左サイドバーで顧客と会社の基本情報、問い合わせ件数を表示します。
- Salesforce標準`Cases`関連リスト: UI APIで関連ケースを取得するデータソースです。

## テスト・確認観点

`caseRelatedCaseList.test.js`で次を確認します。

- 顧客と会社の2タブが表示されること
- ContactとAccountそれぞれの関連ケースがカード表示されること
- 表示中Caseを除外し、最大5件に制限すること
- ケース番号、件名、ステータス、最終更新日時、レコードリンク
- ContactまたはAccountが未設定の場合の表示
- 空状態、関連リスト取得エラー、表示中Case取得エラー
- 主要状態のアクセシビリティ

## 制約・注意事項

- 件数は各タブ最大5件で、コンポーネント内のページングや全件表示は行いません。
- 「顧客」は`Case.ContactId`、「会社」は`Case.AccountId`を基準にします。
- ContactとAccountの両方に同じCaseが関連していても、タブをまたいだ重複排除は行いません。
- タブ内容はLightning Base Componentの仕様に従って遅延描画されます。

## 既知の差異・確認事項

- 比較対象となる外部要求文書は未確認です。現行実装は、会話で確認した表示要件とリポジトリ内の実装を基準に記載しています。
