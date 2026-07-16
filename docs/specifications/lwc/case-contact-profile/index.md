# ケース取引先責任者プロフィール

## 概要

ケースの問い合わせ元となる人物と会社の情報を、Case レコードページ上の顧客カードとして読み取り専用で表示する Lightning Web Component です。

## 対象実装・メタデータ

| 種別      | API 名・ファイル名   | 役割                                   |
| --------- | -------------------- | -------------------------------------- |
| LWC       | `caseContactProfile` | 問い合わせ元のプロフィールを取得・表示 |
| FlexiPage | `CaseFlexiPage`      | Case レコードページ左領域への配置      |

## 入力

- Case レコードページから渡される `recordId`

## 表示項目

| 表示項目       | Contact がある場合           | Contact がない場合           |
| -------------- | ---------------------------- | ---------------------------- |
| 氏名           | `Contact.Name`               | `Case.SuppliedName`          |
| 電話           | `Contact.Phone`              | `Case.SuppliedPhone`         |
| メール         | `Contact.Email`              | `Case.SuppliedEmail`         |
| 携帯電話       | `Contact.MobilePhone`        | `-`                          |
| FAX            | `Contact.Fax`                | `-`                          |
| 部署           | `Contact.Department`         | `-`                          |
| 役職           | `Contact.Title`              | `-`                          |
| 会社名         | 下記の会社情報優先順位に従う | 下記の会社情報優先順位に従う |
| Web サイト URL | 下記の会社情報優先順位に従う | 下記の会社情報優先順位に従う |

会社名と Web サイト URL は、次の順で取得します。

1. Case に取引先がある場合は `Case.Account.Name` と `Case.Account.Website`
2. Case に取引先がなく、Contact に取引先がある場合は `Contact.Account.Name` と `Contact.Account.Website`
3. どちらにも取引先がない場合、会社名だけ `Case.SuppliedCompany`

Web-to-Case の標準項目には Web サイト URL、携帯電話、FAX、部署、役職に対応する項目がないため、これらは代替しません。取得値がない表示項目には `-` を表示します。

## リンクと画面表示

- Contact がある場合、氏名を Contact レコードへのリンクとして表示します。
- Account がある場合、会社名を Account レコードへのリンクとして表示します。
- 電話、携帯電話、FAX、メール、Web サイト URL は Lightning の標準 formatted コンポーネントで表示します。
- 人物画像には SLDS の `utility:profile_alt` アイコンを使用します。
- 背景は白とし、ラベルを上、値を下へ配置します。
- 会社名と Web サイト URL はそれぞれ 1 行分の全幅領域へ配置します。

## データ取得と権限

- Lightning Data Service の `getRecord` を使用し、Apex は使用しません。
- `Case.ContactId` を必須項目、その他の表示項目を任意項目として取得します。
- 任意項目を参照できない場合も Case の読み込みを継続し、取得できない値には `-` を表示します。
- レコードの作成、更新、削除は行いません。

## 状態とエラー

- 読み込み中はスピナーを表示します。
- Case の読み込みに失敗した場合は、詳細を露出しない利用者向けエラーを表示します。
- レコードリンクを生成できない場合も情報表示を継続し、該当値をリンクなしで表示します。

## テスト・確認観点

`caseContactProfile.test.js` で次を確認します。

- Contact と Case の Account がある場合の全項目、リンク、人物アイコン
- Case の Account を Contact の Account より優先すること
- Case に Account がない場合に Contact の Account を使用すること
- Contact と Account がない場合に Web-to-Case 項目を使用し、レコードリンクを表示しないこと
- 取得値がない項目の `-` 表示
- 読み込み中と取得エラー
- 各主要状態のアクセシビリティ

## 制約・注意事項

- 項目値は読み取り専用で、コンポーネントから編集できません。
- 任意項目が未登録の場合と項目権限がない場合は、同じ代替表示を使用します。
