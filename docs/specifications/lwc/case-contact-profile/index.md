# ケース取引先責任者プロフィール

## 概要

ケースの問い合わせ元となる人物と会社の情報を、Caseレコードページ上の顧客カードとして読み取り専用で表示するLightning Web Componentです。

## 目的・利用場面

Caseを確認する利用者が、問い合わせ元の連絡先、所属会社、過去の問い合わせ件数を同じレコードページ上で確認するために使用します。

## 対象実装・メタデータ

| 種別           | API名・ファイル名            | 役割                                     |
| -------------- | ---------------------------- | ---------------------------------------- |
| LWC            | `caseContactProfile`         | 問い合わせ元のプロフィールを取得・表示   |
| LWC JavaScript | `caseContactProfile.js`      | UI API取得、画面状態、Navigationの統括   |
| LWC JavaScript | `caseContactProfileLogic.js` | プロフィール表示モデルと件数表示値の生成 |
| FlexiPage      | `CaseFlexiPage`              | Caseレコードページ左領域への配置         |

## 入力

- Caseレコードページから渡される `recordId`

## 処理内容

Lightning Data Serviceの `getRecord` でCaseと関連するContact、Accountの表示項目を取得します。ContactとAccountの `Cases` 関連リスト件数は、`getRelatedListCount` でそれぞれ取得します。

### 表示項目

| 表示項目             | Contactがある場合                     | Contactがない場合                     |
| -------------------- | ------------------------------------- | ------------------------------------- |
| 氏名                 | `Contact.Name`                        | `Case.SuppliedName`                   |
| 電話                 | `Contact.Phone`                       | `Case.SuppliedPhone`                  |
| メール               | `Contact.Email`                       | `Case.SuppliedEmail`                  |
| 携帯電話             | `Contact.MobilePhone`                 | `-`                                   |
| FAX                  | `Contact.Fax`                         | `-`                                   |
| 部署                 | `Contact.Department`                  | `-`                                   |
| 役職                 | `Contact.Title`                       | `-`                                   |
| 会社名               | 下記の会社情報優先順位に従う          | 下記の会社情報優先順位に従う          |
| WebサイトURL         | 下記の会社情報優先順位に従う          | 下記の会社情報優先順位に従う          |
| 顧客の問い合わせ件数 | Contactに紐づくCase件数               | `-`                                   |
| 会社の問い合わせ件数 | 下記で採用したAccountに紐づくCase件数 | 下記で採用したAccountがない場合は `-` |

会社名とWebサイトURLは、次の順で取得します。

1. Caseに取引先がある場合は `Case.Account.Name` と `Case.Account.Website`
2. Caseに取引先がなく、Contactに取引先がある場合は `Contact.Account.Name` と `Contact.Account.Website`
3. どちらにも取引先がない場合、会社名だけ `Case.SuppliedCompany`

Web-to-Caseの標準項目にはWebサイトURL、携帯電話、FAX、部署、役職に対応する項目がないため、これらは代替しません。取得値がない表示項目には `-` を表示します。

### リンクと画面表示

- Contactがある場合、氏名をContactレコードへのリンクとして表示し、別タブで開きます。
- Accountがある場合、会社名をAccountレコードへのリンクとして表示し、別タブで開きます。
- 電話、携帯電話、FAX、メール、WebサイトURLはLightningの標準formattedコンポーネントで表示します。
- 人物画像にはSLDSの `utility:profile_alt` アイコンを使用します。
- `lightning-card` を使用し、周囲の標準カードと同じ外周、角丸、余白で表示します。ラベルを上、値を下へ配置します。
- 会社名の上に罫線を表示して人物情報と会社情報を区切り、会社名とWebサイトURLはそれぞれ1行分の全幅領域へ配置します。
- WebサイトURLの下に罫線を表示し、その下へ顧客と会社の問い合わせ件数を2列で配置します。

## 出力・更新対象

- ContactまたはWeb-to-Case入力を基にした人物情報
- CaseまたはContactに関連するAccount情報
- ContactとAccountに紐づくCase件数
- レコードの作成、更新、削除は行いません。

## 権限・実行条件

- Caseレコードページで実行し、Apexは使用しません。
- `Case.ContactId` を必須項目、その他の表示項目を任意項目として取得します。
- 任意項目を参照できない場合もCaseの読み込みを継続し、取得できない値には `-` を表示します。
- 問い合わせ件数には現在表示しているCase自身を含み、実行ユーザーが参照できるCaseだけを数えます。
- 関連リスト件数は最大1,999件まで取得し、それを超える場合は `1,999+` と表示します。

## エラー処理

- 読み込み中はスピナーを表示します。
- Caseの読み込みに失敗した場合は、詳細を露出しない利用者向けエラーを表示します。
- ContactまたはAccountの問い合わせ件数を取得できない場合は、プロフィール表示を継続して該当件数を `-` にします。
- レコードリンクを生成できない場合も情報表示を継続し、該当値をリンクなしで表示します。

## 関連コンポーネント

- `CaseFlexiPage`: Caseレコードページへの配置
- `lightning/uiRecordApi`: Caseと関連項目の取得
- `lightning/uiRelatedListApi`: ContactとAccountのCase件数取得
- `lightning/navigation`: ContactとAccountのレコードURL生成

## テスト・確認観点

`caseContactProfile.test.js` で次を確認します。

- ContactとCaseのAccountがある場合の全項目、別タブで開くリンク、人物アイコン
- 会社名の上に人物情報との区切り罫線があること
- CaseのAccountをContactのAccountより優先すること
- CaseにAccountがない場合にContactのAccountを使用すること
- ContactとAccountのCase件数、0件、1,999件超過表示、取得エラー
- ContactとAccountがない場合にWeb-to-Case項目を使用し、レコードリンクを表示しないこと
- 取得値がない項目の `-` 表示
- 読み込み中と取得エラー
- 各主要状態のアクセシビリティ

## 制約・注意事項

- 項目値は読み取り専用で、コンポーネントから編集できません。
- 任意項目が未登録の場合と項目権限がない場合は、同じ代替表示を使用します。

## 既知の差異・確認事項

- 状態: 現行実装確認済み、承認済み要求との差異は未判定
- 現行実装は `caseContactProfile`、関連FlexiPage、Jestテストから確認しています。
- 承認済み要求または画面要件の管理元をリポジトリ内で確認できないため、要求との差異は判定していません。
